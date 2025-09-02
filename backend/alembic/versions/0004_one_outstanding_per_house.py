"""ensure one outstanding movement per house (postgres only)

Revision ID: 0004_one_outstanding_per_house
Revises: 0003_allotment_full_fields
Create Date: 2025-09-02 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '0004_one_outstanding_per_house'
down_revision = '0003_allotment_full_fields'
branch_labels = None
depends_on = None

def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.create_index(
            'uq_file_movements_one_outstanding_per_house',
            'file_movements',
            ['house_id'],
            unique=True,
            postgresql_where=sa.text('return_date IS NULL')
        )

def downgrade():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.drop_index('uq_file_movements_one_outstanding_per_house', table_name='file_movements')
