"use client";

import { useEffect, useRef, useState } from "react";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { Scale, Shield, Zap, Sparkles, ArrowDown } from "lucide-react";

const FEATURES = [
    {
        icon: Scale,
        label: "Multi-Agent AI",
        desc: "Specialized agents for every legal domain",
        color: "from-emerald-500/10 to-teal-500/10",
        border: "border-emerald-500/20",
        iconColor: "text-emerald-600",
    },
    {
        icon: Shield,
        label: "Verified Legal Intel",
        desc: "Responses moderated by legal experts",
        color: "from-blue-500/10 to-indigo-500/10",
        border: "border-blue-500/20",
        iconColor: "text-blue-600",
    },
    {
        icon: Zap,
        label: "Real-Time Streaming",
        desc: "Instant answers with live agent logs",
        color: "from-amber-500/10 to-orange-500/10",
        border: "border-amber-500/20",
        iconColor: "text-amber-600",
    },
];

export default function FindHelpPage() {
    const [revealed, setRevealed] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const chatRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const t = setTimeout(() => setRevealed(true), 80);
        return () => clearTimeout(t);
    }, []);

    const scrollToChat = () => {
        setShowChat(true);
        setTimeout(() => {
            chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
    };

    return (
        <div className="relative min-h-screen bg-[#F8F9FA] overflow-x-hidden">

            {/* ── Animated gradient orbs (background) ── */}
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
            >
                <div
                    style={{
                        background:
                            "radial-gradient(ellipse 70% 60% at 20% -10%, rgba(0,99,75,0.08) 0%, transparent 70%)",
                    }}
                    className="absolute inset-0"
                />
                <div
                    style={{
                        background:
                            "radial-gradient(ellipse 50% 50% at 85% 110%, rgba(0,99,75,0.05) 0%, transparent 70%)",
                    }}
                    className="absolute inset-0"
                />
                {/* Floating particles */}
                {[...Array(6)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full bg-[#00634B]/5 animate-pulse"
                        style={{
                            width: `${40 + i * 25}px`,
                            height: `${40 + i * 25}px`,
                            top: `${10 + i * 13}%`,
                            left: `${5 + i * 15}%`,
                            animationDelay: `${i * 0.7}s`,
                            animationDuration: `${3 + i}s`,
                        }}
                    />
                ))}
            </div>

            {/* ── Hero Section ── */}
            <section className="relative max-w-5xl mx-auto px-6 pt-12 pb-10">

                {/* Eyebrow pill */}
                <div
                    className="flex justify-center mb-6"
                    style={{
                        opacity: revealed ? 1 : 0,
                        transform: revealed ? "translateY(0)" : "translateY(16px)",
                        transition: "all 0.5s cubic-bezier(.4,0,.2,1)",
                    }}
                >
                    <div className="inline-flex items-center gap-2 bg-[#00634B]/8 border border-[#00634B]/20 text-[#00634B] text-[11px] font-black uppercase tracking-[0.18em] px-4 py-2 rounded-full">
                        <Sparkles size={12} className="animate-pulse" />
                        AI-Powered Legal Assistant
                        <Sparkles size={12} className="animate-pulse" />
                    </div>
                </div>

                {/* Main headline */}
                <div
                    className="text-center mb-4"
                    style={{
                        opacity: revealed ? 1 : 0,
                        transform: revealed ? "translateY(0)" : "translateY(24px)",
                        transition: "all 0.65s cubic-bezier(.4,0,.2,1) 0.1s",
                    }}
                >
                    <h1 className="text-5xl md:text-6xl font-black text-gray-900 tracking-tight leading-[1.05]">
                        Find Legal{" "}
                        <span
                            style={{
                                background: "linear-gradient(135deg, #00634B 0%, #028C6A 50%, #00A37A 100%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                backgroundClip: "text",
                            }}
                        >
                            Help
                        </span>
                        , Instantly
                    </h1>
                </div>

                {/* Subtitle */}
                <div
                    className="text-center mb-10"
                    style={{
                        opacity: revealed ? 1 : 0,
                        transform: revealed ? "translateY(0)" : "translateY(20px)",
                        transition: "all 0.65s cubic-bezier(.4,0,.2,1) 0.2s",
                    }}
                >
                    <p className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed">
                        Describe your situation and our multi-agent AI will guide you through
                        property disputes, cyber fraud, consumer rights, and more.
                    </p>
                </div>

                {/* Feature Pills */}
                <div
                    className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10"
                    style={{
                        opacity: revealed ? 1 : 0,
                        transform: revealed ? "translateY(0)" : "translateY(20px)",
                        transition: "all 0.65s cubic-bezier(.4,0,.2,1) 0.3s",
                    }}
                >
                    {FEATURES.map(({ icon: Icon, label, desc, color, border, iconColor }) => (
                        <div
                            key={label}
                            className={`relative bg-gradient-to-br ${color} border ${border} rounded-3xl p-5 flex items-start gap-4 hover:scale-[1.03] hover:shadow-lg transition-all duration-300 cursor-default group overflow-hidden`}
                        >
                            {/* subtle grid pattern */}
                            <div
                                aria-hidden
                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                style={{
                                    backgroundImage:
                                        "radial-gradient(circle, rgba(0,99,75,0.04) 1px, transparent 1px)",
                                    backgroundSize: "18px 18px",
                                }}
                            />
                            <div className={`w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm flex-shrink-0 ${iconColor}`}>
                                <Icon size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-800 text-sm">{label}</p>
                                <p className="text-gray-500 text-xs mt-0.5 leading-snug">{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA — scroll to chat */}
                {!showChat && (
                    <div
                        className="flex justify-center"
                        style={{
                            opacity: revealed ? 1 : 0,
                            transform: revealed ? "translateY(0)" : "translateY(20px)",
                            transition: "all 0.65s cubic-bezier(.4,0,.2,1) 0.45s",
                        }}
                    >
                        <button
                            onClick={scrollToChat}
                            className="group flex items-center gap-3 bg-[#00634B] text-white px-8 py-4 rounded-full font-bold text-base shadow-xl shadow-[#00634B]/25 hover:bg-[#004D3C] hover:shadow-2xl hover:shadow-[#00634B]/30 hover:-translate-y-1 active:scale-95 transition-all duration-300"
                        >
                            Start a Conversation
                            <span className="bg-white/20 rounded-full p-1 group-hover:translate-y-0.5 transition-transform">
                                <ArrowDown size={16} />
                            </span>
                        </button>
                    </div>
                )}
            </section>

            {/* ── Divider with label ── */}
            {showChat && (
                <div
                    className="flex items-center gap-4 max-w-5xl mx-auto px-6 mb-4 animate-in fade-in slide-in-from-top-4 duration-500"
                >
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-gray-200" />
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                        <div className="w-2 h-2 bg-[#00634B] rounded-full animate-pulse" />
                        NyayaSahayak AI
                        <div className="w-2 h-2 bg-[#00634B] rounded-full animate-pulse" />
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-l from-transparent via-gray-200 to-gray-200" />
                </div>
            )}

            {/* ── Chat Section ── */}
            <div ref={chatRef} className="relative max-w-7xl mx-auto px-4 pb-8">
                {showChat ? (
                    <div
                        className="animate-in fade-in slide-in-from-bottom-6 duration-700 rounded-[2rem] overflow-hidden shadow-2xl shadow-[#00634B]/10 border border-gray-100"
                        style={{ height: "calc(100vh - 120px)", minHeight: "600px" }}
                    >
                        <ChatInterface />
                    </div>
                ) : (
                    /* Preview / teaser card */
                    <div
                        className="relative rounded-[2rem] overflow-hidden border border-gray-100 shadow-xl shadow-gray-100/50 bg-white cursor-pointer group"
                        onClick={scrollToChat}
                        style={{
                            opacity: revealed ? 1 : 0,
                            transform: revealed ? "translateY(0)" : "translateY(28px)",
                            transition: "all 0.7s cubic-bezier(.4,0,.2,1) 0.5s",
                        }}
                    >
                        {/* Frosted overlay prompt */}
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white/80 backdrop-blur-sm group-hover:bg-white/60 transition-all duration-300">
                            <div className="bg-[#00634B] text-white px-6 py-3 rounded-full font-bold text-sm shadow-lg shadow-[#00634B]/20 flex items-center gap-2 group-hover:scale-105 transition-transform duration-300">
                                <Sparkles size={16} className="animate-pulse" />
                                Click to Open Chat
                            </div>
                            <p className="text-gray-400 text-xs font-medium">
                                Powered by NyayaSahayak multi-agent AI
                            </p>
                        </div>

                        {/* Blurred chat skeleton */}
                        <div className="filter blur-sm pointer-events-none" style={{ height: "480px" }}>
                            {/* Fake header */}
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-[#E6F0ED]" />
                                    <div className="h-4 w-36 bg-gray-100 rounded-full" />
                                </div>
                                <div className="h-6 w-24 bg-gray-100 rounded-full" />
                            </div>
                            {/* Fake messages */}
                            <div className="p-8 space-y-6">
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-[#E6F0ED] flex-shrink-0" />
                                    <div className="space-y-2 flex-1">
                                        <div className="h-4 w-3/4 bg-gray-100 rounded-full" />
                                        <div className="h-4 w-1/2 bg-gray-100 rounded-full" />
                                    </div>
                                </div>
                                <div className="flex gap-4 flex-row-reverse">
                                    <div className="w-10 h-10 rounded-2xl bg-gray-100 flex-shrink-0" />
                                    <div className="space-y-2 flex-1 items-end flex flex-col">
                                        <div className="h-4 w-2/3 bg-[#E6F0ED] rounded-full" />
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-[#E6F0ED] flex-shrink-0" />
                                    <div className="space-y-2 flex-1">
                                        <div className="h-4 w-5/6 bg-gray-100 rounded-full" />
                                        <div className="h-4 w-3/5 bg-gray-100 rounded-full" />
                                        <div className="h-4 w-2/3 bg-gray-100 rounded-full" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
