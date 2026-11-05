"""Keep Dev Suite identities separate from native Hub accounts."""
from alembic import op
import sqlalchemy as sa

revision = "0004_suite_identities"
down_revision = "0003_authentication"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("suite_identities",
        sa.Column("issuer", sa.String(256), primary_key=True),
        sa.Column("subject", sa.String(128), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_table("suite_identities")
