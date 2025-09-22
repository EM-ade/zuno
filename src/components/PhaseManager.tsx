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
      {/* Mobile-optimized header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-lg font-semibold text-white">Mint Phases</h3>
          <p className="text-sm text-gray-400 mt-1">
            Configure when and how your NFTs can be minted
          </p>
        </div>
        <button
          onClick={() => setShowAddPhase(true)}
          className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
        >
          <span>+</span>
          <span>Add Phase</span>
        </button>
      </div>

      {/* Phase templates - mobile optimized */}
      {phases.length === 0 && (
        <div className="bg-black/20 backdrop-blur-md rounded-xl border border-white/10 p-4">
          <h4 className="text-white font-medium mb-3">Quick Templates</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {phaseTemplates.map((template) => (
              <button
                key={template.name}
                onClick={() => applyTemplate(template)}
                className="p-3 bg-black/30 hover:bg-black/40 border border-white/10 rounded-lg text-left transition-all duration-200"
              >
                <div className="text-white font-medium text-sm">
                  {template.name}
                </div>
                <div className="text-gray-400 text-xs mt-1">
                  {template.price} SOL
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Existing phases - mobile optimized */}
      {phases.length > 0 && (
        <div className="space-y-3">
          {phases.map((phase) => (
            <div
              key={phase.id}
              className="bg-black/20 backdrop-blur-md rounded-xl border border-white/10 p-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="text-white font-medium">{phase.name}</h4>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        getPhaseStatus(phase) === "live"
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : getPhaseStatus(phase) === "upcoming"
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                      }`}
                    >
                      {getPhaseStatus(phase)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400">Price:</span>
                      <span className="text-white ml-1">{phase.price} SOL</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Starts:</span>
                      <span className="text-white ml-1 block sm:inline">
                        {formatLocaleTime(phase.start_time)}
                      </span>
                    </div>
                    {phase.end_time && (
                      <div>
                        <span className="text-gray-400">Ends:</span>
                        <span className="text-white ml-1 block sm:inline">
                          {formatLocaleTime(phase.end_time)}
                        </span>
                      </div>
                    )}
                    {phase.mint_limit && (
                      <div>
                        <span className="text-gray-400">Limit:</span>
                        <span className="text-white ml-1">
                          {phase.mint_limit}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => removePhase(phase.id!)}
                  className="w-full sm:w-auto px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg text-sm font-medium transition-all duration-200"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add phase modal - mobile optimized */}
      {showAddPhase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">
                  Add Mint Phase
                </h3>
                <button
                  onClick={() => setShowAddPhase(false)}
                  className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all duration-200"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {/* Mobile-optimized form fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Phase Name
                  </label>
                  <input
                    type="text"
                    value={newPhase.name}
                    onChange={(e) =>
                      setNewPhase((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200"
                    placeholder="e.g., Whitelist Sale"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
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
                      className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200"
                    >
                      <option value="public">Public</option>
                      <option value="whitelist">Whitelist</option>
                      <option value="og">OG</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      Price (SOL)
                    </label>
                    <input
                      type="number"
                      value={newPhase.price}
                      onChange={(e) =>
                        setNewPhase((prev) => ({
                          ...prev,
                          price: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200"
                      placeholder="0.1"
                      min="0"
                      step="0.001"
                    />
                  </div>
                </div>

                {/* Date and time inputs - mobile optimized */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Start Date & Time
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={newPhase.startDate}
                      onChange={(e) =>
                        setNewPhase((prev) => ({
                          ...prev,
                          startDate: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-3 bg-black/30 border border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200"
                    />
                    <input
                      type="time"
                      value={newPhase.startTime}
                      onChange={(e) =>
                        setNewPhase((prev) => ({
                          ...prev,
                          startTime: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-3 bg-black/30 border border-white/20 rounded-xl text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200"
                    />
                  </div>
                </div>

                {newPhase.phase_type !== "public" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
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
                      className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200"
                      placeholder="e.g., 3"
                      min="1"
                    />
                  </div>
                )}
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowAddPhase(false)}
                  className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={addPhase}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-medium transition-all duration-200"
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
