"use client";

import React, { useState, useEffect } from "react";
import {
  HeartHandshake, Loader2, MapPin, Phone, Mail, User, AlertTriangle, CheckCircle2,
  RefreshCw, Clock, Calendar, FileText, ChevronRight, Star, BadgeCheck, Shield, Scale
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import Link from "next/link";

interface SahayakCase {
  id: string;
  user_id: string;
  user_name: string;
  structured_report: {
    incident_type?: string;
    risk_level?: string;
    summary?: string;
    statutory_sections?: string[];
    checklist?: string[];
    location?: string;
    contact?: string;
  };
  status: "pending" | "accepted";
  assigned_sahayak_id?: string;
  assigned_sahayak_name?: string;
  created_at: string;
  updated_at: string;
}

const RISK_COLORS: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 border-red-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  LOW: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Safely converts any structured_report field to a displayable string.
 * Handles: plain string, object {city, state, lat, lon}, arrays, numbers.
 */
function formatField(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(v => formatField(v)).join(", ");
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Location object pattern: {city, state, lat, lon}
    const parts: string[] = [];
    if (obj.city)  parts.push(String(obj.city));
    if (obj.state) parts.push(String(obj.state));
    if (parts.length) return parts.join(", ");
    // Generic object fallback: join key=value pairs
    return Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }
  return String(value);
}


