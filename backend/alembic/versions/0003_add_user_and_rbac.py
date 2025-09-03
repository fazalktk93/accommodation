"""add user and rbac

Revision ID: 0003_add_user_and_rbac
Revises: 0002_add_house_fields_and_allotment_period
Create Date: 2025-09-04
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0003_add_user_and_rbac'
down_revision = '0002_add_house_fields_and_allotment_period'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'user',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('username', sa.String(), nullable=False, unique=True),
        sa.Column('full_name', sa.String(), nullable=True),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.sql.expression.true()),
        sa.Column('role', sa.String(), nullable=False, server_default='viewer'),
        sa.Column('permissions', sa.JSON(), nullable=True),
    )
    op.create_index('ix_user_username', 'user', ['username'], unique=True)

def downgrade():
    op.drop_table('user')
