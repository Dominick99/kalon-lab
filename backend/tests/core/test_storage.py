from pytest import MonkeyPatch

from app.core import storage


class FakeS3Client:
    def __init__(self) -> None:
        self.uploaded: dict[str, object] | None = None
        self.deleted: dict[str, str] | None = None

    def put_object(self, **kwargs: object) -> None:
        self.uploaded = kwargs

    def delete_object(self, **kwargs: str) -> None:
        self.deleted = kwargs

    def generate_presigned_url(
        self, operation: str, *, Params: dict[str, str], ExpiresIn: int
    ) -> str:
        return f"signed://{operation}/{Params['Key']}?expires={ExpiresIn}"


def test_upload_and_delete_image(monkeypatch: MonkeyPatch) -> None:
    client = FakeS3Client()
    monkeypatch.setattr(storage, "get_s3_client", lambda: client)

    storage.upload_image(
        key="avatars/test.png", content=b"image", content_type="image/png"
    )
    assert client.uploaded == {
        "Bucket": storage.settings.S3_BUCKET,
        "Key": "avatars/test.png",
        "Body": b"image",
        "ContentType": "image/png",
    }

    storage.delete_image("avatars/test.png")
    assert client.deleted == {
        "Bucket": storage.settings.S3_BUCKET,
        "Key": "avatars/test.png",
    }


def test_public_image_url(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(
        storage.settings, "S3_PUBLIC_ENDPOINT_URL", "https://media.example/"
    )
    assert (
        storage.public_image_url("avatars/a profile.png")
        == f"https://media.example/{storage.settings.S3_BUCKET}/avatars/a%20profile.png"
    )


def test_public_image_url_uses_presigned_url(monkeypatch: MonkeyPatch) -> None:
    client = FakeS3Client()
    monkeypatch.setattr(storage.settings, "S3_PUBLIC_ENDPOINT_URL", None)
    monkeypatch.setattr(storage.settings, "S3_ENDPOINT_URL", None)
    monkeypatch.setattr(storage, "get_s3_client", lambda: client)

    assert storage.public_image_url("avatars/private.png") == (
        "signed://get_object/avatars/private.png?expires=3600"
    )
