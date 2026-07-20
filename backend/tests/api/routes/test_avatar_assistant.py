import uuid

from fastapi.testclient import TestClient
from pytest import MonkeyPatch
from sqlmodel import Session, select

from app.api.routes import avatar_assistant
from app.core.config import settings
from app.models import Avatar, User


def mock_draft_storage(monkeypatch: MonkeyPatch) -> tuple[list[str], list[str]]:
    uploaded: list[str] = []
    deleted: list[str] = []
    monkeypatch.setattr(avatar_assistant, "read_image", lambda key: b"draft-image")
    monkeypatch.setattr(
        avatar_assistant,
        "upload_image",
        lambda *, key, content, content_type: uploaded.append(key),
    )
    monkeypatch.setattr(avatar_assistant, "delete_image", deleted.append)
    monkeypatch.setattr(
        avatar_assistant,
        "public_image_url",
        lambda key: f"https://media.example/{key}",
    )
    return uploaded, deleted


def test_approval_creates_avatar_only_at_confirmation(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    db: Session,
    monkeypatch: MonkeyPatch,
) -> None:
    uploaded, deleted = mock_draft_storage(monkeypatch)
    owner = db.exec(select(User).where(User.email == settings.EMAIL_TEST_USER)).one()
    draft_key = f"avatar-drafts/{owner.id}/{uuid.uuid4()}.png"

    before = len(db.exec(select(Avatar).where(Avatar.owner_id == owner.id)).all())
    response = client.post(
        f"{settings.API_V1_STR}/avatar-assistant/approve",
        headers=normal_user_token_headers,
        json={
            "mode": "create",
            "draft": {
                "name": "Maya",
                "description": "age: 23\nfrom: Austin, Texas",
                "visual_prompt": "A studio portrait of Maya",
                "image_url": "https://media.example/draft.png",
                "image_key": draft_key,
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Maya"
    assert len(db.exec(select(Avatar).where(Avatar.owner_id == owner.id)).all()) == before + 1
    assert uploaded and uploaded[0].startswith(f"avatars/{owner.id}/")
    assert draft_key in deleted


def test_approval_rejects_another_users_draft_key(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
) -> None:
    response = client.post(
        f"{settings.API_V1_STR}/avatar-assistant/approve",
        headers=normal_user_token_headers,
        json={
            "mode": "create",
            "draft": {
                "name": "Maya",
                "description": "age: 23",
                "image_key": f"avatar-drafts/{uuid.uuid4()}/stolen.png",
            },
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid draft image"
