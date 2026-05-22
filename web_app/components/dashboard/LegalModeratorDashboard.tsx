"use client";

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Loader2, Send, Plus, X, User, AlertTriangle, MapPin, MessageSquare, CheckSquare, FileDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface StructuredReport {
  incident_type: string;
  risk_level: string;
  summary: string;
  statutory_sections: string[];
  checklist: string[];
  cognizable?: boolean;
  fraud_under_10k?: boolean | null;
}

interface RoutingRecommendation {
  issue_type?: string;
  state?: string;
  primary_forum?: string;
  secondary_forum?: string;
  routing_message?: string;
  links?: Record<string, string>;
  legal_aid_support?: {
    enabled?: boolean;
    level?: string;
    reason?: string;
  };
}

interface ModeratorOption {
  label: string;
  payload: string;
  type?: string;
  routing_recommendation?: RoutingRecommendation;
}

interface CasePayload {
  case_id: string;
  user_id: string;
  incident_type: string;
  risk_level: string;
  status?: string;
  session_id?: string;
  pdf_url?: string | null;
  structured_report: StructuredReport;
  timestamp: number;
  collection: string;
  user_statement: string;
  location: { city?: string; state?: string; lat?: number; lon?: number };
  routing_recommendation?: RoutingRecommendation | null;
}

