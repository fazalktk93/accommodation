"""add house fields street type_code status

Revision ID: 0002_add_house_fields
Revises: 0001_baseline
Create Date: 2025-09-02 00:00:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002_add_house_fields'
down_revision = '0001_baseline'
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table('houses') as b:
        b.add_column(sa.Column('street', sa.String(length=120), nullable=False, server_default=''))
        b.add_column(sa.Column('type_code', sa.String(length=1), nullable=False, server_default='A'))
        b.add_column(sa.Column('status', sa.String(length=32), nullable=False, server_default='available'))
    with op.batch_alter_table('houses') as b:
        b.alter_column('street', server_default=None)
        b.alter_column('type_code', server_default=None)
        b.alter_column('status', server_default=None)

def downgrade():
    with op.batch_alter_table('houses') as b:
        b.drop_column('status')
        b.drop_column('type_code')
        b.drop_column('street')
