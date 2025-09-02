"""baseline schema for houses, allotments, file_movements"""
from alembic import op
import sqlalchemy as sa

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "houses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("file_no", sa.String(length=64), nullable=False),
        sa.Column("qtr_no", sa.Integer(), nullable=False),
        sa.Column("sector", sa.String(length=64), nullable=False),
    )
    op.create_index("ix_houses_file_no", "houses", ["file_no"], unique=True)

    op.create_table(
        "allotments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("house_id", sa.Integer(), sa.ForeignKey("houses.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("person_name", sa.String(length=120), nullable=False),
        sa.Column("cnic", sa.String(length=20), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_allotments_house_id", "allotments", ["house_id"])
    op.create_index("ix_allotments_house_active", "allotments", ["house_id", "active"])

    op.create_table(
        "file_movements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("house_id", sa.Integer(), sa.ForeignKey("houses.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("file_no", sa.String(length=64), nullable=False),
        sa.Column("subject", sa.String(length=200), nullable=False),
        sa.Column("issued_to", sa.String(length=120), nullable=False),
        sa.Column("department", sa.String(length=120), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("issue_date", sa.DateTime(), nullable=True),
        sa.Column("return_date", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_file_movements_house_id", "file_movements", ["house_id"])
    op.create_index("ix_file_movements_file_no", "file_movements", ["file_no"])

def downgrade():
    op.drop_index("ix_file_movements_file_no", table_name="file_movements")
    op.drop_index("ix_file_movements_house_id", table_name="file_movements")
    op.drop_table("file_movements")

    op.drop_index("ix_allotments_house_active", table_name="allotments")
    op.drop_index("ix_allotments_house_id", table_name="allotments")
    op.drop_table("allotments")

    op.drop_index("ix_houses_file_no", table_name="houses")
    op.drop_table("houses")
