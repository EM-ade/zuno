-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.collections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  collection_mint_address text NOT NULL UNIQUE,
  candy_machine_id text,
  name text NOT NULL,
  symbol text,
  description text,
  image_uri text,
  creator_wallet text NOT NULL,
  update_authority text,
  price numeric DEFAULT 0,
  total_supply integer DEFAULT 0,
  minted_count integer DEFAULT 0,
  royalty_percentage numeric DEFAULT 5.0,
  status text DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'live'::text, 'completed'::text, 'paused'::text, 'sold_out'::text])),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT collections_pkey PRIMARY KEY (id)
);
CREATE TABLE public.items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  collection_id uuid,
  collection_address text NOT NULL,
  name text NOT NULL,
  description text,
  image_uri text,
  metadata_uri text,
  attributes jsonb DEFAULT '[]'::jsonb,
  item_index integer,
  minted boolean DEFAULT false,
  owner_wallet text,
  mint_signature text,
  nft_address text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  reserved_until timestamp with time zone,
  CONSTRAINT items_pkey PRIMARY KEY (id),
  CONSTRAINT items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id)
);
CREATE TABLE public.mint_phases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  collection_id uuid,
  name text NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone,
  price numeric NOT NULL,
  mint_limit integer,
  created_at timestamp with time zone DEFAULT now(),
  phase_type USER-DEFINED NOT NULL CHECK (phase_type = ANY (ARRAY['public'::phase_type_enum, 'whitelist'::phase_type_enum, 'og'::phase_type_enum, 'custom'::phase_type_enum])),
  allowed_wallets ARRAY,
  unlimited_mint boolean,
  CONSTRAINT mint_phases_pkey PRIMARY KEY (id),
  CONSTRAINT mint_phases_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id)
);
CREATE TABLE public.mint_requests (
  idempotency_key uuid NOT NULL,
  request_body jsonb NOT NULL,
  response_body jsonb,
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT mint_requests_pkey PRIMARY KEY (idempotency_key)
);
CREATE TABLE public.mint_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  collection_id uuid,
  phase_id uuid,
  buyer_wallet text NOT NULL,
  seller_wallet text,
  transaction_signature text UNIQUE,
  quantity integer DEFAULT 1,
  nft_price numeric,
  platform_fee numeric,
  total_paid numeric,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'refunded'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT mint_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT mint_transactions_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id),
  CONSTRAINT mint_transactions_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.mint_phases(id)
);
CREATE TABLE public.nft_reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_token_id uuid,
  item_id uuid UNIQUE,
  reserved_at timestamp with time zone DEFAULT now(),
  confirmed boolean DEFAULT false,
  confirmed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nft_reservations_pkey PRIMARY KEY (id),
  CONSTRAINT nft_reservations_reservation_token_id_fkey FOREIGN KEY (reservation_token_id) REFERENCES public.reservation_tokens(id),
  CONSTRAINT nft_reservations_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);
CREATE TABLE public.phases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL,
  name text NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone,
  price numeric NOT NULL,
  allow_list jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT phases_pkey PRIMARY KEY (id),
  CONSTRAINT phases_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id)
);
CREATE TABLE public.reservation_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  token character varying NOT NULL UNIQUE,
  buyer_wallet text NOT NULL,
  collection_id uuid,
  quantity integer NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reservation_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT reservation_tokens_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id)
);
CREATE TABLE public.whitelist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phase_id uuid,
  wallet_address text NOT NULL,
  mint_limit integer DEFAULT 1,
  minted_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT whitelist_pkey PRIMARY KEY (id),
  CONSTRAINT whitelist_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.mint_phases(id)
);