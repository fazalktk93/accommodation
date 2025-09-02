"""add extended allotment fields"""
from alembic import op
import sqlalchemy as sa

revision = '0003_allotment_extra_fields'
down_revision = '0002_add_house_fields'
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table('allotments') as b:
        b.add_column(sa.Column('designation', sa.String(length=120), nullable=True))
        b.add_column(sa.Column('bps', sa.Integer(), nullable=True))
        b.add_column(sa.Column('directorate', sa.String(length=120), nullable=True))
        b.add_column(sa.Column('allotment_date', sa.Date(), nullable=True))
        b.add_column(sa.Column('date_of_birth', sa.Date(), nullable=True))
        b.add_column(sa.Column('date_of_retirement', sa.Date(), nullable=True))
        b.add_column(sa.Column('occupation_date', sa.Date(), nullable=True))
        b.add_column(sa.Column('vacation_date', sa.Date(), nullable=True))
        b.add_column(sa.Column('retention', sa.Boolean(), nullable=True))
        b.add_column(sa.Column('retention_last_date', sa.Date(), nullable=True))
        b.add_column(sa.Column('pool', sa.String(length=60), nullable=True))
        b.add_column(sa.Column('qtr_status', sa.String(length=60), nullable=True))
        b.add_column(sa.Column('allotment_medium', sa.String(length=60), nullable=True))

def downgrade():
    with op.batch_alter_table('allotments') as b:
        b.drop_column('allotment_medium')
        b.drop_column('qtr_status')
        b.drop_column('pool')
        b.drop_column('retention_last_date')
        b.drop_column('retention')
        b.drop_column('vacation_date')
        b.drop_column('occupation_date')
        b.drop_column('date_of_retirement')
        b.drop_column('date_of_birth')
        b.drop_column('allotment_date')
        b.drop_column('directorate')
        b.drop_column('bps')
        b.drop_column('designation')
