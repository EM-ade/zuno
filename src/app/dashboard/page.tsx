'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

type Section = 'create' | 'exhibition' | 'projects' | 'analytics';

interface UiCollection {
  id: string;
  name: string;
  symbol: string;
  description: string | null;
  total_supply: number;
  image_uri: string | null;
  candy_machine_id: string;
  creator_wallet: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  phases?: Array<{ name: string; price: number; start_time: string; end_time: string | null }>;
  mintCount?: number;
  progress?: number;
}

export default function Dashboard() {
  // Global UI
  const [section, setSection] = useState<Section>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Create Collection wizard state (preserved functionality)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [collectionName, setCollectionName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [totalSupply, setTotalSupply] = useState(0);
  const [royaltyPercentage, setRoyaltyPercentage] = useState(5);
  const [mintPrice, setMintPrice] = useState(0);
  const [mintPhases, setMintPhases] = useState([{ name: 'OG', price: 0, startTime: '' }]);
  const [imageData, setImageData] = useState<string>('');
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string>('');

  // Manage Projects + Analytics state
  const [myCollections, setMyCollections] = useState<UiCollection[]>([]);
  const [draftCollections, setDraftCollections] = useState<UiCollection[]>([]);
  const [completedCollections, setCompletedCollections] = useState<UiCollection[]>([]);

  // Exhibition planner state (UI-only)
  const [exhibitionTitle, setExhibitionTitle] = useState('');
  const [exhibitionDescription, setExhibitionDescription] = useState('');
  const [exhibitionStart, setExhibitionStart] = useState('');
  const [exhibitionEnd, setExhibitionEnd] = useState('');
  const [exhibitionBanner, setExhibitionBanner] = useState<string>('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  const { publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const handleConnectWallet = () => setVisible(true);
  const handleDisconnect = () => disconnect();

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setImageData(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const addMintPhase = () => setMintPhases([...mintPhases, { name: '', price: 0, startTime: '' }]);
  const updateMintPhase = (index: number, field: string, value: string | number) => {
    const updated = [...mintPhases];
    const updatedPhase = { ...updated[index], [field]: value };
    updated[index] = updatedPhase;
    setMintPhases(updated);
  };

  const handleDeploy = async () => {
    if (!publicKey) {
      setDeployError('Please connect your wallet first');
      return;
    }
    setDeploying(true);
    setDeployError('');
    try {
      const collectionData = {
        collectionName,
        symbol,
        description,
        totalSupply,
        royaltyPercentage,
        phases: mintPhases.map((p) => ({
          name: p.name,
          price: p.price,
          startTime: p.startTime ? new Date(p.startTime).toISOString() : new Date().toISOString(),
          endTime: p.startTime
            ? new Date(new Date(p.startTime).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
            : undefined,
        })),
        creatorWallet: publicKey.toString(),
        imageData,
      };
      const res = await fetch('/api/create-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectionData),
      });
      const result = await res.json();
      if (result.success) {
        window.location.href = `/mint/${result.candyMachineId}`;
      } else {
        setDeployError(result.error || 'Failed to deploy collection');
      }
    } catch (e) {
      console.error(e);
      setDeployError('An error occurred during deployment');
    } finally {
      setDeploying(false);
    }
  };

  // Load collections for Manage Projects and Analytics
  useEffect(() => {
    const loadCollections = async () => {
      if (!publicKey) return;
      try {
        setLoading(true);
        setError('');
        const statuses: Array<'active' | 'draft' | 'completed'> = ['active', 'draft', 'completed'];
        const [activeRes, draftRes, completedRes] = await Promise.all(
          statuses.map((s) => fetch(`/api/collections?creator=${publicKey.toString()}&status=${s}`))
        );
        const [activeJson, draftJson, completedJson] = await Promise.all([
          activeRes.json(),
          draftRes.json(),
          completedRes.json(),
        ]);
        if (!activeJson.success || !draftJson.success || !completedJson.success) {
          throw new Error('Failed to load collections');
        }
        setMyCollections(activeJson.collections || []);
        setDraftCollections(draftJson.collections || []);
        setCompletedCollections(completedJson.collections || []);
      } catch (e) {
        console.error(e);
        setError('Unable to load your projects');
      } finally {
        setLoading(false);
      }
    };
    loadCollections();
  }, [publicKey]);

  const analytics = useMemo(() => {
    const all = [...myCollections, ...completedCollections];
    const totalMints = all.reduce((acc, c) => acc + (c.mintCount || 0), 0);
    const totalSupply = all.reduce((acc, c) => acc + (c.total_supply || 0), 0);
    const progressPct = totalSupply > 0 ? Math.min(100, Math.round((totalMints / totalSupply) * 100)) : 0;
    // Simple revenue estimate: use first phase price if present
    const estRevenue = all.reduce((acc, c) => {
      const price = c.phases?.[0]?.price || 0;
      return acc + (c.mintCount || 0) * price;
    }, 0);
    return { totalMints, totalSupply, progressPct, estRevenue };
  }, [myCollections, completedCollections]);

  const brandBg = 'bg-[var(--zuno-blue)]';
  const brandPrimary = 'text-[var(--zuno-dark-blue)]';

  return (
    <div className={`min-h-screen ${brandBg}`}>
      {/* Top Nav */}
      <nav className="w-full border-b border-white/10 backdrop-blur-sm bg-white/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className={`text-2xl font-extrabold ${brandPrimary}`}>ZUNO</Link>
          <div className="flex items-center gap-2">
            {publicKey && (
              <span className="hidden sm:block text-sm text-black/70 bg-white/60 rounded-full px-3 py-1">
                {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
              </span>
            )}
            {publicKey ? (
              <button onClick={handleDisconnect} className="zuno-button zuno-button-secondary">Disconnect</button>
            ) : (
              <button onClick={handleConnectWallet} className="zuno-button zuno-button-primary">Connect Wallet</button>
            )}
          </div>
        </div>
      </nav>

      {/* Header + Tabs */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className={`text-3xl sm:text-4xl font-extrabold ${brandPrimary}`}>Creator Dashboard</h1>
            <p className="text-black/70 mt-1">Launch and manage your NFT drops, exhibitions, and insights in one place.</p>
          </div>
          <div className="flex items-center gap-2 bg-white/70 rounded-full p-1">
            {(
              [
                { key: 'create', label: 'Create Collection', emoji: '⊞' },
                { key: 'exhibition', label: 'Create Exhibition', emoji: '🖼' },
                { key: 'projects', label: 'Manage Projects', emoji: '📁' },
                { key: 'analytics', label: 'Analytics', emoji: '📊' },
              ] as Array<{ key: Section; label: string; emoji: string }>
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setSection(t.key)}
                className={`px-3 sm:px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  section === t.key ? 'bg-[var(--zuno-dark-blue)] text-white' : 'text-black/70 hover:text-black'
                }`}
              >
                <span className="mr-1">{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Create Collection Section */}
        {section === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left helper card */}
            <div className="zuno-card p-6 lg:col-span-1">
              <h3 className={`text-xl font-bold ${brandPrimary}`}>Ready to launch?</h3>
              <p className="text-black/70 mt-2">Follow the guided flow to set up your collection metadata, pricing, phases and deploy.</p>
              <button onClick={() => setShowCreateForm(true)} className="mt-4 zuno-button zuno-button-secondary w-full">Start Create Flow</button>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="bg-white/70 rounded-xl p-3">
                    <div className="text-sm font-semibold text-black/80">Step {n}</div>
                    <div className="text-xs text-black/60">{['Upload art/metadata','Configure pricing & supply','Preview mint page','Deploy 🚀'][n-1]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature / illustration */}
            <div className="zuno-card p-0 lg:col-span-2 overflow-hidden flex items-center justify-center bg-gradient-to-r from-[#8EC5FF] to-[#E0F0FF] min-h-[260px]">
              <div className="text-7xl">✨</div>
            </div>
          </div>
        )}

        {/* Exhibition planner */}
        {section === 'exhibition' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="zuno-card p-6 lg:col-span-2">
              <h3 className={`text-xl font-bold ${brandPrimary}`}>Create Exhibition</h3>
              <p className="text-black/70 text-sm mb-4">Curate multiple collections into a single showcase with a schedule and banner. (UI only)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-black/70 mb-1">Title</label>
                  <input value={exhibitionTitle} onChange={(e)=>setExhibitionTitle(e.target.value)} placeholder="Summer NFT Showcase 2024" className="w-full bg-white/80 border border-black/10 rounded-lg p-2 text-black placeholder-black/50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-black/70 mb-1">Banner</label>
                  <input type="file" accept="image/*" onChange={(e)=>{
                    const f=e.target.files?.[0];
                    if(!f) return; const r=new FileReader(); r.onload=(ev)=>setExhibitionBanner(ev.target?.result as string); r.readAsDataURL(f);
                  }} className="w-full bg-white/80 border border-black/10 rounded-lg p-2" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-black/70 mb-1">Description</label>
                  <textarea value={exhibitionDescription} onChange={(e)=>setExhibitionDescription(e.target.value)} rows={3} placeholder="A curated collection of the finest digital art pieces from emerging and established artists..." className="w-full bg-white/80 border border-black/10 rounded-lg p-2 text-black placeholder-black/50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-black/70 mb-1">Start</label>
                  <input type="datetime-local" value={exhibitionStart} onChange={(e)=>setExhibitionStart(e.target.value)} className="w-full bg-white/80 border border-black/10 rounded-lg p-2 text-black" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-black/70 mb-1">End</label>
                  <input type="datetime-local" value={exhibitionEnd} onChange={(e)=>setExhibitionEnd(e.target.value)} className="w-full bg-white/80 border border-black/10 rounded-lg p-2 text-black" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-black/70 mb-1">Select Collections</label>
                  <div className="flex flex-wrap gap-2">
                    {[...draftCollections, ...myCollections, ...completedCollections].map((c)=>{
                      const active = selectedCollections.includes(c.id);
                      return (
                        <button key={c.id} onClick={()=>{
                          setSelectedCollections((prev)=> active ? prev.filter(id=>id!==c.id) : [...prev, c.id]);
                        }} className={`px-3 py-2 rounded-full text-sm border ${active ? 'bg-[var(--zuno-dark-blue)] text-white border-transparent' : 'bg-white/80 text-black/80 border-black/10'}`}>
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button className="zuno-button zuno-button-secondary" onClick={()=>alert('This is a UI-only demo. Persisting exhibitions would require a new API/table.')}>Save Draft</button>
                <button className="zuno-button zuno-button-primary" onClick={()=>alert('Preview coming soon.')}>Preview</button>
              </div>
            </div>
            <div className="zuno-card p-6">
              <h4 className="font-semibold text-black/80 mb-2">Live Preview</h4>
              <div className="aspect-video w-full bg-white/60 rounded-lg overflow-hidden flex items-center justify-center">
                {exhibitionBanner ? (
                  <Image src={exhibitionBanner} alt="Banner" width={640} height={360} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">🖼️</span>
                )}
              </div>
              <div className="mt-3">
                <div className={`text-lg font-bold ${brandPrimary}`}>{exhibitionTitle || 'Untitled Exhibition'}</div>
                <div className="text-sm text-black/70">{exhibitionDescription || 'Add a compelling description to attract minters.'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Manage Projects */}
        {section === 'projects' && (
          <div>
            {error && <div className="mb-4 bg-red-100 text-red-700 px-4 py-2 rounded-lg">{error}</div>}
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xl font-bold ${brandPrimary}`}>Your Projects</h3>
              <div className="text-sm text-black/60">{loading ? 'Loading…' : `${myCollections.length + draftCollections.length + completedCollections.length} total`}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {['Active','Draft','Completed'].map((group, idx)=>{
                const list = idx===0? myCollections : idx===1? draftCollections : completedCollections;
                return (
                  <div key={group} className="zuno-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-black/70">{group}</div>
                      <div className="text-xs bg-white/70 px-2 py-1 rounded-full text-black/60">{list.length}</div>
                    </div>
                    {list.length===0 ? (
                      <div className="text-sm text-black/50">No {group.toLowerCase()} projects</div>
                    ) : (
                      <ul className="space-y-3">
                        {list.map((c)=> (
                          <li key={c.id} className="border border-black/10 rounded-xl p-3 bg-white/70">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-white rounded-lg overflow-hidden flex items-center justify-center">
                                {c.image_uri ? (
                                  <Image src={c.image_uri} alt={c.name} width={48} height={48} className="w-12 h-12 object-cover" />
                                ) : (
                                  <span className="text-xl">🎴</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-black/80 truncate">{c.name}</div>
                                <div className="text-xs text-black/60">{c.symbol} • {c.mintCount || 0}/{c.total_supply} minted</div>
                                <div className="w-full h-2 bg-black/10 rounded-full mt-2">
                                  <div className="h-2 bg-[var(--zuno-dark-blue)] rounded-full" style={{width: `${c.progress || 0}%`}} />
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-end gap-2">
                              <Link href={`/mint/${c.candy_machine_id}`} className="zuno-button zuno-button-primary text-xs">View Mint</Link>
                              <button className="zuno-button zuno-button-secondary text-xs" onClick={()=>alert('Phase editor coming soon')}>Edit Phases</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Analytics */}
        {section === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="zuno-card p-6">
              <div className="text-sm font-semibold text-black/60">Total Mints</div>
              <div className={`text-3xl font-extrabold ${brandPrimary}`}>{analytics.totalMints}</div>
            </div>
            <div className="zuno-card p-6">
              <div className="text-sm font-semibold text-black/60">Total Supply</div>
              <div className={`text-3xl font-extrabold ${brandPrimary}`}>{analytics.totalSupply}</div>
            </div>
            <div className="zuno-card p-6">
              <div className="text-sm font-semibold text-black/60">Estimated Revenue (SOL)</div>
              <div className={`text-3xl font-extrabold ${brandPrimary}`}>{analytics.estRevenue.toFixed(2)}</div>
            </div>

            <div className="zuno-card p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div className={`text-xl font-bold ${brandPrimary}`}>Mint Progress</div>
                <div className="text-sm text-black/60">{analytics.progressPct}%</div>
              </div>
              <div className="w-full h-3 bg-black/10 rounded-full overflow-hidden">
                <div className="h-3 bg-[var(--zuno-dark-blue)]" style={{width: `${analytics.progressPct}%`}} />
              </div>
              <ul className="mt-6 space-y-3">
                {[...myCollections, ...completedCollections].map((c)=> (
                  <li key={c.id} className="flex items-center gap-3">
                    <div className="text-xs w-28 truncate text-black/70">{c.name}</div>
                    <div className="flex-1 h-2 bg-black/10 rounded-full">
                      <div className="h-2 bg-[var(--zuno-dark-blue)] rounded-full" style={{width: `${c.progress || 0}%`}} />
                    </div>
                    <div className="text-xs text-black/60 w-24 text-right">{c.mintCount || 0}/{c.total_supply}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="zuno-card p-6">
              <div className={`text-xl font-bold ${brandPrimary} mb-3`}>Tips</div>
              <ul className="text-sm text-black/70 list-disc pl-5 space-y-1">
                <li>Use multiple mint phases (OG, WL, Public) to drive demand.</li>
                <li>Keep your banner and story consistent across channels.</li>
                <li>Monitor mint velocity and adjust pricing if needed.</li>
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* Create Collection Modal (wizard) */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto zuno-card p-6 bg-white">
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-bold ${brandPrimary}`}>Create Collection</h3>
              <button onClick={()=>setShowCreateForm(false)} className="text-black/60 hover:text-black text-2xl leading-none">×</button>
            </div>
            <div className="flex items-center gap-2 mb-6">
              {[1,2,3,4].map((n)=> (
                <div key={n} className={`flex-1 h-2 rounded-full ${activeStep>=n ? 'bg-[var(--zuno-dark-blue)]' : 'bg-black/10'}`} />
              ))}
            </div>

            {/* Step 1 */}
            {activeStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-black/70 mb-1">Upload Artwork</label>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full bg-white/80 border border-black/10 rounded-lg p-2 text-black" />
                  {imageData && <div className="text-green-600 text-sm mt-2">✓ Image uploaded</div>}
                </div>
                <div className="flex justify-end">
                  <button onClick={()=>setActiveStep(2)} className="zuno-button zuno-button-secondary">Next</button>
                </div>
              </div>
            )}

            {/* Step 2 */}
            {activeStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-black/70 mb-1">Collection Name</label>
                    <input value={collectionName} onChange={(e)=>setCollectionName(e.target.value)} placeholder="My Awesome NFT Collection" className="w-full bg-white/80 border border-black/10 rounded-lg p-2 text-black placeholder-black/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-black/70 mb-1">Symbol (3-5)</label>
                    <input value={symbol} maxLength={5} onChange={(e)=>setSymbol(e.target.value.toUpperCase())} className="w-full bg-white/80 border border-black/10 rounded-lg p-2 text-black placeholder-black/50" placeholder="MYNFT" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-black/70 mb-1">Description</label>
                    <textarea value={description} onChange={(e)=>setDescription(e.target.value)} rows={3} placeholder="A unique collection of 10,000 generative art pieces with rare traits and utility..." className="w-full bg-white/80 border border-black/10 rounded-lg p-2 text-black placeholder-black/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-black/70 mb-1">Total Supply</label>
                    <input type="number" min={1} value={totalSupply} onChange={(e)=>setTotalSupply(parseInt(e.target.value||'0'))} placeholder="10000" className="w-full bg-white/80 border border-black/10 rounded-lg p-2 text-black placeholder-black/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-black/70 mb-1">Royalty %</label>
                    <input type="number" min={0} max={10} step={0.1} value={royaltyPercentage} onChange={(e)=>setRoyaltyPercentage(parseFloat(e.target.value||'0'))} placeholder="5.0" className="w-full bg-white/80 border border-black/10 rounded-lg p-2 text-black placeholder-black/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-black/70 mb-1">Base Mint Price (SOL)</label>
                    <input type="number" min={0} step={0.01} value={mintPrice} onChange={(e)=>setMintPrice(parseFloat(e.target.value||'0'))} placeholder="0.5" className="w-full bg-white/80 border border-black/10 rounded-lg p-2 text-black placeholder-black/50" />
                  </div>
                </div>
                <div className="mt-6">
                  <div className={`text-sm font-semibold ${brandPrimary} mb-2`}>Mint Phases</div>
                  {mintPhases.map((phase, idx)=> (
                    <div key={idx} className="bg-white/70 border border-black/10 rounded-xl p-3 mb-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input value={phase.name} onChange={(e)=>updateMintPhase(idx,'name', e.target.value)} placeholder="Phase Name (OG/WL/Public)" className="bg-white/90 border border-black/10 rounded-lg p-2 text-black placeholder-black/50" />
                        <input type="number" value={phase.price} onChange={(e)=>updateMintPhase(idx,'price', parseFloat(e.target.value||'0'))} placeholder="0.3" className="bg-white/90 border border-black/10 rounded-lg p-2 text-black placeholder-black/50" />
                        <input type="datetime-local" value={phase.startTime} onChange={(e)=>updateMintPhase(idx,'startTime', e.target.value)} className="bg-white/90 border border-black/10 rounded-lg p-2 text-black" />
                      </div>
                    </div>
                  ))}
                  <button onClick={addMintPhase} className="zuno-button zuno-button-primary">Add Phase</button>
                </div>
                <div className="flex justify-between">
                  <button onClick={()=>setActiveStep(1)} className="zuno-button zuno-button-primary">Back</button>
                  <button onClick={()=>setActiveStep(3)} className="zuno-button zuno-button-secondary">Next</button>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {activeStep === 3 && (
              <div>
                <div className="zuno-card p-6 bg-white">
                  <div className="flex flex-col items-center">
                    {imageData ? (
                      <Image src={imageData} alt="preview" width={192} height={192} className="w-48 h-48 object-cover rounded-lg mb-4" />
                    ) : (
                      <div className="w-48 h-48 bg-black/10 rounded-lg mb-4" />
                    )}
                    <button className="zuno-button zuno-button-primary">MINT</button>
                  </div>
                </div>
                <div className="flex justify-between mt-6">
                  <button onClick={()=>setActiveStep(2)} className="zuno-button zuno-button-primary">Back</button>
                  <button onClick={()=>setActiveStep(4)} className="zuno-button zuno-button-secondary">Next</button>
                </div>
              </div>
            )}

            {/* Step 4 */}
            {activeStep === 4 && (
              <div className="space-y-4">
                <div className="zuno-card p-6 bg-white">
                  <div className="font-semibold text-black/80 mb-2">Your collection is ready to be deployed</div>
                  {deployError && <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg mb-3">{deployError}</div>}
                  <button onClick={handleDeploy} disabled={deploying || !publicKey} className="zuno-button zuno-button-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed">
                    {deploying ? 'Deploying…' : 'Deploy 🚀'}
                  </button>
                </div>
                <div className="flex justify-start">
                  <button onClick={()=>setActiveStep(3)} className="zuno-button zuno-button-primary">Back</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}