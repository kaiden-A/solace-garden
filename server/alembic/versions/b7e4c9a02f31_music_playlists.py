"""music playlists

Revision ID: b7e4c9a02f31
Revises: 0155c0c6e84b
Create Date: 2026-09-19 10:12:44.508217

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = 'b7e4c9a02f31'
down_revision: str | None = '0155c0c6e84b'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Autogenerate also wanted to drop/recreate the FKs on users/plants/gifts
    # (schema-qualified referents look "changed" to it). Those are untouched;
    # this migration only adds the two playlist tables.
    op.create_table('music_playlists',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['public.users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    schema='public'
    )
    op.create_index(op.f('ix_public_music_playlists_user_id'), 'music_playlists', ['user_id'], unique=False, schema='public')
    op.create_table('music_playlist_items',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('playlist_id', sa.Uuid(), nullable=False),
    sa.Column('video_id', sa.String(length=20), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['playlist_id'], ['public.music_playlists.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('playlist_id', 'video_id', name='uq_music_playlist_items_video'),
    schema='public'
    )
    op.create_index('ix_music_playlist_items_order', 'music_playlist_items', ['playlist_id', 'position'], unique=False, schema='public')


def downgrade() -> None:
    op.drop_index('ix_music_playlist_items_order', table_name='music_playlist_items', schema='public')
    op.drop_table('music_playlist_items', schema='public')
    op.drop_index(op.f('ix_public_music_playlists_user_id'), table_name='music_playlists', schema='public')
    op.drop_table('music_playlists', schema='public')