export default function LegalModeratorDashboard() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();

  const [cases, setCases] = useState<CasePayload[]>([]);
  const [selectedCase, setSelectedCase] = useState<CasePayload | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  
  // Moderator Response State
  const [moderatorResponse, setModeratorResponse] = useState('Based on my review, here are the immediate next steps you should take:');
  const [options, setOptions] = useState<ModeratorOption[]>([
    { label: 'Connect to Nyay Guide', payload: 'Request Human Help' },
    { label: 'Acknowledge & Proceed', payload: 'I understand, please continue' }
  ]);
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [includeRoutingRecommendation, setIncludeRoutingRecommendation] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Auth Protection
    if (authLoading || !mounted) return;
    if (!user || role !== 'moderator') {
      router.push('/login');
      return;
    }

    // Fetch Initial pending cases
    const fetchCases = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/interventions/moderator`);
        const data = await res.json();
        if (data.status === "success" && data.cases) {
          const active: CasePayload[] = data.cases.map((c: any) => ({
            case_id: c.case_id,
            user_id: c.user_id,
            incident_type: c.structured_report?.incident_type || "Unknown",
            risk_level: c.structured_report?.risk_level || "Medium",
            status: c.status || "pending",
            session_id: c.session_id,
            pdf_url: c.pdf_url || c.structured_report?.pdf_url || null,
            structured_report: c.structured_report,
            timestamp: new Date(c.created_at).getTime(),
            collection: "moderator",
            user_statement: c.user_statement || "",
              location: c.location || {},
              routing_recommendation: c.routing_recommendation || null,
          }));
          active.sort((a, b) => b.timestamp - a.timestamp);
          // Dedup by case_id before setting
          const seen = new Set<string>();
          setCases(active.filter(c => !seen.has(c.case_id) && seen.add(c.case_id)));
        }
      } catch (err) {
        console.error("Failed to fetch interventions", err);
      }
    };
    fetchCases();

    // WebSocket Listener for real-time new interventions
    const wsBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/^http/, "ws");
    let wsDestroyed = false;
    let wsReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket;

    const connectModeratorWS = () => {
      if (wsDestroyed) return;
      ws = new WebSocket(`${wsBaseUrl}/ws/moderator`);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_intervention" && data.collection === "moderator") {
            const newCase: CasePayload = {
              case_id: data.case_id,
              user_id: data.user_id,
              incident_type: data.incident_type || data.structured_report?.incident_type || "Unknown",
              risk_level: data.risk_level || data.structured_report?.risk_level || "Medium",
              status: data.status || "pending",
              session_id: data.session_id,
              pdf_url: data.pdf_url || data.structured_report?.pdf_url || null,
              structured_report: data.structured_report || {},
              timestamp: data.timestamp || Date.now(),
              collection: data.collection,
              user_statement: data.user_statement || "",
              location: data.location || {},
              routing_recommendation: data.routing_recommendation || null,
            };
            setCases(prev => {
              if (prev.find(c => c.case_id === newCase.case_id)) return prev;
              return [newCase, ...prev].sort((a, b) => b.timestamp - a.timestamp);
            });
          } else if (data.type === "intervention_updated" && data.collection === "moderator") {
            setCases(prev => {
              const updated: CasePayload = {
                case_id: data.case_id,
                user_id: data.user_id,
                incident_type: data.incident_type || data.structured_report?.incident_type || "Unknown",
                risk_level: data.risk_level || data.structured_report?.risk_level || "Medium",
                status: data.status || "pending",
                session_id: data.session_id,
                pdf_url: data.pdf_url || data.structured_report?.pdf_url || null,
                structured_report: data.structured_report || {},
                timestamp: data.timestamp || Date.now(),
                collection: data.collection || "moderator",
                user_statement: data.user_statement || "",
                location: data.location || {},
                routing_recommendation: data.routing_recommendation || null,
              };

              const idx = prev.findIndex(c => c.case_id === updated.case_id);
              if (idx === -1) {
                return [updated, ...prev].sort((a, b) => b.timestamp - a.timestamp);
              }

              const next = [...prev];
              next[idx] = { ...next[idx], ...updated };
              return next.sort((a, b) => b.timestamp - a.timestamp);
            });
          } else if (data.type === "intervention_resolved" && data.collection === "moderator") {
            setCases(prev => prev.filter(c => c.case_id !== data.case_id));
            if (selectedCase?.case_id === data.case_id) {
              setSelectedCase(null);
            }
          }
        } catch (e) {
          console.error("WebSocket message parsing error", e);
        }
      };
      ws.onclose = () => {
        if (!wsDestroyed) {
          wsReconnectTimeout = setTimeout(connectModeratorWS, 3000);
        }
      };
      ws.onerror = () => {
        if (wsDestroyed) return;
        console.warn("Moderator WebSocket transient error; waiting for reconnect...");
      };
    };

    connectModeratorWS();

    return () => {
      wsDestroyed = true;
      if (wsReconnectTimeout) clearTimeout(wsReconnectTimeout);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    };
  }, [user, role, authLoading, mounted, router]);

  const handleResolve = async () => {
    if (!selectedCase) return;
    setIsResolving(true);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/interventions/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: selectedCase.case_id,
          moderator_response: moderatorResponse,
          moderator_options: options,
          routing_recommendation: includeRoutingRecommendation ? (selectedCase.routing_recommendation || null) : null,
        })
      });

      if (!res.ok) throw new Error("Failed to resolve");
      
      // Optimistically remove from queue
      setCases(prev => prev.filter(c => c.case_id !== selectedCase.case_id));
      setSelectedCase(null);
      setModeratorResponse('Based on my review, here are the immediate next steps you should take:');
      setIncludeRoutingRecommendation(true);
    } catch (err) {
      console.error("Error resolving case:", err);
      alert("Failed to submit resolution. Please try again.");
    } finally {
      setIsResolving(false);
    }
  };

  const addOption = () => {
    if (!newOptionLabel.trim()) return;
    setOptions(prev => [...prev, { label: newOptionLabel.trim(), payload: newOptionLabel.trim() }]);
    setNewOptionLabel('');
  };

  useEffect(() => {
    if (!selectedCase) return;
    setIncludeRoutingRecommendation(Boolean(selectedCase.routing_recommendation));
  }, [selectedCase]);

  const appendRoutingMessage = () => {
    if (!selectedCase?.routing_recommendation?.routing_message) return;
    const msg = selectedCase.routing_recommendation.routing_message.trim();
    setModeratorResponse(prev => {
      if (prev.includes(msg)) return prev;
      return `${prev.trim()}\n\n${msg}`.trim();
    });
  };

  const removeOption = (idx: number) => {
    setOptions(prev => prev.filter((_, i) => i !== idx));
  };

  if (!mounted || authLoading) {
    return (
      <div className="flex h-screen bg-slate-50 items-center justify-center font-sans">
        <Loader2 className="w-10 h-10 text-rose-600 animate-spin" />
      </div>
    );
  }

  if (!user || role !== 'moderator') return null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <Sidebar />
      
      <div className="flex-1 flex h-[calc(100vh-48px)] bg-gray-50 border border-gray-200 rounded-3xl overflow-hidden mt-6 mx-6 mb-6 ml-[280px]">
        {/* Sidebar - Case Queue */}
        <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200 bg-rose-900 text-white">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight">Intervention Queue</h1>
          </div>
          <p className="text-rose-100 text-sm mt-1">{cases.length} victims awaiting human review</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cases.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <ShieldAlert className="w-12 h-12 mb-4 text-gray-300" />
              <p className="font-semibold text-lg text-gray-400">Queue is empty</p>
              <p className="text-sm text-center mt-2 px-8">High-risk cases flagged by the LangGraph flow will appear here.</p>
            </div>
          ) : (
            cases.map((c) => (
              <div 
                key={c.case_id}
                onClick={() => setSelectedCase(c)}
                className={`p-4 rounded-xl cursor-pointer transition-all border ${
                  selectedCase?.case_id === c.case_id 
                    ? 'border-rose-600 bg-rose-50 shadow-md ring-1 ring-rose-600' 
                    : 'border-gray-200 bg-white hover:border-rose-600 hover:shadow-md'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-gray-900 truncate pr-2 text-lg">
                    {c.incident_type}
                  </div>
                  {c.collection === 'mlat' ? (
                    <span className="text-[10px] font-bold bg-indigo-100/50 text-indigo-700 px-2 py-0.5 rounded-md uppercase tracking-wide border border-indigo-200">MLAT</span>
                  ) : (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border ${
                      String(c.risk_level || '').toLowerCase() === 'high'
                        ? 'bg-red-100/50 text-red-700 border-red-200'
                        : 'bg-amber-100/50 text-amber-700 border-amber-200'
                    }`}>{String(c.risk_level || 'medium')}</span>
                  )}
              </div>
              
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-medium border border-slate-200">
                  <User className="w-3 h-3 inline mr-1" />
                  {c.user_id.substring(0,6)}...
                </span>
                <span className="text-[10px] bg-slate-50 text-slate-500 px-2 py-1 rounded-md border border-slate-200 uppercase tracking-widest font-semibold flex items-center">
                  {c.collection} DB
                </span>
              </div>
                <div className="mt-4 flex items-center justify-between text-xs text-gray-500 font-bold">
                  <span className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-lg">
                    <User size={14}/> ID: {c.user_id.substring(0, 8)}...
                  </span>
                  <span>{new Date(c.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content - Case Action Area */}
      <div className="w-2/3 bg-gray-50 flex flex-col overflow-hidden">
        {selectedCase ? (
          <div className="flex-1 flex flex-col p-8 overflow-y-auto">
            
            {/* Case Details Card */}
            <div className="bg-white rounded-[32px] shadow-sm border border-gray-200 p-8 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <AlertTriangle className="text-rose-600" size={24}/>
                <h2 className="text-2xl font-black text-gray-900">Victim Report Analysis</h2>
              </div>

              {/* Victim's verbatim statement */}
              {selectedCase.user_statement && (
                <div className="mb-5">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <MessageSquare size={12}/> Victim's Statement (Verbatim)
                  </h3>
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <p className="text-sm text-amber-900 leading-relaxed font-medium italic">
                      &ldquo;{selectedCase.user_statement}&rdquo;
                    </p>
                  </div>
                </div>
              )}

              {/* Location */}
              {(selectedCase.location?.city || selectedCase.location?.state) && (
                <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <MapPin size={14} className="text-rose-500"/>
                  <span>
                    {[selectedCase.location.city, selectedCase.location.state].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}

              {/* AI Summary */}
              <div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-100/50 mb-5">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">AI Summary</h3>
                <p className="text-sm text-gray-800 leading-relaxed font-semibold">
                  {selectedCase.structured_report?.summary || "No summary captured."}
                </p>
              </div>

              {selectedCase.pdf_url && (
                <div className="mb-5">
                  <a
                    href={selectedCase.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-colors"
                  >
                    <FileDown size={16} />
                    Download Case Report PDF
                  </a>
                </div>
              )}

              {/* AI-suggested checklist */}
              {selectedCase.structured_report?.checklist?.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <CheckSquare size={12}/> AI Recommended Steps
                  </h3>
                  <ul className="space-y-2">
                    {selectedCase.structured_report.checklist.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-0.5 w-5 h-5 flex-shrink-0 rounded-full bg-rose-100 text-rose-600 text-xs font-black flex items-center justify-center">{i+1}</span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Flagged Laws */}
              <div>
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">AI Flagged Violations</h3>
                {selectedCase.structured_report?.statutory_sections?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedCase.structured_report.statutory_sections.map((sec, i) => (
                      <span key={i} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200">
                        {sec}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">None specifically flagged.</p>
                )}
              </div>
            </div>

            {/* Moderator Action Console */}
            <div className="bg-white rounded-[32px] shadow-lg border border-rose-200 p-8 flex-1 flex flex-col">
              <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                <Send size={20} className="text-rose-600"/> Force Injection Stream
              </h2>

              <div className="space-y-6 flex-1">
                <div>
                  <label className="text-sm font-black text-gray-700 block mb-2">Message to Victim</label>
                  <textarea 
                    value={moderatorResponse}
                    onChange={(e) => setModeratorResponse(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500/50 text-sm font-medium resize-none"
                    rows={4}
                    placeholder="Enter explicit instructions for the victim..."
                  />
                </div>

                {selectedCase?.routing_recommendation && (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-sky-700">Routing Suggestion (AI + Rules)</p>
                        <p className="text-sm font-bold text-sky-900 mt-1">
                          {selectedCase.routing_recommendation.primary_forum || "Official route"}
                          {selectedCase.routing_recommendation.secondary_forum ? ` -> ${selectedCase.routing_recommendation.secondary_forum}` : ""}
                        </p>
                        <p className="text-xs text-sky-700 mt-1">
                          State: {selectedCase.routing_recommendation.state || "ALL"} | Issue: {selectedCase.routing_recommendation.issue_type || "other"}
                        </p>
                      </div>
                      <button
                        onClick={appendRoutingMessage}
                        className="px-3 py-2 rounded-xl bg-sky-700 text-white text-xs font-bold hover:bg-sky-800"
                      >
                        Add Route Message
                      </button>
                    </div>

                    <label className="flex items-center gap-2 text-sm font-semibold text-sky-900">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={includeRoutingRecommendation}
                        onChange={(e) => setIncludeRoutingRecommendation(e.target.checked)}
                      />
                      Include routing bundle so user sees official-route modal
                    </label>
                  </div>
                )}

                <div>
                  <label className="text-sm font-black text-gray-700 block mb-2">Inject Clickable Options</label>
                  <div className="space-y-3 mb-4">
                    {options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 pl-4 rounded-xl">
                        <span className="flex-1 text-sm font-bold text-slate-700">{opt.label}</span>
                        <button 
                          onClick={() => removeOption(idx)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-white rounded-lg shadow-sm"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={newOptionLabel}
                      onChange={(e) => setNewOptionLabel(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addOption()}
                      placeholder="e.g. Talk to Human Agent"
                      className="flex-1 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/50 text-sm font-bold"
                    />
                    <button 
                      onClick={addOption}
                      disabled={!newOptionLabel.trim()}
                      className="bg-slate-800 text-white px-4 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 hover:bg-slate-700 shadow-sm"
                    >
                      <Plus size={16} /> Add Option
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 mt-6">
                <button
                  onClick={handleResolve}
                  disabled={isResolving || !moderatorResponse.trim() || options.length === 0}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-rose-600/20 flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
                >
                  {isResolving ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Unlocking Validation Gate...</>
                  ) : (
                    <>Submit Resolution & Resume Flow <Send size={20} /></>
                  )}
                </button>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="bg-white p-6 rounded-full shadow-sm mb-4">
              <ShieldAlert className="w-12 h-12 text-rose-100" />
            </div>
            <p className="text-xl font-bold text-gray-500">Select a case from the queue to intervene</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
