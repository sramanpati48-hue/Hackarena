"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from "@/context/AuthContext";
import { FolderOpen, Calendar, Clock, ChevronRight, ShieldAlert, ArrowUpRight, Scale } from "lucide-react";
import { useGlobalChat } from "@/context/ChatContext";

interface UserCase {
  case_id: string;
  session_id?: string;
  pdf_url?: string | null;
  structured_report: any;
  session: any[];
  timestamp: any;
}

export default function MyCasesPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<UserCase[]>([]);
  const [loading, setLoading] = useState(true);
  const { openChatWithSession } = useGlobalChat();

  useEffect(() => {
    if (!user) return;
    
    const fetchCases = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/cases?uid=${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          setCases(data.cases || []);
        }
      } catch (err) {
        console.error("Failed to fetch cases", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, [user]);

  const handleOpenCase = (c: UserCase) => {
    openChatWithSession(c.session_id || c.case_id, c.session || []);
  };

  const formatDate = (ts: any) => {
    if (!ts) return "Recently";
    // Handle Firestore timestamp format returned via API
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "Recently";
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return "Recently";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-[#00634B]/20 border-t-[#00634B] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      
      {/* Header */}
      <div className="bg-[#00634B] rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl flex items-center justify-between">
        <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
          <FolderOpen size={250} />
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-black mb-3">My Formalized Cases</h1>
          <p className="text-emerald-50/80 text-lg font-medium max-w-xl">
             Your legal consultation history is securely structured and saved below. Review analysis, track evidence, or resume conversations with your AI Assistant instantly.
          </p>
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-gray-100 shadow-sm flex flex-col items-center justify-center">
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
             <Scale className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Cases Found</h2>
          <p className="text-gray-500 max-w-sm">
             You haven't formalized any cases yet. Request a legal analysis of your situation in the chat interface to save your first case.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.map((c, idx) => (
            <div 
              key={idx} 
              onClick={() => handleOpenCase(c)}
              className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer flex flex-col h-full relative overflow-hidden"
            >
              {c.structured_report?.risk_level === "High" && (
                 <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
              )}
              
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-[#00634B] font-black font-mono">
                  #{c.case_id?.substring(0, 4) || "0000"}
                </div>
                <div className="flex items-center gap-2 text-xs font-bold bg-gray-50 px-3 py-1.5 rounded-full text-gray-500">
                  <Calendar size={12} />
                  {formatDate(c.timestamp)}
                </div>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2">
                {c.structured_report?.summary || c.structured_report?.incident_summary || "Legal Consultation Case"}
              </h3>

              <div className="space-y-2 mb-6 flex-1">
                 {c.structured_report?.applicable_laws && c.structured_report.applicable_laws.length > 0 && (
                   <div className="flex flex-wrap gap-2">
                      {c.structured_report.applicable_laws.slice(0, 2).map((law: any, i: number) => (
                        <span key={i} className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-md">
                          {law.section}
                        </span>
                      ))}
                   </div>
                 )}
                 {c.structured_report?.risk_level && (
                    <div className={`mt-2 text-xs font-bold px-2 py-1 rounded-md inline-block ${c.structured_report.risk_level === 'High' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
                      Risk Level: {c.structured_report.risk_level}
                    </div>
                 )}
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between group-hover:text-[#00634B]">
                 <span className="font-bold text-sm">Resume Investigation</span>
                 <ArrowUpRight size={18} className="transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
