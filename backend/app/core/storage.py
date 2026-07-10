from functools import lru_cache
from urllib.parse import quote

import boto3  # type: ignore[import-untyped]
from botocore.client import BaseClient  # type: ignore[import-untyped]

from app.core.config import settings


@lru_cache
def get_s3_client() -> BaseClient:
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
    )


def upload_image(*, key: str, content: bytes, content_type: str) -> None:
    get_s3_client().put_object(
        Bucket=settings.S3_BUCKET,
        Key=key,
        Body=content,
        ContentType=content_type,
    )


def delete_image(key: str) -> None:
    get_s3_client().delete_object(Bucket=settings.S3_BUCKET, Key=key)


def public_image_url(key: str) -> str:
    base_url = settings.S3_PUBLIC_ENDPOINT_URL or settings.S3_ENDPOINT_URL
    if not base_url:
        return get_s3_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET, "Key": key},
            ExpiresIn=3600,
        )
    return f"{base_url.rstrip('/')}/{settings.S3_BUCKET}/{quote(key)}"
