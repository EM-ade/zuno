'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, Users, DollarSign, Plus, Trash2 } from 'lucide-react'
import { Phase } from '@/types'; // Import Phase from central types file

interface PhaseManagerProps {
  collectionId?: string
  onPhasesChange: (phases: Phase[]) => void
  initialPhases?: Phase[]
}

export default function PhaseManager({ collectionId, onPhasesChange, initialPhases = [] }: PhaseManagerProps) {
  const [phases, setPhases] = useState<Phase[]>(initialPhases)
  const [showAddPhase, setShowAddPhase] = useState(false)
  
  // Default phase templates
  const phaseTemplates = [
    { name: 'OG Mint', phase_type: 'og' as const, price: 0.5, duration: 24 },
    { name: 'Whitelist', phase_type: 'whitelist' as const, price: 0.75, duration: 48 },
    { name: 'Public Sale', phase_type: 'public' as const, price: 1.0, duration: 0 },
  ]

  const [newPhase, setNewPhase] = useState<Phase>({
    name: '',
    phase_type: 'public',
    price: 0,
    start_time: new Date().toISOString().slice(0, 16),
    mint_limit: undefined,
    allowed_wallets: []
  })

  const [walletInput, setWalletInput] = useState('')

  useEffect(() => {
    onPhasesChange(phases)
  }, [phases])

  const addPhase = () => {
    if (!newPhase.name || newPhase.price < 0) {
      alert('Please fill in all required fields')
      return
    }

    const phase: Phase = {
      ...newPhase,
      id: Date.now().toString(),
      allowed_wallets: newPhase.allowed_wallets?.length ? newPhase.allowed_wallets : undefined
    }

    setPhases([...phases, phase])
    setNewPhase({
      name: '',
      phase_type: 'public',
      price: 0,
      start_time: new Date().toISOString().slice(0, 16),
      mint_limit: undefined,
      allowed_wallets: []
    })
    setWalletInput('')
    setShowAddPhase(false)
  }

  const removePhase = (id: string) => {
    setPhases(phases.filter(p => p.id !== id))
  }

  const addWallet = () => {
    if (walletInput && walletInput.length === 44) { // Solana wallet length
      setNewPhase({
        ...newPhase,
        allowed_wallets: [...(newPhase.allowed_wallets || []), walletInput]
      })
      setWalletInput('')
    } else {
      alert('Please enter a valid Solana wallet address')
    }
  }

  const removeWallet = (wallet: string) => {
    setNewPhase({
      ...newPhase,
      allowed_wallets: newPhase.allowed_wallets?.filter(w => w !== wallet)
    })
  }

  const applyTemplate = (template: typeof phaseTemplates[0]) => {
    const startTime = new Date()
    const endTime = template.duration > 0 
      ? new Date(startTime.getTime() + template.duration * 60 * 60 * 1000)
      : undefined

    setNewPhase({
      name: template.name,
      phase_type: template.phase_type,
      price: template.price,
      start_time: startTime.toISOString().slice(0, 16),
      end_time: endTime?.toISOString().slice(0, 16),
      mint_limit: template.phase_type === 'public' ? undefined : 100,
      allowed_wallets: []
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Mint Phases</h3>
        <button
          onClick={() => setShowAddPhase(!showAddPhase)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Phase
        </button>
      </div>

      {/* Current Phases */}
      <div className="space-y-3">
        {phases.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No phases added yet</p>
            <p className="text-sm text-gray-400 mt-2">Add at least one phase to enable minting</p>
          </div>
        ) : (
          phases.map((phase) => (
            <div key={phase.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium text-gray-900">{phase.name}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      phase.phase_type === 'og' ? 'bg-purple-100 text-purple-700' :
                      phase.phase_type === 'whitelist' ? 'bg-blue-100 text-blue-700' :
                      phase.phase_type === 'public' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {phase.phase_type.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <DollarSign className="w-4 h-4" />
                      <span>{phase.price} SOL</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(phase.start_time).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(phase.start_time).toLocaleTimeString()}</span>
                    </div>
                    
                    {phase.allowed_wallets && phase.allowed_wallets.length > 0 && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>{phase.allowed_wallets.length} wallets</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => removePhase(phase.id!)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Phase Form */}
      {showAddPhase && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
          <h4 className="font-medium text-gray-900">Add New Phase</h4>
          
          {/* Templates */}
          <div className="flex gap-2">
            {phaseTemplates.map((template) => (
              <button
                key={template.name}
                onClick={() => applyTemplate(template)}
                className="px-3 py-1 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {template.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phase Name *
              </label>
              <input
                type="text"
                value={newPhase.name}
                onChange={(e) => setNewPhase({ ...newPhase, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                placeholder="e.g., OG Mint, Genesis Sale"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phase Type *
              </label>
              <select
                value={newPhase.phase_type}
                onChange={(e) => setNewPhase({ ...newPhase, phase_type: e.target.value as Phase['phase_type'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              >
                <option value="og">OG</option>
                <option value="whitelist">Whitelist</option>
                <option value="public">Public</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price (SOL) *
              </label>
              <input
                type="text" // Changed to text
                value={newPhase.price.toString()} // Convert number to string
                onChange={(e) => {
                  const value = e.target.value;
                  setNewPhase({ ...newPhase, price: value === '' ? 0 : (parseFloat(value) || 0) });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-black text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                min="0"
                step="0.01"
                inputMode="decimal" // Suggest decimal keyboard
                pattern="[0-9]*[.]?[0-9]*" // Allow numbers and a decimal point
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mint Limit (per wallet)
              </label>
              <input
                type="text" // Changed to text
                value={newPhase.mint_limit === undefined ? '' : newPhase.mint_limit.toString()} // Handle undefined state
                onChange={(e) => {
                  const value = e.target.value;
                  setNewPhase({ ...newPhase, mint_limit: value === '' ? undefined : (parseInt(value) || undefined) });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-black text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                min="1"
                placeholder="No limit"
                inputMode="numeric" // Suggest numeric keyboard
                pattern="[0-9]*" // Allow only numbers
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date & Time *
              </label>
              <input
                type="datetime-local"
                value={newPhase.start_time ? newPhase.start_time.slice(0, 16) : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const localDate = new Date(e.target.value);
                    setNewPhase({ ...newPhase, start_time: localDate.toISOString() });
                  } else {
                    // If input is cleared, default to current time as a valid ISO string
                    setNewPhase({ ...newPhase, start_time: new Date().toISOString() });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date & Time (optional)
              </label>
              <input
                type="datetime-local"
                value={newPhase.end_time ? newPhase.end_time.slice(0, 16) : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const localDate = new Date(e.target.value);
                    setNewPhase({ ...newPhase, end_time: localDate.toISOString() });
                  } else {
                    setNewPhase({ ...newPhase, end_time: undefined });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              />
            </div>
          </div>

          {/* Allowed Wallets (for non-public phases) */}
          {newPhase.phase_type !== 'public' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Allowed Wallets (optional - if empty, all can mint)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={walletInput}
                  onChange={(e) => setWalletInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  placeholder="Enter Solana wallet address"
                />
                <button
                  onClick={addWallet}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Add
                </button>
              </div>
              
              {newPhase.allowed_wallets && newPhase.allowed_wallets.length > 0 && (
                <div className="mt-2 space-y-1">
                  {newPhase.allowed_wallets.map((wallet) => (
                    <div key={wallet} className="flex items-center justify-between bg-white px-3 py-2 rounded">
                      <span className="text-sm text-gray-600 font-mono truncate">{wallet}</span>
                      <button
                        onClick={() => removeWallet(wallet)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowAddPhase(false)}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={addPhase}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Phase
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
