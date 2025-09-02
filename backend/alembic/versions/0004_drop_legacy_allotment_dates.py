"""drop legacy start_date/end_date from allotments"""
from alembic import op
import sqlalchemy as sa

# IDs
revision = "0004_drop_legacy_allotment_dates"
down_revision = "0003_allotment_extra_fields"   # <- adjust if your previous revision id differs
branch_labels = None
depends_on = None

def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c['name'] for c in insp.get_columns('allotments')}
    with op.batch_alter_table('allotments') as b:
        if 'start_date' in cols:
            b.drop_column('start_date')
        if 'end_date' in cols:
            b.drop_column('end_date')

def downgrade():
    with op.batch_alter_table('allotments') as b:
        b.add_column(sa.Column('start_date', sa.Date(), nullable=True))
        b.add_column(sa.Column('end_date', sa.Date(), nullable=True))
