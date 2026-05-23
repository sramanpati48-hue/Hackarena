"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Home, LogOut, User } from "lucide-react";
import { ChatProvider } from "@/context/ChatContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { LawyerProvider } from "@/context/LawyerContext";

function ChatLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* Minimal Top Navbar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-xl z-50 flex-shrink-0">
        {/* Left: Branding */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 relative flex-shrink-0 bg-white rounded-xl border border-gray-100 shadow-md flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-emerald-200/60">
            <div className="w-6 h-6 relative">
              <Image src="/2.png" alt="NyaySahayak" fill className="object-contain" />
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[#00634B] font-black text-base tracking-tight">
              Nyay<span className="text-gray-900">Sahayak</span>
            </span>
            <span className="text-gray-400 text-[9px] font-bold uppercase tracking-[0.15em]">
              AI Playground
            </span>
          </div>
        </Link>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Link href="/">
            <button className="flex items-center gap-2 text-gray-500 hover:text-[#00634B] hover:bg-emerald-50 px-3 py-2 rounded-xl transition-all text-sm font-semibold">
              <Home size={16} />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
          </Link>

          {user && (
            <>
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
                <User size={14} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-600 max-w-[120px] truncate hidden sm:inline">
                  {user.email?.split("@")[0]}
                </span>
              </div>

              <button
                onClick={logout}
                className="flex items-center gap-2 text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl transition-all text-sm font-semibold"
                title="Logout"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Full Screen Chat Area */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <LanguageProvider>
        <LawyerProvider>
          <ChatLayoutContent>{children}</ChatLayoutContent>
        </LawyerProvider>
      </LanguageProvider>
    </ChatProvider>
  );
}
