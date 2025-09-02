"""sync allotments table with models (add missing columns if not exists)

Revision ID: 0005_sync_allotments_columns
Revises: 0004_one_outstanding_per_house
Create Date: 2025-09-02 00:00:00
"""
from alembic import op
import sqlalchemy as sa

# IDs
revision = "0005_sync_allotments_columns"
down_revision = "0004_one_outstanding_per_house"
branch_labels = None
depends_on = None

def upgrade():
    # Use raw SQL so we can do IF NOT EXISTS (Postgres)
    op.execute("""
        ALTER TABLE allotments
            ADD COLUMN IF NOT EXISTS person_name varchar(120) NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS cnic varchar(20),
            ADD COLUMN IF NOT EXISTS start_date date NOT NULL DEFAULT CURRENT_DATE,
            ADD COLUMN IF NOT EXISTS end_date date,
            ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
            ADD COLUMN IF NOT EXISTS notes text;
    """)
    # optional: drop the temporary defaults to avoid implicit values on future inserts
    op.execute("""
        ALTER TABLE allotments
            ALTER COLUMN person_name DROP DEFAULT,
            ALTER COLUMN start_date DROP DEFAULT;
    """)

def downgrade():
    # Only drop if columns exist; safe for Postgres
    op.execute("""
        ALTER TABLE allotments
            DROP COLUMN IF EXISTS notes,
            DROP COLUMN IF EXISTS active,
            DROP COLUMN IF EXISTS end_date,
            DROP COLUMN IF EXISTS start_date,
            DROP COLUMN IF EXISTS cnic,
            DROP COLUMN IF EXISTS person_name;
    """)
