import base64
import io
import json
import uuid
from typing import Literal, TypedDict

from fastapi import APIRouter, HTTPException, status
from langgraph.graph import END, START, StateGraph
from openai import APIError, AsyncOpenAI
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, SessionDep
from app.api.routes.avatars import owned_avatar, to_public
from app.core.config import settings
from app.core.storage import delete_image, public_image_url, read_image, upload_image
from app.models import Avatar, AvatarPublic, get_datetime_utc

router = APIRouter(prefix="/avatar-assistant", tags=["avatar-assistant"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class AvatarDraft(BaseModel):
    name: str = Field(default="", max_length=255)
    description: str = Field(default="", max_length=2000)
    visual_prompt: str = Field(default="", max_length=4000)
    image_url: str | None = None
    image_key: str | None = None


class AssistantChatRequest(BaseModel):
    mode: Literal["create", "edit"]
    avatar_id: uuid.UUID | None = None
    messages: list[ChatMessage] = Field(default_factory=list, max_length=30)
    draft: AvatarDraft = Field(default_factory=AvatarDraft)


class AssistantDecision(BaseModel):
    message: str
    name: str | None = None
    description: str | None = None
    visual_prompt: str | None = None
    image_action: Literal["none", "generate", "edit"] = "none"
    image_prompt: str | None = None


class AssistantChatResponse(BaseModel):
    message: str
    draft: AvatarDraft


class ApproveDraftRequest(BaseModel):
    mode: Literal["create", "edit"]
    avatar_id: uuid.UUID | None = None
    draft: AvatarDraft


class GraphState(TypedDict):
    request: AssistantChatRequest
    decision: AssistantDecision | None


SYSTEM_PROMPT = """You are an avatar design collaborator. Help the user create or revise exactly
three things: an avatar name, a profile-style description, and an image.

Return concise, friendly conversation plus structured draft updates. Format descriptions as
newline-separated lowercase `key: value` fields (for example `age: 23`). Never invent biography
facts; ask for them or omit them. Preserve draft values the user did not ask to change.

Use image_action `generate` when the user asks for the first image or an entirely different image.
Use `edit` for a targeted change to the current image while preserving everything else. Use `none`
when no image work is needed. Supply a complete, production-quality image_prompt for image actions.
Do not claim anything has been saved. The application requires a separate explicit approval."""


def openai_client() -> AsyncOpenAI:
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The avatar assistant is not configured yet",
        )
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def decide(state: GraphState) -> GraphState:
    request = state["request"]
    context = {
        "mode": request.mode,
        "draft": request.draft.model_dump(exclude={"image_url", "image_key"}),
        "has_current_image": bool(request.draft.image_url),
    }
    input_messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": f"Current avatar context: {json.dumps(context)}"},
        *[message.model_dump() for message in request.messages],
    ]
    try:
        response = await openai_client().responses.parse(
            model=settings.OPENAI_CHAT_MODEL,
            input=input_messages,
            text_format=AssistantDecision,
        )
    except APIError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"OpenAI assistant failed: {exc.message}",
        ) from exc
    decision = response.output_parsed
    if decision is None:
        raise HTTPException(status_code=502, detail="The assistant returned an invalid response")
    return {"request": request, "decision": decision}


graph_builder = StateGraph(GraphState)
graph_builder.add_node("decide", decide)
graph_builder.add_edge(START, "decide")
graph_builder.add_edge("decide", END)
assistant_graph = graph_builder.compile()


def draft_prefix(user_id: uuid.UUID) -> str:
    return f"avatar-drafts/{user_id}/"


def verified_draft_key(user_id: uuid.UUID, key: str) -> str:
    if not key.startswith(draft_prefix(user_id)) or ".." in key:
        raise HTTPException(status_code=400, detail="Invalid draft image")
    return key


def image_extension_and_type(key: str) -> tuple[str, str]:
    if key.lower().endswith(".jpg") or key.lower().endswith(".jpeg"):
        return ".jpg", "image/jpeg"
    if key.lower().endswith(".webp"):
        return ".webp", "image/webp"
    return ".png", "image/png"


