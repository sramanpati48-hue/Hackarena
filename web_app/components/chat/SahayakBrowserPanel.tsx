"use client";

import React, { useState } from "react";
import { MapPin, Phone, Mail, Star, CheckCircle2, X, HeartHandshake, Globe, History } from "lucide-react";
import Image from "next/image";

interface SahayakProfile {
  uid: string;
  name: string;
  location: string;
  occupation: string;
  bio: string;
  avatar: string;
  contact_number: string;
  email: string;
  availability: string;
  rating: number;
  cases_resolved: number;
  languages: string[];
  isAssigned?: boolean; // set when restored from a past session where guide was already accepted
}

interface Props {
  sahayaks: SahayakProfile[];
  sahayakCaseId: string | null;
  userId: string;
  onAccept: (sahayakUid: string, sahayakName: string) => void;
  onClose: () => void;
  initialAcceptedId?: string | null;
}

export function SahayakBrowserPanel({ sahayaks, sahayakCaseId, userId, onAccept, onClose, initialAcceptedId }: Props) {
  // If any sahayak has isAssigned:true from session restore, pre-select them and mark as accepted
  const assignedSahayak = sahayaks.find(s => s.isAssigned);
  const [selected, setSelected] = useState<SahayakProfile | null>(assignedSahayak || sahayaks[0] || null);
  const [accepted, setAccepted] = useState<string | null>(
    initialAcceptedId || assignedSahayak?.uid || null
  );
  const [loading, setLoading] = useState(false);

  const isRestored = !!(assignedSahayak || initialAcceptedId);


  const handleAccept = async (s: SahayakProfile) => {
    if (!sahayakCaseId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/sahayak/cases/${sahayakCaseId}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sahayak_id: s.uid, sahayak_name: s.name }),
        }
      );
      if (res.ok) {
        setAccepted(s.uid);
        onAccept(s.uid, s.name);
      }
    } catch (err) {
      console.error("Error accepting sahayak:", err);
    } finally {
      setLoading(false);
    }
  };

  const avatarSrc = (s: SahayakProfile) =>
    s.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=1e4d8c&color=fff&size=128`;

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 overflow-hidden" style={{ minWidth: 420, maxWidth: 460 }}>
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-blue-900 to-indigo-800 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <HeartHandshake className="w-5 h-5" />
          <div>
            <h2 className="font-black text-sm">{isRestored ? "Your Nyay Guide" : "Nyay Guides Near You"}</h2>
            <p className="text-blue-200 text-xs">
              {isRestored ? "You are connected to a guide" : `${sahayaks.length} community helpers available`}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Session-restored notice */}
      {isRestored && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border-b border-emerald-100 shrink-0">
          <History size={12} className="text-emerald-600" />
          <span className="text-[11px] font-bold text-emerald-700">Restored from your session history</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left: sahayak list */}
        <div className="w-44 border-r border-gray-100 overflow-y-auto bg-gray-50 shrink-0">
          {sahayaks.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-xs mt-8">
              <HeartHandshake className="w-8 h-8 mx-auto mb-2 text-gray-200" />
              No guides registered yet
            </div>
          ) : (
            sahayaks.map((s) => (
              <button
                key={s.uid}
                onClick={() => setSelected(s)}
                className={`w-full text-left p-3 border-b border-gray-100 transition-all ${
                  selected?.uid === s.uid ? "bg-blue-50 border-l-2 border-l-blue-600" : "hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0">
                    <Image src={avatarSrc(s)} alt={s.name} width={36} height={36} className="object-cover" unoptimized />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-gray-900 truncate">{s.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{s.location}</p>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <Star size={9} className="text-amber-400 fill-amber-400" />
                      <span className="text-[10px] font-bold text-gray-500">{s.rating}</span>
                    </div>
                  </div>
                </div>
                {accepted === s.uid && (
                  <div className="mt-1 text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 size={10} /> Connected
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a Nyay Guide
            </div>
          ) : (
            <>
              {/* Profile card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden ring-4 ring-white shadow-md shrink-0">
                    <Image src={avatarSrc(selected)} alt={selected.name} width={64} height={64} className="object-cover" unoptimized />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-gray-900 text-sm">{selected.name}</h3>
                    <p className="text-xs text-blue-700 font-semibold">{selected.occupation || "Community Legal Aid"}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star size={11} className="text-amber-400 fill-amber-400" />
                      <span className="text-xs font-bold text-gray-700">{selected.rating}</span>
                      <span className="text-[10px] text-gray-400 ml-1">• {selected.cases_resolved} cases resolved</span>
                    </div>
                    <div className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                      selected.availability === "Available" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${selected.availability === "Available" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                      {selected.availability || "Available"}
                    </div>
                  </div>
                </div>

                {selected.bio && (
                  <p className="mt-3 text-xs text-gray-600 leading-relaxed">{selected.bio}</p>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <Star size={14} className="text-amber-400 fill-amber-400 mx-auto mb-1" />
                  <p className="text-sm font-black text-gray-900">{selected.rating}</p>
                  <p className="text-[10px] text-gray-400 font-semibold">Rating</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <HeartHandshake size={14} className="text-blue-500 mx-auto mb-1" />
                  <p className="text-sm font-black text-gray-900">{selected.cases_resolved}</p>
                  <p className="text-[10px] text-gray-400 font-semibold">Resolved</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <Globe size={14} className="text-indigo-500 mx-auto mb-1" />
                  <p className="text-sm font-black text-gray-900">{(selected.languages || []).length || 2}</p>
                  <p className="text-[10px] text-gray-400 font-semibold">Languages</p>
                </div>
              </div>

              {/* Languages */}
              {selected.languages && selected.languages.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Languages</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.languages.map((lang) => (
                      <span key={lang} className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-indigo-100">
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact Details */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact</p>
                {selected.location && (
                  <div className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 px-3 py-2.5 rounded-xl border border-gray-100">
                    <MapPin size={13} className="text-gray-400 shrink-0" />
                    <span className="font-semibold">{selected.location}</span>
                  </div>
                )}
                {selected.contact_number && (
                  <a
                    href={`tel:${selected.contact_number}`}
                    className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-3 py-2.5 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors"
                  >
                    <Phone size={13} className="shrink-0" />
                    <span className="font-bold">{selected.contact_number}</span>
                  </a>
                )}
                {selected.email && (
                  <a
                    href={`mailto:${selected.email}`}
                    className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 px-3 py-2.5 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-colors truncate"
                  >
                    <Mail size={13} className="shrink-0" />
                    <span className="font-bold truncate">{selected.email}</span>
                  </a>
                )}
              </div>

              {/* Actions */}
              {accepted === selected.uid ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-black text-emerald-700 text-sm">Connected to {selected.name}!</p>
                  <p className="text-xs text-emerald-600 mt-1">They will reach out to you shortly.</p>
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => handleAccept(selected)}
                    disabled={loading || !!accepted}
                    className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] disabled:opacity-50 text-white font-black py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-700/20"
                  >
                    <HeartHandshake size={16} />
                    {loading ? "Connecting..." : "Connect with this Guide"}
                  </button>
                  <button
                    onClick={() => {
                      const others = sahayaks.filter((s) => s.uid !== selected.uid);
                      if (others.length > 0) setSelected(others[0]);
                    }}
                    className="w-full border border-gray-200 text-gray-500 hover:bg-gray-50 font-bold py-3 rounded-2xl text-xs transition-all"
                  >
                    Browse other guides
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
