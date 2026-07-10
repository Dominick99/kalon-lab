import logging
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.core.storage import delete_image, public_image_url, upload_image
from app.models import (
    Avatar,
    AvatarPublic,
    AvatarsPublic,
    AvatarUpdate,
    Message,
    get_datetime_utc,
)

router = APIRouter(prefix="/avatars", tags=["avatars"])
logger = logging.getLogger(__name__)
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024


def to_public(avatar: Avatar) -> AvatarPublic:
    return AvatarPublic.model_validate(
        avatar, update={"image_url": public_image_url(avatar.image_key)}
    )


def owned_avatar(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Avatar:
    avatar = session.get(Avatar, id)
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar not found")
    if not current_user.is_superuser and avatar.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return avatar


async def read_image(image: UploadFile) -> tuple[bytes, str, str]:
    content_type = image.content_type or ""
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Use a JPEG, PNG, or WebP image")
    content = await image.read(MAX_IMAGE_BYTES + 1)
    if not content or len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be between 1 byte and 10 MB")
    extension = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[content_type]
    return content, content_type, extension


@router.get("/", response_model=AvatarsPublic)
def read_avatars(session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100) -> Any:
    filters = [] if current_user.is_superuser else [Avatar.owner_id == current_user.id]
    count = session.exec(select(func.count()).select_from(Avatar).where(*filters)).one()
    avatars = session.exec(
        select(Avatar).where(*filters).order_by(col(Avatar.created_at).desc()).offset(skip).limit(limit)
    ).all()
    return AvatarsPublic(data=[to_public(avatar) for avatar in avatars], count=count)


@router.get("/{id}", response_model=AvatarPublic)
def read_avatar(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> AvatarPublic:
    return to_public(owned_avatar(session, current_user, id))


@router.post("/", response_model=AvatarPublic, status_code=status.HTTP_201_CREATED)
async def create_avatar(
    session: SessionDep,
    current_user: CurrentUser,
    name: Annotated[str, Form(min_length=1, max_length=255)],
    description: Annotated[str | None, Form(max_length=2000)] = None,
    image: UploadFile = File(...),
) -> AvatarPublic:
    content, content_type, extension = await read_image(image)
    avatar_id = uuid.uuid4()
    image_key = f"avatars/{current_user.id}/{avatar_id}/{uuid.uuid4()}{extension}"
    upload_image(key=image_key, content=content, content_type=content_type)
    avatar = Avatar(id=avatar_id, owner_id=current_user.id, name=name, description=description, image_key=image_key)
    try:
        session.add(avatar)
        session.commit()
        session.refresh(avatar)
    except Exception:
        session.rollback()
        delete_image(image_key)
        raise
    return to_public(avatar)


@router.patch("/{id}", response_model=AvatarPublic)
def update_avatar(session: SessionDep, current_user: CurrentUser, id: uuid.UUID, avatar_in: AvatarUpdate) -> AvatarPublic:
    avatar = owned_avatar(session, current_user, id)
    avatar.sqlmodel_update(avatar_in.model_dump(exclude_unset=True))
    avatar.updated_at = get_datetime_utc()
    session.add(avatar)
    session.commit()
    session.refresh(avatar)
    return to_public(avatar)


@router.put("/{id}/image", response_model=AvatarPublic)
async def replace_avatar_image(session: SessionDep, current_user: CurrentUser, id: uuid.UUID, image: UploadFile = File(...)) -> AvatarPublic:
    avatar = owned_avatar(session, current_user, id)
    content, content_type, extension = await read_image(image)
    old_key = avatar.image_key
    new_key = f"avatars/{avatar.owner_id}/{avatar.id}/{uuid.uuid4()}{extension}"
    upload_image(key=new_key, content=content, content_type=content_type)
    avatar.image_key = new_key
    avatar.updated_at = get_datetime_utc()
    try:
        session.add(avatar)
        session.commit()
        session.refresh(avatar)
    except Exception:
        session.rollback()
        delete_image(new_key)
        raise
    try:
        delete_image(old_key)
    except Exception:
        logger.exception("Could not delete replaced avatar image %s", old_key)
    return to_public(avatar)


@router.delete("/{id}")
def delete_avatar(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Message:
    avatar = owned_avatar(session, current_user, id)
    image_key = avatar.image_key
    session.delete(avatar)
    session.commit()
    try:
        delete_image(image_key)
    except Exception:
        logger.exception("Could not delete avatar image %s", image_key)
    return Message(message="Avatar deleted successfully")
