"""switch houses to file_no/qtr_no/sector

Revision ID: 0002_house_fields
Revises: 0001_init
Create Date: 2025-09-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '0002_house_fields'
down_revision = '0001_init'
branch_labels = None
depends_on = None

def upgrade():
    # SQLite needs batch_alter_table for dropping columns
    with op.batch_alter_table('houses') as batch:
        # Add new columns
        batch.add_column(sa.Column('file_no', sa.String(length=120), nullable=True))
        batch.add_column(sa.Column('qtr_no', sa.String(length=120), nullable=True))
        batch.add_column(sa.Column('sector', sa.String(length=120), nullable=True))

    # If you're migrating data from old columns (name/address) you could do it here with UPDATEs.
    # For a clean start, skip.

    # Make new columns non-null and add index/unique
    with op.batch_alter_table('houses') as batch:
        batch.create_index('ix_houses_file_no', ['file_no'])
        batch.alter_column('file_no', existing_type=sa.String(length=120), nullable=False)
        batch.alter_column('qtr_no', existing_type=sa.String(length=120), nullable=False)
        batch.alter_column('sector', existing_type=sa.String(length=120), nullable=False)

    # Drop old columns if present
    with op.batch_alter_table('houses') as batch:
        for col in ('name', 'address'):
            try:
                batch.drop_column(col)
            except Exception:
                pass  # ignore if not there

def downgrade():
    with op.batch_alter_table('houses') as batch:
        for col in ('sector', 'qtr_no', 'file_no'):
            try:
                batch.drop_column(col)
            except Exception:
                pass
    # Optionally recreate old columns (name/address) here
