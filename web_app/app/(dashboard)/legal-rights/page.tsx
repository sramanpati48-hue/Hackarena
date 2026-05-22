"use client";

import React, { useState, useEffect } from 'react';
import { Scale, Shield, AlertTriangle, Users, Briefcase, FileText, ArrowRight, Loader2, BookOpen } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useGlobalChat } from '@/context/ChatContext';

interface LegalRight {
    id: string;
    title: string;
    description: string;
    action_prompt: string;
}

const iconMap: Record<string, React.ReactNode> = {
    'police-fir-rights': <Shield className="w-8 h-8 text-[#00634B]" />,
    'cyber-fraud-rights': <AlertTriangle className="w-8 h-8 text-rose-500" />,
    'women-legal-rights': <Users className="w-8 h-8 text-purple-500" />,
    'consumer-rights': <Briefcase className="w-8 h-8 text-blue-500" />,
    'employee-rights': <FileText className="w-8 h-8 text-orange-500" />,
    'property-land-rights': <BookOpen className="w-8 h-8 text-amber-600" />,
    'free-legal-aid': <Scale className="w-8 h-8 text-emerald-600" />,
};

export default function LegalRightsPage() {
    const [rights, setRights] = useState<LegalRight[]>([]);
    const [loading, setLoading] = useState(true);
    const { openChatWithQuery } = useGlobalChat();

    useEffect(() => {
        const fetchRights = async () => {
            if (!db) {
                console.error("Legal rights data is unavailable. Please configure Firebase environment variables.");
                setLoading(false);
                return;
            }
            try {
                const snapshot = await getDocs(collection(db, "legal_rights"));
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as LegalRight[];
                
                // Sort to keep consistent order or default
                data.sort((a,b) => a.title.localeCompare(b.title));
                setRights(data);
            } catch (err) {
                console.error("Failed to fetch legal rights:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchRights();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-12 h-12 text-[#00634B] animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header */}
            <div className="bg-[#00634B] rounded-[40px] p-12 text-white relative overflow-hidden shadow-2xl shadow-emerald-900/20">
                <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                    <Scale size={300} />
                </div>
                <div className="relative z-10 max-w-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-emerald-400/20 p-2 rounded-xl backdrop-blur-md">
                            <Scale size={24} className="text-emerald-100" />
                        </div>
                        <span className="text-emerald-100 font-bold tracking-widest uppercase text-sm">Empowerment Hub</span>
                    </div>
                    <h1 className="text-5xl font-black mb-6 leading-tight tracking-tight">Know Your Legal Rights</h1>
                    <p className="text-emerald-50/80 text-xl leading-relaxed font-medium">
                        Information is the first step to justice. Explore crucial Indian legal rights structured for citizens. Select any card to immediately begin an AI consultation on that topic.
                    </p>
                </div>
            </div>

            {/* Rights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rights.map((right) => (
                    <div 
                        key={right.id} 
                        className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col h-full"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                            {iconMap[right.id] || <Scale className="w-8 h-8 text-[#00634B]" />}
                        </div>
                        
                        <h2 className="text-2xl font-black text-gray-900 mb-4 tracking-tight leading-snug">
                            {right.title}
                        </h2>
                        
                        <p className="text-gray-500 font-medium leading-relaxed mb-8 flex-1">
                            {right.description}
                        </p>
                        
                        <button 
                            onClick={() => openChatWithQuery(`${right.title} - what should I do next?`)}
                            className="w-full bg-gray-50 hover:bg-[#00634B] text-gray-700 hover:text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-colors group-hover:shadow-lg group-hover:shadow-[#00634B]/20 active:scale-95"
                        >
                            Ask Legal Assistant
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
