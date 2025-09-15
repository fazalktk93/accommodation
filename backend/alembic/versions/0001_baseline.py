from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # houses
    op.create_table(
        "houses",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("file_no", sa.String, nullable=False, unique=True),
        sa.Column("qtr_no", sa.String),
        sa.Column("street", sa.String),
        sa.Column("sector", sa.String),
        sa.Column("type_code", sa.String),
        sa.Column("status", sa.String, nullable=False),
        sa.Column("status_manual", sa.Boolean, nullable=False, server_default="0"),
    )
    op.create_index("ix_houses_qtr_no", "houses", ["qtr_no"])
    op.create_index("ix_houses_type_code", "houses", ["type_code"])
    op.create_index("ix_houses_street", "houses", ["street"])
    op.create_index("ix_houses_sector", "houses", ["sector"])

    # allotments
    op.create_table(
        "allotments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("house_id", sa.Integer, sa.ForeignKey("houses.id")),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("user.id")),
        sa.Column("date_from", sa.Date),
        sa.Column("date_to", sa.Date),
    )

    # file_movements
    op.create_table(
        "file_movements",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("file_no", sa.String, nullable=False),
        sa.Column("from_dept", sa.String),
        sa.Column("to_dept", sa.String),
        sa.Column("moved_on", sa.DateTime),
    )

    # user
    op.create_table(
        "user",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String, nullable=False, unique=True),
        sa.Column("password", sa.String, nullable=False),
        sa.Column("is_superuser", sa.Boolean, nullable=False, server_default="0"),
    )

def downgrade():
    op.drop_table("file_movements")
    op.drop_table("allotments")
    op.drop_table("houses")
    op.drop_table("user")
