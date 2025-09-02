"""baseline schema for houses, allotments, file_movements (idempotent)"""
from alembic import op
import sqlalchemy as sa

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None

def has_table(bind, name: str) -> bool:
    return sa.inspect(bind).has_table(name)

def has_index(bind, table: str, index_name: str) -> bool:
    idxs = sa.inspect(bind).get_indexes(table)
    return any(i.get("name") == index_name for i in idxs)

def upgrade():
    bind = op.get_bind()

    # houses
    if not has_table(bind, "houses"):
        op.create_table(
            "houses",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("file_no", sa.String(length=64), nullable=False),
            sa.Column("qtr_no", sa.Integer(), nullable=False),
            sa.Column("sector", sa.String(length=64), nullable=False),
        )
    if not has_index(bind, "houses", "ix_houses_file_no"):
        op.create_index("ix_houses_file_no", "houses", ["file_no"], unique=True)

    # allotments
    if not has_table(bind, "allotments"):
        op.create_table(
            "allotments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("house_id", sa.Integer(), sa.ForeignKey("houses.id", ondelete="CASCADE"), nullable=False),
            sa.Column("person_name", sa.String(length=120), nullable=False),
            sa.Column("cnic", sa.String(length=20), nullable=True),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=True),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("notes", sa.Text(), nullable=True),
        )
    if not has_index(bind, "allotments", "ix_allotments_house_id"):
        op.create_index("ix_allotments_house_id", "allotments", ["house_id"])
    if not has_index(bind, "allotments", "ix_allotments_house_active"):
        op.create_index("ix_allotments_house_active", "allotments", ["house_id", "active"])

    # file_movements
    if not has_table(bind, "file_movements"):
        op.create_table(
            "file_movements",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("house_id", sa.Integer(), sa.ForeignKey("houses.id", ondelete="CASCADE"), nullable=False),
            sa.Column("file_no", sa.String(length=64), nullable=False),
            sa.Column("subject", sa.String(length=200), nullable=False),
            sa.Column("issued_to", sa.String(length=120), nullable=False),
            sa.Column("department", sa.String(length=120), nullable=True),
            sa.Column("due_date", sa.Date(), nullable=True),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("issue_date", sa.DateTime(), nullable=True),
            sa.Column("return_date", sa.DateTime(), nullable=True),
        )
    if not has_index(bind, "file_movements", "ix_file_movements_house_id"):
        op.create_index("ix_file_movements_house_id", "file_movements", ["house_id"])
    if not has_index(bind, "file_movements", "ix_file_movements_file_no"):
        op.create_index("ix_file_movements_file_no", "file_movements", ["file_no"])

def downgrade():
    bind = op.get_bind()
    if has_index(bind, "file_movements", "ix_file_movements_file_no"):
        op.drop_index("ix_file_movements_file_no", table_name="file_movements")
    if has_index(bind, "file_movements", "ix_file_movements_house_id"):
        op.drop_index("ix_file_movements_house_id", table_name="file_movements")
    if has_table(bind, "file_movements"):
        op.drop_table("file_movements")

    if has_index(bind, "allotments", "ix_allotments_house_active"):
        op.drop_index("ix_allotments_house_active", table_name="allotments")
    if has_index(bind, "allotments", "ix_allotments_house_id"):
        op.drop_index("ix_allotments_house_id", table_name="allotments")
    if has_table(bind, "allotments"):
        op.drop_table("allotments")

    if has_index(bind, "houses", "ix_houses_file_no"):
        op.drop_index("ix_houses_file_no", table_name="houses")
    if has_table(bind, "houses"):
        op.drop_table("houses")
