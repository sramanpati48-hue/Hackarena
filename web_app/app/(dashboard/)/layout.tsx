"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardHeader } from "@/components/dashboard/Header";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { MessageCircle, X } from "lucide-react";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import { LawyerProvider } from "@/context/LawyerContext";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
    const [isChatOpen, setIsChatOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-[#F8F9FA] relative">
            <Sidebar />
            <main className="flex-1 ml-64 p-8 overflow-x-hidden">
                <DashboardHeader />
                {children}
            </main>

            {/* Floating Chat Button */}
            <div className="fixed bottom-8 right-8 z-50 flex items-center gap-4 group">
                {!isChatOpen && (
                    <div className="bg-white px-4 py-2 rounded-xl shadow-lg border border-gray-100 text-[#00634B] font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity animate-in slide-in-from-right-2">
                        Need Legal Help?
                    </div>
                )}
                <button
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className="w-16 h-16 bg-[#00634B] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all ring-4 ring-white"
                >
                    {isChatOpen ? <X size={32} /> : <MessageCircle size={32} />}
                </button>
            </div>

            {/* Chat Interface Overlay */}
            {isChatOpen && (
                <div className="fixed inset-0 z-40">
                    <div
                        className="absolute inset-0 bg-gray-900/40 backdrop-blur-md animate-in fade-in duration-500"
                        onClick={() => setIsChatOpen(false)}
                    />
                    <div className="absolute right-0 top-0 w-full max-w-4xl h-full bg-white shadow-2xl animate-in slide-in-from-right duration-500 ring-1 ring-black/5">
                        <ChatInterface />
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <LanguageProvider>
            <LawyerProvider>
                <DashboardLayoutContent>{children}</DashboardLayoutContent>
            </LawyerProvider>
        </LanguageProvider>
    );
}
