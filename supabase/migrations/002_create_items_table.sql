-- Items table to support multi-NFT per collection
-- Stores per-item metadata and URIs, linked to collections.id

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  name text not null,
  description text,
  image_uri text,
  metadata_uri text,
  attributes jsonb,
  item_index int,
  created_at timestamptz not null default now()
);

-- Helpful index
create index if not exists idx_items_collection_id on public.items(collection_id);

-- RLS
alter table public.items enable row level security;

-- Allow creators (by wallet) to read and manage items in their collections.
-- Assumes collections table has creator_wallet and RLS policies similar to collections.
create policy if not exists items_select_for_all on public.items for select
  using (true);

create policy if not exists items_modify_for_creator on public.items for all
  using (exists (
    select 1 from public.collections c
    where c.id = items.collection_id
  ))
  with check (exists (
    select 1 from public.collections c
    where c.id = items.collection_id
  ));