export default function SahayakDashboard() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();

  const [cases, setCases] = useState<SahayakCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<SahayakCase | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "accepted">("pending");
  const isSahayakRole = role === "sahayak" || role === "guide" || role === "nyay_guide";

  useEffect(() => { setMounted(true); }, []);

  // Auth protection
  useEffect(() => {
    if (authLoading || !mounted) return;
    if (!user || !isSahayakRole) { router.push("/login"); }
  }, [user, isSahayakRole, authLoading, mounted, router]);

  // Fetch profile + cases
  useEffect(() => {
    if (!user) return;
    fetchProfile();
    fetchCases();
  }, [user]);

  // WebSocket Listener for real-time new sahayak cases
  useEffect(() => {
    if (!user) return;

    const wsBaseUrl = (API_URL || "http://localhost:8000").replace(/^http/, "ws");
    let wsDestroyed = false;
    let wsReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket;

    const connectSahayakWS = () => {
      if (wsDestroyed) return;
      ws = new WebSocket(`${wsBaseUrl}/ws/sahayak`);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_sahayak_case") {
            const newCase: SahayakCase = {
              id: data.case_id,
              user_id: data.user_id,
              user_name: data.user_name || "User",
              structured_report: data.structured_report || {},
              status: "pending",
              created_at: data.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            setCases(prev => {
              if (prev.find(c => c.id === newCase.id)) return prev;
              return [newCase, ...prev];
            });
          }
        } catch (e) {
          console.error("WebSocket message parsing error", e);
        }
      };
      ws.onclose = () => {
        if (!wsDestroyed) {
          wsReconnectTimeout = setTimeout(connectSahayakWS, 3000);
        }
      };
      ws.onerror = () => {
        console.error("Sahayak WebSocket error");
      };
    };

    connectSahayakWS();

    return () => {
      wsDestroyed = true;
      if (wsReconnectTimeout) clearTimeout(wsReconnectTimeout);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    };
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/sahayak/profile/${user.uid}`);
      const data = await res.json();
      if (data.profile) setProfile(data.profile);
    } catch { /* silent */ }
  };

  const fetchCases = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sahayak/cases/${user.uid}`);
      const data = await res.json();
      setCases(data.cases || []);
    } catch (e) {
      console.error("Error fetching sahayak cases:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptCase = async (c: SahayakCase) => {
    if (!user) return;
    setAccepting(true);
    try {
      const res = await fetch(`${API_URL}/api/sahayak/cases/${c.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sahayak_id: user.uid, sahayak_name: profile?.name || user.displayName || "Nyay Guide" }),
      });
      if (res.ok) {
        setCases(prev => prev.map(x => x.id === c.id ? { ...x, status: "accepted", assigned_sahayak_id: user.uid } : x));
        setSelectedCase(prev => prev?.id === c.id ? { ...prev, status: "accepted" } : prev);
      }
    } catch (e) { console.error(e); }
    finally { setAccepting(false); }
  };

  const pending = cases.filter(c => c.status === "pending");
  const accepted = cases.filter(c => c.status === "accepted" && c.assigned_sahayak_id === user?.uid);
  const displayed = activeTab === "pending" ? pending : accepted;

  const riskLevel = (c: SahayakCase) =>
    (c.structured_report?.risk_level || "MEDIUM").toUpperCase();

  if (!mounted || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-900 rounded-2xl flex items-center justify-center">
              <HeartHandshake className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-gray-900 text-xl leading-tight">Nyay Guide Dashboard</h1>
              {profile?.name && <p className="text-sm text-gray-500">Welcome back, {profile.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sahayak/profile"
              className="px-4 py-2 border border-gray-200 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-50 transition-colors"
            >
              Edit Profile
            </Link>
            <button onClick={fetchCases} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white font-bold text-sm rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="px-8 pt-5 pb-2 grid grid-cols-3 gap-4 shrink-0">
          {[
            { label: "Pending Cases", value: pending.length, icon: Clock, color: "bg-amber-50 border-amber-100 text-amber-600" },
            { label: "Accepted Cases", value: accepted.length, icon: CheckCircle2, color: "bg-emerald-50 border-emerald-100 text-emerald-600" },
            { label: "Total Cases", value: cases.length, icon: FileText, color: "bg-blue-50 border-blue-100 text-blue-600" },
          ].map(s => (
            <div key={s.label} className={`flex items-center gap-4 p-4 rounded-2xl border ${s.color} bg-opacity-50`}>
              <div className="p-2 rounded-xl bg-white shadow-sm">
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-black">{s.value}</p>
                <p className="text-xs font-semibold opacity-70">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden px-8 pb-8 pt-4 gap-6">
          {/* Left: Case List */}
          <div className="w-72 flex flex-col gap-3 overflow-y-auto shrink-0">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              {(["pending", "accepted"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 text-xs font-black rounded-lg capitalize transition-all ${
                    activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                  }`}
                >
                  {tab === "pending" ? `Pending (${pending.length})` : `Accepted (${accepted.length})`}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              </div>
            ) : displayed.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <HeartHandshake className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p className="text-sm font-semibold">No {activeTab} cases</p>
              </div>
            ) : (
              displayed.map(c => (
                <button key={c.id} onClick={() => setSelectedCase(c)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    selectedCase?.id === c.id
                      ? "border-blue-600 bg-blue-50 shadow-sm"
                      : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${RISK_COLORS[riskLevel(c)] || RISK_COLORS["MEDIUM"]}`}>
                      {riskLevel(c)} RISK
                    </span>
                    {c.status === "accepted" && (
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    )}
                  </div>
                  <p className="font-bold text-gray-900 text-sm truncate">
                    {c.structured_report?.incident_type || "Legal Case"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <User size={10} /> {c.user_name || "Anonymous"}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(c.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </button>
              ))
            )}
          </div>

          {/* Right: Case Detail */}
          <div className="flex-1 overflow-y-auto">
            {!selectedCase ? (
              <div className="h-full flex items-center justify-center text-gray-400 flex-col gap-3">
                <HeartHandshake className="w-14 h-14 text-gray-100" />
                <p className="font-semibold text-sm">Select a case to view details</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Case Header */}
                <div className="p-6 bg-gradient-to-r from-blue-900 to-indigo-800 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full bg-white/20 border border-white/30 uppercase tracking-wide`}>
                        {riskLevel(selectedCase)} Risk
                      </span>
                      <h2 className="text-xl font-black mt-3 leading-tight">
                        {selectedCase.structured_report?.incident_type || "Legal Case"}
                      </h2>
                      <div className="flex items-center gap-4 mt-2 text-blue-200 text-sm">
                        <span className="flex items-center gap-1"><User size={13} /> {selectedCase.user_name}</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={13} />
                          {new Date(selectedCase.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                        </span>
                      </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wide ${
                      selectedCase.status === "accepted" ? "bg-emerald-500" : "bg-amber-500"
                    }`}>
                      {selectedCase.status}
                    </div>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-2 gap-6">
                  {/* Summary */}
                  <div className="col-span-2">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Case Summary</h3>
                    <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-4 border border-gray-100">
                      {formatField(selectedCase.structured_report?.summary) || "No summary available."}
                    </p>
                  </div>

                  {/* User Contact Info */}
                  <div>
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">User Details</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-sm text-gray-700 bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <User size={14} className="text-gray-400 shrink-0" />
                        <span className="font-semibold">{selectedCase.user_name || "Anonymous"}</span>
                      </div>
                      {formatField(selectedCase.structured_report?.location) && (
                        <div className="flex items-center gap-3 text-sm text-gray-700 bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <MapPin size={14} className="text-gray-400 shrink-0" />
                          <span>{formatField(selectedCase.structured_report?.location)}</span>
                        </div>
                      )}
                      {formatField(selectedCase.structured_report?.contact) && (
                        <a href={`tel:${formatField(selectedCase.structured_report?.contact)}`}
                          className="flex items-center gap-3 text-sm text-blue-700 bg-blue-50 rounded-xl p-3 border border-blue-100 hover:bg-blue-100 transition-colors"
                        >
                          <Phone size={14} className="shrink-0" />
                          <span className="font-bold">{formatField(selectedCase.structured_report?.contact)}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Statutory Sections */}
                  {(selectedCase.structured_report?.statutory_sections?.length ?? 0) > 0 && (
                    <div>
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Applicable Laws</h3>
                      <div className="space-y-1.5">
                        {selectedCase.structured_report?.statutory_sections?.map((sec, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 rounded-xl p-2.5 border border-indigo-100">
                            <Scale size={12} className="shrink-0" />
                            <span className="font-semibold">{sec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Checklist */}
                  {(selectedCase.structured_report?.checklist?.length ?? 0) > 0 && (
                    <div className="col-span-2">
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Action Checklist</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedCase.structured_report?.checklist?.map((item, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-gray-700 bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  {selectedCase.status === "pending" && (
                    <div className="col-span-2">
                      <button
                        onClick={() => handleAcceptCase(selectedCase)}
                        disabled={accepting}
                        className="w-full bg-blue-900 hover:bg-blue-800 text-white font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
                      >
                        {accepting ? <Loader2 size={16} className="animate-spin" /> : <HeartHandshake size={16} />}
                        {accepting ? "Accepting..." : "Accept & Help This Person"}
                      </button>
                    </div>
                  )}
                  {selectedCase.status === "accepted" && selectedCase.assigned_sahayak_id === user?.uid && (
                    <div className="col-span-2 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                      <div>
                        <p className="font-black text-emerald-700 text-sm">Case Accepted</p>
                        <p className="text-xs text-emerald-600">You are now responsible for this case. Reach out to the user.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
