"""add full allotment fields and superannuation auto

Revision ID: 0003_allotment_full_fields
Revises: 0002_house_fields
Create Date: 2025-09-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '0003_allotment_full_fields'
down_revision = '0002_house_fields'
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table('allotments') as batch:
        # linkage already exists (house_id)
        # add new columns (nullable first for sqlite)
        batch.add_column(sa.Column('allottee_name', sa.String(length=160), nullable=True))
        batch.add_column(sa.Column('designation', sa.String(length=160), nullable=True))
        batch.add_column(sa.Column('bps', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('directorate', sa.String(length=160), nullable=True))
        batch.add_column(sa.Column('cnic', sa.String(length=25), nullable=True))
        batch.add_column(sa.Column('allotment_date', sa.Date(), nullable=True))
        batch.add_column(sa.Column('date_of_birth', sa.Date(), nullable=True))
        batch.add_column(sa.Column('pool', sa.String(length=80), nullable=True))
        batch.add_column(sa.Column('qtr_status', sa.String(length=80), nullable=True))
        batch.add_column(sa.Column('accommodation_type', sa.String(length=120), nullable=True))
        batch.add_column(sa.Column('occupation_date', sa.Date(), nullable=True))
        batch.add_column(sa.Column('allotment_medium', sa.String(length=120), nullable=True))
        batch.add_column(sa.Column('vacation_date', sa.Date(), nullable=True))
        batch.add_column(sa.Column('superannuation_date', sa.Date(), nullable=True))
        batch.add_column(sa.Column('active', sa.Boolean(), server_default="1", nullable=False))

        # legacy columns that may exist from earlier scaffolding:
        # keep notes, end_date; remove person_name/contact if they exist
        try:
            batch.drop_column('person_name')
        except Exception:
            pass
        try:
            batch.drop_column('person_contact')
        except Exception:
            pass
        try:
            batch.drop_column('start_date')
        except Exception:
            pass

    # add indexes
    op.create_index('ix_allotments_allottee_name', 'allotments', ['allottee_name'])
    op.create_index('ix_allotments_bps', 'allotments', ['bps'])
    op.create_index('ix_allotments_directorate', 'allotments', ['directorate'])
    op.create_index('ix_allotments_cnic', 'allotments', ['cnic'])
    op.create_index('ix_allotments_allotment_date', 'allotments', ['allotment_date'])
    op.create_index('ix_allotments_date_of_birth', 'allotments', ['date_of_birth'])
    op.create_index('ix_allotments_pool', 'allotments', ['pool'])
    op.create_index('ix_allotments_qtr_status', 'allotments', ['qtr_status'])
    op.create_index('ix_allotments_accommodation_type', 'allotments', ['accommodation_type'])
    op.create_index('ix_allotments_occupation_date', 'allotments', ['occupation_date'])
    op.create_index('ix_allotments_vacation_date', 'allotments', ['vacation_date'])
    op.create_index('ix_allotments_superannuation_date', 'allotments', ['superannuation_date'])
    op.create_index('ix_allotments_active', 'allotments', ['active'])

def downgrade():
    # drop what we added
    for ix in [
        'ix_allotments_allottee_name','ix_allotments_bps','ix_allotments_directorate','ix_allotments_cnic',
        'ix_allotments_allotment_date','ix_allotments_date_of_birth','ix_allotments_pool','ix_allotments_qtr_status',
        'ix_allotments_accommodation_type','ix_allotments_occupation_date','ix_allotments_vacation_date',
        'ix_allotments_superannuation_date','ix_allotments_active'
    ]:
        try:
            op.drop_index(ix)
        except Exception:
            pass
    with op.batch_alter_table('allotments') as batch:
        for col in [
            'allottee_name','designation','bps','directorate','cnic','allotment_date','date_of_birth','pool',
            'qtr_status','accommodation_type','occupation_date','allotment_medium','vacation_date',
            'superannuation_date','active'
        ]:
            try:
                batch.drop_column(col)
            except Exception:
                pass
