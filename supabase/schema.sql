-- Plugga / Supabase schema
-- Paste this into the Supabase SQL Editor and run it once per project.

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  filename text not null,
  storage_path text not null,
  mime_type text,
  byte_size bigint,
  extraction_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists documents_user_id_idx on public.documents (user_id);

-- ---------------------------------------------------------------------------
-- Document chunks + pgvector embeddings (OpenAI text-embedding-3-small = 1536)
-- ---------------------------------------------------------------------------
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_document_id_idx
  on public.document_chunks (document_id);

create index if not exists document_chunks_user_id_idx
  on public.document_chunks (user_id);

create index if not exists document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_document_id uuid,
  match_user_id uuid,
  match_count integer default 8
)
returns table (
  id uuid,
  content text,
  chunk_index integer,
  similarity float
)
language sql
stable
as $$
  select
    dc.id,
    dc.content,
    dc.chunk_index,
    (1 - (dc.embedding <=> query_embedding))::float as similarity
  from public.document_chunks dc
  where dc.document_id = match_document_id
    and dc.user_id = match_user_id
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- ---------------------------------------------------------------------------
-- Quiz sessions
-- ---------------------------------------------------------------------------
create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  progress integer not null default 0,
  score integer,
  history jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  status text not null default 'in_progress',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quiz_sessions_user_id_idx on public.quiz_sessions (user_id);

-- ---------------------------------------------------------------------------
-- Shopify customer linkage (app user <-> Shopify customer)
-- ---------------------------------------------------------------------------
create table if not exists public.shopify_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  shopify_customer_id text not null,
  shop_domain text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopify_customers_shop_idx
  on public.shopify_customers (shop_domain, shopify_customer_id);

-- Shop installs (OAuth / Admin token). Tokens are server-only; no user policies.
create table if not exists public.shopify_installs (
  id uuid primary key default gen_random_uuid(),
  shop_domain text not null unique,
  access_token text not null,
  scope text,
  connection_method text not null default 'oauth',
  shop_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.shopify_customers enable row level security;
alter table public.shopify_installs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "documents_own" on public.documents;
create policy "documents_own"
  on public.documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "document_chunks_own" on public.document_chunks;
create policy "document_chunks_own"
  on public.document_chunks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "quiz_sessions_own" on public.quiz_sessions;
create policy "quiz_sessions_own"
  on public.quiz_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "shopify_customers_own" on public.shopify_customers;
create policy "shopify_customers_own"
  on public.shopify_customers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- shopify_installs: no anon/authenticated policies — only service_role (RLS bypass).

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded study files
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents_storage_select_own" on storage.objects;
create policy "documents_storage_select_own"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "documents_storage_insert_own" on storage.objects;
create policy "documents_storage_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "documents_storage_update_own" on storage.objects;
create policy "documents_storage_update_own"
  on storage.objects for update
  using (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "documents_storage_delete_own" on storage.objects;
create policy "documents_storage_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
