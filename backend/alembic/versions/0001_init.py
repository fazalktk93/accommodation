"""initial tables

Revision ID: 0001_init
Revises:
Create Date: 2025-09-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '0001_init'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'houses',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=120), nullable=False, unique=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_houses_id', 'houses', ['id'])
    op.create_index('ix_houses_name', 'houses', ['name'])

    op.create_table(
        'allotments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('person_name', sa.String(length=120), nullable=False),
        sa.Column('person_contact', sa.String(length=120), nullable=True),
        sa.Column('start_date', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('end_date', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('house_id', sa.Integer(), sa.ForeignKey('houses.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_index('ix_allotments_id', 'allotments', ['id'])
    op.create_index('ix_allotments_house_id', 'allotments', ['house_id'])
    op.create_index('ix_allotments_end_date', 'allotments', ['end_date'])

    op.create_table(
        'file_movements',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('file_code', sa.String(length=120), nullable=False),
        sa.Column('subject', sa.String(length=255), nullable=True),
        sa.Column('issued_to', sa.String(length=120), nullable=False),
        sa.Column('department', sa.String(length=120), nullable=True),
        sa.Column('issue_date', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('return_date', sa.DateTime(), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
    )
    op.create_index('ix_file_movements_id', 'file_movements', ['id'])
    op.create_index('ix_file_movements_file_code', 'file_movements', ['file_code'])
    op.create_index('ix_file_movements_return_date', 'file_movements', ['return_date'])

def downgrade():
    op.drop_table('file_movements')
    op.drop_table('allotments')
    op.drop_table('houses')
