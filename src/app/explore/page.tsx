'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type StatusTab = 'live' | 'upcoming' | 'ended';
type DbStatus = 'active' | 'draft' | 'completed';

type Phase = {
  name: string;
  price: number;
  start_time: string;
  end_time: string | null;
};
type UiCollection = {
  id: string;
  name: string;
  symbol: string;
  description: string | null;
  total_supply: number;
  image_uri: string | null;
  collection_mint_address: string;
  candy_machine_id: string;
  creator_wallet: string;
  status: DbStatus;
  phases?: Phase[];
  mintCount?: number;
  progress?: number;
  created_at?: string;
};

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'ended', label: 'Ended' },
];

const tabToDb: Record<StatusTab, DbStatus> = {
  live: 'active',
  upcoming: 'draft',
  ended: 'completed',
};

const pageSize = 24;

const PINATA_GATEWAY = (process.env.NEXT_PUBLIC_PINATA_GATEWAY as string) || 'turquoise-cheerful-angelfish-408.mypinata.cloud';

function resolveImageUrl(u?: string) {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  if (u.startsWith('ipfs://')) {
    const cid = u.replace('ipfs://', '').replace(/^ipfs\//, '');
    return `https://${PINATA_GATEWAY}/ipfs/${cid}`;
  }
  if (/^\w{46,}$/.test(u)) {
    return `https://${PINATA_GATEWAY}/ipfs/${u}`;
  }
  return u;
}

export default function ExplorePage() {
  const [tab, setTab] = useState<StatusTab>('live');
  const [combined, setCombined] = useState<boolean>(true); // Active & Upcoming
  const [page, setPage] = useState<number>(1);
  const [queryInput, setQueryInput] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const [items, setItems] = useState<UiCollection[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [tab, combined, debouncedQuery]);

  // Debounce search input to avoid firing a request on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(queryInput.trim()), 350);
    return () => clearTimeout(t);
  }, [queryInput]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setLoading(true);
        setError('');

        // helper to fetch one status page
        const fetchStatus = async (s: DbStatus) => {
          const url = `/api/collections?status=${encodeURIComponent(s)}&page=${page}&limit=${pageSize}${
            debouncedQuery ? `&search=${encodeURIComponent(debouncedQuery)}` : ''
          }`;
          const res = await fetch(url, { signal: controller.signal });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || 'Failed to fetch collections');
          return json as {
            success: boolean;
            collections: UiCollection[];
            pagination: { totalPages: number; currentPage: number; totalItems: number };
          };
        };

        if (combined && (tab === 'live' || tab === 'upcoming')) {
          // Combined = Active & Upcoming (client merge). We fetch both and merge by created_at desc.
          const [activeRes, draftRes] = await Promise.all([fetchStatus('active'), fetchStatus('draft')]);
          const merged = [...(activeRes.collections || []), ...(draftRes.collections || [])]
            .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());

          // Client-side pagination for the merged result
          const start = (page - 1) * pageSize;
          const end = start + pageSize;
          const pageSlice = merged.slice(start, end);
          setItems(pageSlice);
          setTotalPages(Math.max(1, Math.ceil(merged.length / pageSize)));
        } else {
          // Single status from API (server pagination)
          const res = await fetchStatus(tabToDb[tab]);
          setItems(res.collections || []);
          setTotalPages(res.pagination?.totalPages || 1);
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          console.error(e);
          setError(e?.message || 'Failed to load explore data');
        }
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [tab, combined, page, debouncedQuery]);

  const featured = useMemo(() => items.slice(0, 3), [items]);
  const rest = useMemo(() => items.slice(3), [items]);

  return (
    <div className="min-h-screen bg-[var(--zuno-blue)]">
      {/* Header */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--zuno-dark-blue)]">Explore</h1>
            <p className="text-black/70 mt-1">
              Browse all collections. Filter by status and discover new drops.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search collections, symbols, descriptions"
                className="w-full bg-white/90 border border-black/10 rounded-full px-4 py-2 pr-10 text-black placeholder-black/50"
              />
              {queryInput && !loading && (
                <button
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-black/50 hover:text-black"
                  onClick={() => setQueryInput('')}
                >
                  ×
                </button>
              )}
              {loading && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 border-2 border-black/20 border-t-[var(--zuno-dark-blue)] rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Combined toggle */}
            <button
              onClick={() => setCombined((s) => !s)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${
                combined
                  ? 'bg-[var(--zuno-dark-blue)] text-white border-transparent'
                  : 'bg-white text-black/80 border-black/10'
              }`}
              title="Active & Upcoming combined view"
            >
              Active &amp; Upcoming
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-2 bg-white/70 rounded-full p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                tab === t.key ? 'bg-[var(--zuno-dark-blue)] text-white' : 'text-black/70 hover:text-black'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Error */}
        {error && <div className="mb-4 bg-red-100 text-red-700 px-4 py-2 rounded-lg">{error}</div>}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white/70 rounded-2xl p-4 border border-black/10 animate-pulse h-64" />
            ))}
          </div>
        )}

        {/* Launchpads (featured) */}
        {!loading && featured.length > 0 && (
          <>
            <h2 className="text-xl font-bold text-black/80 mb-3">Launchpads</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
              {featured.map((c) => (
                <CollectionCard key={c.id} item={c} />
              ))}
            </div>
          </>
        )}

        {/* Drops (rest) */}
        {!loading && (
          <>
            <h2 className="text-xl font-bold text-black/80 mb-3">Drops</h2>
            {rest.length === 0 ? (
              <div className="bg-white/70 rounded-2xl p-6 border border-black/10 text-black/60">
                No collections found for this filter.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {rest.map((c) => (
                  <CollectionCard key={c.id} item={c} compact />
                ))}
              </div>
            )}
          </>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              className="px-3 py-2 rounded-lg bg-white/80 border border-black/10 text-black/70 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Prev
            </button>
            <span className="text-black/70">
              Page {page} / {totalPages}
            </span>
            <button
              className="px-3 py-2 rounded-lg bg-white/80 border border-black/10 text-black/70 disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function statusBadgeText(dbStatus: DbStatus): string {
  switch (dbStatus) {
    case 'active':
      return 'Live';
    case 'draft':
      return 'Upcoming';
    case 'completed':
      return 'Ended';
    default:
      return '—';
  }
}

function firstPhasePrice(phases?: Phase[]): string {
  if (!phases?.length) return '—';
  const p = phases[0]?.price ?? 0;
  return p > 0 ? `${p} SOL` : '—';
}

function firstPhaseStart(phases?: Phase[]): string {
  if (!phases?.length) return '—';
  const s = phases[0]?.start_time;
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
  } catch {
    return '—';
  }
}

function CollectionCard({ item, compact = false }: { item: UiCollection; compact?: boolean }) {
  const progress = Math.max(0, Math.min(100, Math.round(item.progress || 0)));

  return (
    <div className="bg-white rounded-2xl border border-black/10 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="relative">
        <div className="aspect-square w-full bg-white flex items-center justify-center overflow-hidden">
          {item.image_uri ? (
            <Image
              src={resolveImageUrl(item.image_uri)}
              alt={item.name}
              width={600}
              height={600}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/70 text-3xl">🎴</div>
          )}
        </div>

        {/* Top-left pills like the reference (chain + status) */}
        <div className="absolute top-2 left-2 flex gap-2">
          <span className="px-2 py-1 rounded-md text-[10px] bg-white/80 text-black/70 border border-black/10">◎ Solana</span>
          <span className="px-2 py-1 rounded-md text-[10px] bg-white/80 text-black/70 border border-black/10">
            {statusBadgeText(item.status)}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="text-xs text-black/60 mb-1">Type: <span className="font-medium">Collection</span></div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-black/90 truncate">{item.name}</div>
          <div className="text-xs font-semibold text-black/60 truncate">{item.symbol}</div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="w-full h-2 bg-black/10 rounded-full overflow-hidden">
            <div className="h-2 bg-[var(--zuno-dark-blue)]" style={{ width: `${progress}%` }} />
          </div>
          {!compact && (
            <div className="mt-1 text-[11px] text-black/60">
              {item.mintCount || 0} / {item.total_supply}
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-black/70">
          <div>
            <div className="uppercase text-[10px]">Price</div>
            <div className="font-semibold">{firstPhasePrice(item.phases)}</div>
          </div>
          <div>
            <div className="uppercase text-[10px]">Supply</div>
            <div className="font-semibold">{item.total_supply}</div>
          </div>
          <div>
            <div className="uppercase text-[10px]">Start</div>
            <div className="font-semibold">{firstPhaseStart(item.phases)}</div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end">
          <Link
            className="zuno-button zuno-button-primary text-xs"
            href={`/mint/${item.collection_mint_address}`}
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}