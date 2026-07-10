import uuid

from fastapi.testclient import TestClient
from pytest import MonkeyPatch
from sqlmodel import Session, select

from app.api.routes import avatars as avatar_routes
from app.core.config import settings
from app.models import Avatar, User


def create_avatar(db: Session, owner: User) -> Avatar:
    avatar = Avatar(
        name="Test avatar",
        description="A test profile",
        image_key=f"avatars/{owner.id}/{uuid.uuid4()}.png",
        owner_id=owner.id,
    )
    db.add(avatar)
    db.commit()
    db.refresh(avatar)
    return avatar


def mock_storage(monkeypatch: MonkeyPatch) -> tuple[list[str], list[str]]:
    uploaded: list[str] = []
    deleted: list[str] = []
    monkeypatch.setattr(
        avatar_routes,
        "upload_image",
        lambda *, key, content, content_type: uploaded.append(key),
    )
    monkeypatch.setattr(avatar_routes, "delete_image", deleted.append)
    monkeypatch.setattr(
        avatar_routes,
        "public_image_url",
        lambda key: f"https://media.example/{key}",
    )
    return uploaded, deleted


def test_create_and_read_avatar(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    monkeypatch: MonkeyPatch,
) -> None:
    uploaded, _ = mock_storage(monkeypatch)
    response = client.post(
        f"{settings.API_V1_STR}/avatars/",
        headers=normal_user_token_headers,
        data={"name": "Ada", "description": "Portrait"},
        files={"image": ("avatar.png", b"png-data", "image/png")},
    )
    assert response.status_code == 201
    avatar = response.json()
    assert avatar["name"] == "Ada"
    assert avatar["description"] == "Portrait"
    assert avatar["image_url"].startswith("https://media.example/")
    assert uploaded == [avatar["image_url"].removeprefix("https://media.example/")]

    response = client.get(
        f"{settings.API_V1_STR}/avatars/{avatar['id']}",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 200
    assert response.json()["id"] == avatar["id"]


def test_rejects_invalid_avatar_images(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
) -> None:
    response = client.post(
        f"{settings.API_V1_STR}/avatars/",
        headers=normal_user_token_headers,
        data={"name": "Invalid"},
        files={"image": ("avatar.gif", b"gif-data", "image/gif")},
    )
    assert response.status_code == 415

    response = client.post(
        f"{settings.API_V1_STR}/avatars/",
        headers=normal_user_token_headers,
        data={"name": "Empty"},
        files={"image": ("avatar.png", b"", "image/png")},
    )
    assert response.status_code == 413


def test_list_update_replace_and_delete_avatar(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    monkeypatch: MonkeyPatch,
) -> None:
    uploaded, deleted = mock_storage(monkeypatch)
    owner = db.exec(select(User)).first()
    assert owner is not None
    avatar = create_avatar(db, owner)
    old_key = avatar.image_key

    response = client.get(
        f"{settings.API_V1_STR}/avatars/", headers=superuser_token_headers
    )
    assert response.status_code == 200
    assert any(item["id"] == str(avatar.id) for item in response.json()["data"])

    response = client.patch(
        f"{settings.API_V1_STR}/avatars/{avatar.id}",
        headers=superuser_token_headers,
        json={"name": "Updated"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated"

    response = client.put(
        f"{settings.API_V1_STR}/avatars/{avatar.id}/image",
        headers=superuser_token_headers,
        files={"image": ("replacement.webp", b"webp-data", "image/webp")},
    )
    assert response.status_code == 200
    assert uploaded
    assert old_key in deleted

    replacement_key = response.json()["image_url"].removeprefix(
        "https://media.example/"
    )
    response = client.delete(
        f"{settings.API_V1_STR}/avatars/{avatar.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    assert response.json() == {"message": "Avatar deleted successfully"}
    assert replacement_key in deleted


def test_avatar_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/avatars/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
