"""Remove items

Revision ID: a8f4c2d91e73
Revises: 2d6f7a81b934
Create Date: 2026-07-29
"""

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

revision = "a8f4c2d91e73"
down_revision = "2d6f7a81b934"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("item")


def downgrade() -> None:
    op.create_table(
        "item",
        sa.Column(
            "title",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=False,
        ),
        sa.Column(
            "description",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=True,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
