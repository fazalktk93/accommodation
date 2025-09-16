"""baseline with full schema"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # house
    op.create_table(
        "house",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("file_no", sa.String, nullable=False, unique=True),
        sa.Column("qtr_no", sa.String),
        sa.Column("street", sa.String),
        sa.Column("sector", sa.String),
        sa.Column("type_code", sa.String),
        sa.Column("status", sa.String, nullable=False),
        sa.Column("status_manual", sa.Boolean, nullable=False, server_default="0"),
    )
    op.create_index("ix_house_qtr_no", "house", ["qtr_no"])
    op.create_index("ix_house_type_code", "house", ["type_code"])
    op.create_index("ix_house_street", "house", ["street"])
    op.create_index("ix_house_sector", "house", ["sector"])
    op.create_index("ix_house_file_no", "house", ["file_no"], unique=True)

    # user (updated schema)
    op.create_table(
        "user",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String, nullable=False, unique=True),
        sa.Column("full_name", sa.String, nullable=True),
        sa.Column("email", sa.String, nullable=True, unique=True),
        sa.Column("hashed_password", sa.String, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("role", sa.String, nullable=False, server_default="'viewer'"),
        sa.Column("permissions", sa.Text, nullable=True),  # JSON → TEXT for SQLite
        # legacy fields (optional, helps migrations)
        sa.Column("password", sa.String, nullable=True),
        sa.Column("is_superuser", sa.Boolean, nullable=False, server_default="0"),
    )
    op.create_index("ix_user_username", "user", ["username"], unique=True)
    op.create_index("ix_user_email", "user", ["email"], unique=True)

    # allotment
    op.create_table(
        "allotment",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("house_id", sa.Integer, sa.ForeignKey("house.id")),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("user.id")),
        sa.Column("date_from", sa.Date),
        sa.Column("date_to", sa.Date),
    )

    # file_movement
    op.create_table(
        "file_movement",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("file_no", sa.String, nullable=False),
        sa.Column("from_dept", sa.String),
        sa.Column("to_dept", sa.String),
        sa.Column("moved_on", sa.DateTime),
    )


def downgrade():
    op.drop_table("file_movement")
    op.drop_table("allotment")
    op.drop_table("house")
    op.drop_table("user")
