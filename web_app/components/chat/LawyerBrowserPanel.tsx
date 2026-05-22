"use client";

import { useState } from "react";
import {
  X, Star, MapPin, Briefcase, Clock, Phone, User, Award,
  ChevronRight, CheckCircle, XCircle, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface LawyerProfile {
  id?: string;
  user_id?: string;
  name: string;
  specialization?: string;
  experience?: number;
  hourly_rate?: number;
  bio?: string;
  location?: string;
  rating?: number;
  avatar?: string;
  bar_registration_number?: string;
  contact_number?: string;
  email?: string;
  verified?: boolean;
  lawyer_type?: string;
}

interface LawyerBrowserPanelProps {
  lawyers: LawyerProfile[];
  lawyerCaseId?: string | null;
  onClose: () => void;
  onAccept: (lawyer: LawyerProfile) => void;
  onReject: (lawyer: LawyerProfile) => void;
}

export function LawyerBrowserPanel({
  lawyers,
  lawyerCaseId,
  onClose,
  onAccept,
  onReject
}: LawyerBrowserPanelProps) {
  const [selectedLawyer, setSelectedLawyer] = useState<LawyerProfile | null>(
    lawyers.length > 0 ? lawyers[0] : null
  );
  const [accepted, setAccepted] = useState<string | null>(null);
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const handleAccept = (lawyer: LawyerProfile) => {
    const id = lawyer.user_id || lawyer.id || lawyer.name;
    setAccepted(id);
    onAccept(lawyer);
  };

  const handleReject = (lawyer: LawyerProfile) => {
    const id = lawyer.user_id || lawyer.id || lawyer.name;
    setRejected(prev => new Set([...prev, id]));
    onReject(lawyer);
    // Auto-select next available
    const next = lawyers.find(l => {
      const lid = l.user_id || l.id || l.name;
      return lid !== id && !rejected.has(lid) && accepted !== lid;
    });
    if (next) setSelectedLawyer(next);
  };

  const getLawyerId = (l: LawyerProfile) => l.user_id || l.id || l.name;

  const availableLawyers = lawyers.filter(l => {
    const id = getLawyerId(l);
    return !rejected.has(id);
  });

  return (
    <div className="relative flex h-full flex-col bg-white dark:bg-slate-900 border-l border-gray-100 dark:border-slate-700 overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-[#E6F0ED] to-white dark:from-emerald-900/20 dark:to-slate-900 flex-shrink-0">
        <div>
          <h2 className="text-[15px] font-black text-[#00634B] dark:text-emerald-400 tracking-tight">
            Verified Lawyers
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{availableLawyers.length} available · Click a lawyer to open profile</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {lawyers.map((lawyer, idx) => {
          const id = getLawyerId(lawyer);
          const isSelected = selectedLawyer && getLawyerId(selectedLawyer) === id;
          const isAccepted = accepted === id;
          const isRejected = rejected.has(id);

          return (
            <button
              key={id || idx}
              onClick={() => setSelectedLawyer(lawyer)}
              className={cn(
                "w-full text-left px-4 py-3.5 border-b border-gray-50 dark:border-slate-800 transition-all flex items-start gap-3",
                isSelected
                  ? "bg-[#E6F0ED]/60 dark:bg-emerald-900/20 border-l-2 border-l-[#00634B]"
                  : "hover:bg-gray-50 dark:hover:bg-slate-800",
                isRejected && "opacity-40"
              )}
            >
              <div className="relative flex-shrink-0">
                {lawyer.avatar ? (
                  <img
                    src={lawyer.avatar}
                    alt={lawyer.name}
                    className="w-9 h-9 rounded-xl object-cover border border-gray-100"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-[#E6F0ED] dark:bg-emerald-900/30 flex items-center justify-center border border-[#00634B]/10">
                    <User size={16} className="text-[#00634B]" />
                  </div>
                )}
                {isAccepted && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                    <CheckCircle size={10} className="text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-[12px] font-bold truncate",
                  isAccepted ? "text-emerald-600" : "text-gray-800 dark:text-gray-200"
                )}>
                  {lawyer.name}
                </p>
                <p className="text-[10px] text-gray-400 truncate mt-0.5">
                  {lawyer.specialization || "General Practice"}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <Star size={9} className="text-amber-400 fill-amber-400" />
                  <span className="text-[10px] font-bold text-amber-500">
                    {lawyer.rating?.toFixed(1) || "5.0"}
                  </span>
                </div>
              </div>
              <ChevronRight size={12} className={cn(
                "flex-shrink-0 mt-2 transition-colors",
                isSelected ? "text-[#00634B]" : "text-gray-300"
              )} />
            </button>
          );
        })}
      </div>

      {selectedLawyer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-md px-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/30 bg-white/85 dark:bg-slate-900/80 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
              <h3 className="text-sm font-black text-[#00634B] dark:text-emerald-400 tracking-tight">Lawyer Profile</h3>
              <button
                onClick={() => setSelectedLawyer(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-64px)]">
              <LawyerDetailView
                lawyer={selectedLawyer}
                isAccepted={accepted === getLawyerId(selectedLawyer)}
                isRejected={rejected.has(getLawyerId(selectedLawyer))}
                onAccept={() => handleAccept(selectedLawyer)}
                onReject={() => handleReject(selectedLawyer)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {accepted && (
        <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20 flex-shrink-0">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle size={16} />
            <p className="text-sm font-bold">Lawyer request sent!</p>
          </div>
          <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70 mt-1">
            The lawyer will review your case and contact you shortly.
          </p>
        </div>
      )}
    </div>
  );
}

function LawyerDetailView({
  lawyer,
  isAccepted,
  isRejected,
  onAccept,
  onReject
}: {
  lawyer: LawyerProfile;
  isAccepted: boolean;
  isRejected: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="p-5 space-y-5">
      {/* Lawyer Header */}
      <div className="flex items-start gap-4">
        {lawyer.avatar ? (
          <img
            src={lawyer.avatar}
            alt={lawyer.name}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-[#00634B]/10 shadow-lg flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E6F0ED] to-[#00634B]/10 flex items-center justify-center border-2 border-[#00634B]/10 flex-shrink-0">
            <User size={28} className="text-[#00634B]" />
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-black text-gray-900 dark:text-white">
              {lawyer.name}
            </h3>
            {lawyer.verified && (
              <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-700/30 rounded-full px-2 py-0.5">
                <Shield size={9} className="text-emerald-600" />
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Verified</span>
              </div>
            )}
          </div>
          <p className="text-sm text-[#00634B] font-semibold mt-0.5">
            {lawyer.specialization || "General Practice"}
          </p>
          {lawyer.location && (
            <div className="flex items-center gap-1 mt-1.5 text-gray-400">
              <MapPin size={11} />
              <span className="text-xs">{lawyer.location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={Star} label="Rating" value={`${lawyer.rating?.toFixed(1) || "5.0"} ⭐`} accent="amber" />
        <StatCard icon={Briefcase} label="Experience" value={`${lawyer.experience || 0} Yrs`} accent="blue" />
        <StatCard
          icon={Clock}
          label="Rate"
          value={lawyer.hourly_rate ? `₹${lawyer.hourly_rate}/hr` : "On request"}
          accent="purple"
        />
      </div>

      {/* Bio */}
      {lawyer.bio && (
        <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">About</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{lawyer.bio}</p>
        </div>
      )}

      {/* Details */}
      <div className="space-y-2.5">
        {lawyer.bar_registration_number && (
          <div className="flex items-center gap-3">
            <Award size={14} className="text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bar Registration</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{lawyer.bar_registration_number}</p>
            </div>
          </div>
        )}
        {lawyer.contact_number && (
          <div className="flex items-center gap-3">
            <Phone size={14} className="text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contact</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{lawyer.contact_number}</p>
            </div>
          </div>
        )}
        {lawyer.lawyer_type && (
          <div className="flex items-center gap-3">
            <Briefcase size={14} className="text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{lawyer.lawyer_type}</p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {!isAccepted && !isRejected ? (
        <div className="flex flex-col gap-2.5 pt-2">
          <button
            onClick={onAccept}
            className="w-full flex items-center justify-center gap-2 bg-[#00634B] hover:bg-[#004D3C] text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-[#00634B]/20 hover:shadow-[#00634B]/30 hover:scale-[1.01] active:scale-[0.99]"
          >
            <CheckCircle size={16} />
            Connect with {lawyer.name.split(" ")[0]}
          </button>
          <button
            onClick={onReject}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-600 dark:text-gray-300 font-bold py-3 rounded-2xl transition-all"
          >
            <XCircle size={16} />
            Not a good fit
          </button>
        </div>
      ) : isAccepted ? (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-700/30 rounded-2xl px-4 py-3 flex items-center gap-2">
          <CheckCircle size={18} className="text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Request Sent!</p>
            <p className="text-xs text-emerald-600/70">Awaiting lawyer confirmation</p>
          </div>
        </div>
      ) : (
        <div className="bg-gray-100 dark:bg-slate-700 rounded-2xl px-4 py-3 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-semibold">Skipped</p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent
}: {
  icon: any;
  label: string;
  value: string;
  accent: "amber" | "blue" | "purple";
}) {
  const colors = {
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-100 dark:border-amber-800/30",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-100 dark:border-blue-800/30",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 border-purple-100 dark:border-purple-800/30"
  };

  return (
    <div className={cn("rounded-2xl border p-3 text-center", colors[accent])}>
      <Icon size={14} className="mx-auto mb-1" />
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-xs font-black mt-0.5">{value}</p>
    </div>
  );
}