@router.post("/chat", response_model=AssistantChatResponse)
async def chat(
    request: AssistantChatRequest,
    session: SessionDep,
    current_user: CurrentUser,
) -> AssistantChatResponse:
    if not request.messages or request.messages[-1].role != "user":
        raise HTTPException(status_code=400, detail="A user message is required")
    existing: Avatar | None = None
    if request.mode == "edit":
        if not request.avatar_id:
            raise HTTPException(status_code=400, detail="An avatar is required for editing")
        existing = owned_avatar(session, current_user, request.avatar_id)

    result = await assistant_graph.ainvoke({"request": request, "decision": None})
    decision = result["decision"]
    assert decision is not None
    draft = request.draft.model_copy(deep=True)
    if decision.name is not None:
        draft.name = decision.name
    if decision.description is not None:
        draft.description = decision.description
    if decision.visual_prompt is not None:
        draft.visual_prompt = decision.visual_prompt

    if decision.image_action != "none":
        prompt = decision.image_prompt or draft.visual_prompt
        if not prompt:
            raise HTTPException(status_code=400, detail="An image description is required")
        client = openai_client()
        try:
            if decision.image_action == "generate":
                generated = await client.images.generate(
                    model=settings.OPENAI_IMAGE_MODEL,
                    prompt=prompt,
                    size="1024x1024",
                    quality="medium",
                )
            else:
                source_key = draft.image_key
                if source_key:
                    source_key = verified_draft_key(current_user.id, source_key)
                elif existing:
                    source_key = existing.image_key
                else:
                    raise HTTPException(status_code=400, detail="There is no image to edit")
                source = read_image(source_key)
                extension, content_type = image_extension_and_type(source_key)
                generated = await client.images.edit(
                    model=settings.OPENAI_IMAGE_MODEL,
                    image=(f"avatar{extension}", io.BytesIO(source), content_type),
                    prompt=prompt,
                    size="1024x1024",
                    quality="medium",
                )
        except APIError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"OpenAI image generation failed: {exc.message}",
            ) from exc
        if not generated.data or not generated.data[0].b64_json:
            raise HTTPException(status_code=502, detail="Image generation returned no image")
        content = base64.b64decode(generated.data[0].b64_json)
        new_key = f"{draft_prefix(current_user.id)}{uuid.uuid4()}.png"
        upload_image(key=new_key, content=content, content_type="image/png")
        if draft.image_key:
            try:
                delete_image(verified_draft_key(current_user.id, draft.image_key))
            except Exception:
                pass
        draft.image_key = new_key
        draft.image_url = public_image_url(new_key)
        draft.visual_prompt = prompt

    return AssistantChatResponse(message=decision.message, draft=draft)


@router.post("/approve", response_model=AvatarPublic)
def approve(
    request: ApproveDraftRequest,
    session: SessionDep,
    current_user: CurrentUser,
) -> AvatarPublic:
    name = request.draft.name.strip()
    description = request.draft.description.strip()
    if not name or not description:
        raise HTTPException(status_code=400, detail="Name and description are required")

    avatar: Avatar
    old_key: str | None = None
    if request.mode == "edit":
        if not request.avatar_id:
            raise HTTPException(status_code=400, detail="An avatar is required for editing")
        avatar = owned_avatar(session, current_user, request.avatar_id)
        old_key = avatar.image_key
    else:
        avatar = Avatar(name=name, description=description, image_key="", owner_id=current_user.id)

    draft_key = request.draft.image_key
    new_key: str | None = None
    if draft_key:
        verified_draft_key(current_user.id, draft_key)
        content = read_image(draft_key)
        new_key = f"avatars/{avatar.owner_id}/{avatar.id}/{uuid.uuid4()}.png"
        upload_image(key=new_key, content=content, content_type="image/png")
        avatar.image_key = new_key
    elif request.mode == "create":
        raise HTTPException(status_code=400, detail="Generate an image before approving")

    avatar.name = name
    avatar.description = description
    avatar.updated_at = get_datetime_utc()
    try:
        session.add(avatar)
        session.commit()
        session.refresh(avatar)
    except Exception:
        session.rollback()
        if new_key:
            delete_image(new_key)
        raise

    if draft_key:
        try:
            delete_image(draft_key)
        except Exception:
            pass
    if old_key and new_key:
        try:
            delete_image(old_key)
        except Exception:
            pass
    return to_public(avatar)
