"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, Users, DollarSign, Plus, Trash2 } from "lucide-react";
import { Phase } from "@/types";

interface PhaseManagerProps {
  collectionId?: string;
  onPhasesChange: (phases: Phase[]) => void;
  initialPhases?: Phase[];
}

export default function PhaseManager({
  collectionId,
  onPhasesChange,
  initialPhases = [],
}: PhaseManagerProps) {
  const [phases, setPhases] = useState<Phase[]>(initialPhases);
  const [showAddPhase, setShowAddPhase] = useState(false);

  const phaseTemplates = [
    { name: "OG Mint", phase_type: "og" as const, price: 0.5, duration: 24 },
    {
      name: "Whitelist",
      phase_type: "whitelist" as const,
      price: 0.75,
      duration: 48,
    },
    {
      name: "Public Sale",
      phase_type: "public" as const,
      price: 1.0,
      duration: 0,
    },
  ];

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentTime = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const [newPhase, setNewPhase] = useState<
    Phase & {
      startDate: string;
      startTime: string;
    }
  >({
    // Extended state for separate date/time inputs
    name: "",
    phase_type: "public",
    price: 0,
    start_time: "",
    end_time: undefined,
    mint_limit: undefined,
    allowed_wallets: [],
    startDate: today,
    startTime: currentTime,
  });

  // Helper function to determine phase status
  const getPhaseStatus = (phase: Phase) => {
    const now = new Date();
    const startTime = new Date(phase.start_time);

    if (now < startTime) return "upcoming";
    return "live"; // No end time, so phases are either upcoming or live
  };

  // Helper function to format time
  const formatLocaleTime = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  useEffect(() => {
    onPhasesChange(phases);
  }, [phases]);

  const addPhase = () => {
    if (!newPhase.name || newPhase.price < 0) {
      alert("Please fill in all required fields");
      return;
    }

    // Combine date and time inputs into ISO strings
    const startDateTime =
      newPhase.startDate && newPhase.startTime
        ? new Date(`${newPhase.startDate}T${newPhase.startTime}`).toISOString()
        : new Date().toISOString(); // Fallback if not provided

    const phase: Phase = {
      ...newPhase,
      id: Date.now().toString(),
      start_time: startDateTime,
      end_time: undefined, // No end time needed
      allowed_wallets: newPhase.allowed_wallets?.length
        ? newPhase.allowed_wallets
        : undefined,
    };

    setPhases([...phases, phase]);
    // Reset new phase state
    setNewPhase({
      name: "",
      phase_type: "public",
      price: 0,
      start_time: "",
      end_time: undefined,
      mint_limit: undefined,
      allowed_wallets: [],
      startDate: today,
      startTime: currentTime,
    });

    setShowAddPhase(false);
  };

  const removePhase = (id: string) => {
    setPhases(phases.filter((p) => p.id !== id));
  };

  const applyTemplate = (template: (typeof phaseTemplates)[0]) => {
    const start = new Date();

    setNewPhase((prev) => ({
      ...prev,
      name: template.name,
      phase_type: template.phase_type,
      price: template.price,
      start_time: start.toISOString(),
      end_time: undefined, // No end time needed
      mint_limit: template.phase_type === "public" ? undefined : 100,
      allowed_wallets: [],
      // Set separate date and time for template application
      startDate: start.toISOString().split("T")[0],
      startTime: start.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Enhanced mobile-optimized header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
            <span className="text-2xl">⚡</span>
            <span>Mint Phases</span>
          </h3>
          <p className="text-sm text-gray-600 mt-1 max-w-md">
            Set up different pricing and access levels for your NFT launch
          </p>
        </div>
        <button
          onClick={() => setShowAddPhase(true)}
          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Phase</span>
        </button>
      </div>

      {/* Enhanced phase templates - mobile optimized */}
      {phases.length === 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-blue-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-2xl">🚀</span>
            <h4 className="text-gray-900 font-semibold text-lg">Quick Start Templates</h4>
          </div>
          <p className="text-gray-600 text-sm mb-4">Choose a template to get started quickly</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {phaseTemplates.map((template) => (
              <button
                key={template.name}
                onClick={() => applyTemplate(template)}
                className="group p-4 bg-white/80 hover:bg-white border border-gray-200 hover:border-blue-300 rounded-xl text-left transition-all duration-200 hover:shadow-lg transform hover:scale-105"
              >
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-lg">
                    {template.phase_type === 'og' ? '👑' : 
                     template.phase_type === 'whitelist' ? '🎫' : '🌍'}
                  </span>
                  <div className="text-gray-900 font-semibold text-sm">
                    {template.name}
                  </div>
                </div>
                <div className="text-blue-600 font-bold text-lg mb-1">
                  {template.price} SOL
                </div>
                <div className="text-gray-500 text-xs">
                  {template.phase_type === 'og' ? 'Exclusive early access' :
                   template.phase_type === 'whitelist' ? 'Verified members only' :
                   'Open to everyone'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced existing phases - mobile optimized */}
      {phases.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-xl">📊</span>
            <h4 className="text-gray-900 font-semibold">Configured Phases ({phases.length})</h4>
          </div>
          {phases.map((phase, index) => (
            <div
              key={phase.id}
              className="group bg-white border border-gray-200 hover:border-blue-300 rounded-2xl p-6 transition-all duration-200 hover:shadow-lg"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">
                        {phase.phase_type === 'og' ? '👑' : 
                         phase.phase_type === 'whitelist' ? '🎫' : '🌍'}
                      </span>
                      <h4 className="text-gray-900 font-bold text-lg">{phase.name}</h4>
                    </div>
                    <span className="text-sm font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                      Phase {index + 1}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        getPhaseStatus(phase) === "live"
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : getPhaseStatus(phase) === "upcoming"
                          ? "bg-blue-100 text-blue-700 border border-blue-200"
                          : "bg-gray-100 text-gray-700 border border-gray-200"
                      }`}
                    >
                      • {getPhaseStatus(phase)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-blue-600 font-semibold text-xs uppercase tracking-wide mb-1">Price</div>
                      <div className="text-blue-900 font-bold text-lg">{phase.price} SOL</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="text-purple-600 font-semibold text-xs uppercase tracking-wide mb-1">Starts</div>
                      <div className="text-purple-900 font-medium text-sm">
                        {formatLocaleTime(phase.start_time)}
                      </div>
                    </div>
                    {phase.end_time && (
                      <div className="bg-orange-50 rounded-lg p-3">
                        <div className="text-orange-600 font-semibold text-xs uppercase tracking-wide mb-1">Ends</div>
                        <div className="text-orange-900 font-medium text-sm">
                          {formatLocaleTime(phase.end_time)}
                        </div>
                      </div>
                    )}
                    {phase.mint_limit && (
                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="text-green-600 font-semibold text-xs uppercase tracking-wide mb-1">Limit</div>
                        <div className="text-green-900 font-bold text-lg">
                          {phase.mint_limit}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {phase.allowed_wallets && phase.allowed_wallets.length > 0 && (
                    <div className="mt-3 bg-gray-50 rounded-lg p-3">
                      <div className="text-gray-600 font-semibold text-xs uppercase tracking-wide mb-1">Allowlist</div>
                      <div className="text-gray-900 font-medium">
                        {phase.allowed_wallets.length} wallet{phase.allowed_wallets.length !== 1 ? 's' : ''} allowed
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => removePhase(phase.id!)}
                  className="w-full lg:w-auto px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center space-x-2 group-hover:scale-105"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Remove</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Enhanced add phase modal - mobile optimized */}
      {showAddPhase && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-lg">✨</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    Add Mint Phase
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddPhase(false)}
                  className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Enhanced form fields */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Phase Name
                  </label>
                  <input
                    type="text"
                    value={newPhase.name}
                    onChange={(e) =>
                      setNewPhase((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all duration-200"
                    placeholder="e.g., Whitelist Sale, Public Mint"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Type
                    </label>
                    <select
                      value={newPhase.phase_type}
                      onChange={(e) =>
                        setNewPhase((prev) => ({
                          ...prev,
                          phase_type: e.target.value as
                            | "public"
                            | "whitelist"
                            | "og",
                        }))
                      }
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all duration-200"
                    >
                      <option value="public">🌍 Public</option>
                      <option value="whitelist">🎫 Whitelist</option>
                      <option value="og">👑 OG</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Price (SOL)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={newPhase.price}
                        onChange={(e) =>
                          setNewPhase((prev) => ({
                            ...prev,
                            price: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all duration-200"
                        placeholder="0.1"
                        min="0"
                        step="0.001"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium text-sm">
                        SOL
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced date and time inputs */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Start Date & Time
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        type="date"
                        value={newPhase.startDate}
                        onChange={(e) =>
                          setNewPhase((prev) => ({
                            ...prev,
                            startDate: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all duration-200"
                      />
                    </div>
                    <div>
                      <input
                        type="time"
                        value={newPhase.startTime}
                        onChange={(e) =>
                          setNewPhase((prev) => ({
                            ...prev,
                            startTime: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                {newPhase.phase_type !== "public" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Mint Limit per Wallet
                    </label>
                    <input
                      type="number"
                      value={newPhase.mint_limit || ""}
                      onChange={(e) =>
                        setNewPhase((prev) => ({
                          ...prev,
                          mint_limit: parseInt(e.target.value) || undefined,
                        }))
                      }
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all duration-200"
                      placeholder="e.g., 3"
                      min="1"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Maximum NFTs a single wallet can mint in this phase
                    </p>
                  </div>
                )}

                {/* Phase type explanation */}
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-blue-900 mb-1">
                        {newPhase.phase_type === 'og' ? 'OG Phase' : 
                         newPhase.phase_type === 'whitelist' ? 'Whitelist Phase' : 'Public Phase'}
                      </h4>
                      <p className="text-xs text-blue-700">
                        {newPhase.phase_type === 'og' ? 'Exclusive access for your most loyal supporters and early believers.' : 
                         newPhase.phase_type === 'whitelist' ? 'Limited access for verified community members and allowlisted wallets.' : 
                         'Open to everyone - no restrictions or allowlists required.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-8">
                <button
                  onClick={() => setShowAddPhase(false)}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={addPhase}
                  disabled={!newPhase.name || newPhase.price < 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-300 text-white rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed"
                >
                  Add Phase
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
