"use client";

import { useAuth } from "@/context/AuthContext";
import { Activity, Briefcase, FileText, Scale, User, Clock } from "lucide-react";
import Link from "next/link";

export default function LawyerDashboard() {
  const { user } = useAuth();

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Lawyer Dashboard</h1>
        <p className="text-neutral-400">Welcome back, {user?.displayName || "Counsel"}. Here is an overview of your practice.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-neutral-200">Total Cases</h3>
            <div className="bg-primary/20 p-2.5 rounded-xl">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">0</p>
          <p className="text-sm text-neutral-500">Active and pending</p>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-neutral-200">Pending Requests</h3>
            <div className="bg-amber-500/20 p-2.5 rounded-xl">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">0</p>
          <p className="text-sm text-neutral-500">Awaiting your acceptance</p>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-neutral-200">Profile Status</h3>
            <div className="bg-emerald-500/20 p-2.5 rounded-xl">
              <User className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">Active</p>
          <p className="text-sm text-neutral-500">Viewable by clients</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                Case Management
            </h3>
            <p className="text-neutral-400 mb-6 text-sm">
                Review new legal requests from clients, accept pending cases, and track your ongoing legal representation duties.
            </p>
            <Link href="/lawyer/cases" className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition-colors text-sm font-medium">
                View Client Cases
            </Link>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Professional Profile
            </h3>
            <p className="text-neutral-400 mb-6 text-sm">
                Update your professional information, bar registration details, specialization, and upload your avatar.
            </p>
            <Link href="/lawyer/profile" className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition-colors text-sm font-medium">
                Manage Profile
            </Link>
        </div>
      </div>
    </div>
  );
}
