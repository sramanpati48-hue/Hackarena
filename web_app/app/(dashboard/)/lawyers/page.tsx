"use client";

import { useLanguage } from "@/context/LanguageContext";
import { Briefcase, Users, Star, ArrowRight, UserPlus, CheckCircle2, ShieldCheck, Globe } from "lucide-react";

export default function LawyersPage() {
    const { language } = useLanguage();

    const t = {
        en: {
            title: "Expert Dashboard",
            subtitle: "Manage your legal services and professional profile.",
            stats: {
                clients: "Total Clients",
                cases: "Active Cases",
                rating: "Average Rating"
            },
            actions: {
                listService: "List New Service",
                manageProfile: "Edit Profile",
                documents: "Legal Documents"
            },
            whyJoin: "Why join NyaySahayak?",
            benefits: [
                "Reach verified clients in need of immediate help",
                "Streamlined case management and document sharing",
                "Professional profile with verified badges",
                "Integrated multi-language consultation tools"
            ],
            joinCta: "Register as Legal Expert"
        },
        hi: {
            title: "विशेषज्ञ डैशबोर्ड",
            subtitle: "अपनी कानूनी सेवाओं और पेशेवर प्रोफाइल का प्रबंधन करें।",
            stats: {
                clients: "कुल ग्राहक",
                cases: "सक्रिय मामले",
                rating: "औसत रेटिंग"
            },
            actions: {
                listService: "नई सेवा सूचीबद्ध करें",
                manageProfile: "प्रोफ़ाइल संपादित करें",
                documents: "कानूनी दस्तावेज"
            },
            whyJoin: "न्यायसहायक में क्यों शामिल हों?",
            benefits: [
                "तत्काल सहायता की आवश्यकता वाले सत्यापित ग्राहकों तक पहुंचें",
                "सुव्यवस्थित मामला प्रबंधन और दस्तावेज साझा करना",
                "सत्यापित बैज के साथ पेशेवर प्रोफ़ाइल",
                "एकीकृत बहु-भाषा परामर्श उपकरण"
            ],
            joinCta: "कानूनी विशेषज्ञ के रूप में पंजीकरण करें"
        },
        bn: {
            title: "বিশেষজ্ঞ ড্যাশবোর্ড",
            subtitle: "আপনার আইনি পরিষেবা এবং পেশাদার প্রোফাইল পরিচালনা করুন।",
            stats: {
                clients: "মোট গ্রাহক",
                cases: "সক্রিয় মামলা",
                rating: "গড় রেটিং"
            },
            actions: {
                listService: "নতুন পরিষেবা তালিকাভুক্ত করুন",
                manageProfile: "প্রোফাইল সম্পাদন করুন",
                documents: "আইনি নথি"
            },
            whyJoin: "কেন ন্যায়সহায়কে যোগ দেবেন?",
            benefits: [
                "তাৎক্ষণিক সাহায্যের প্রয়োজনে যাচাইকৃত গ্রাহকদের কাছে পৌঁছান",
                "সুবিন্যস্ত মামলা পরিচালনা এবং নথি ভাগ করে নেওয়া",
                "যাচাইকৃত ব্যাজ সহ পেশাদার প্রোফাইল",
                "একীভূত বহু-ভাষা পরামর্শ সরঞ্জাম"
            ],
            joinCta: "আইনি বিশেষজ্ঞ হিসেবে নিবন্ধন করুন"
        }
    }[language];

    const stats = [
        { label: t.stats.clients, value: "124", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
        { label: t.stats.cases, value: "18", icon: Briefcase, color: "text-[#00634B]", bg: "bg-emerald-50" },
        { label: t.stats.rating, value: "4.9", icon: Star, color: "text-amber-500", bg: "bg-amber-50" },
    ];

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-12">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{t.title}</h1>
                    <p className="text-gray-500 text-lg">{t.subtitle}</p>
                </div>
                <button className="bg-[#00634B] text-white px-8 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-[#00634B]/20 hover:scale-105 active:scale-95 transition-all">
                    <UserPlus size={20} /> {t.joinCta}
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm flex items-center gap-6">
                        <div className={`${stat.bg} ${stat.color} p-4 rounded-3xl`}>
                            <stat.icon size={32} />
                        </div>
                        <div>
                            <p className="text-gray-500 text-sm font-medium">{stat.label}</p>
                            <h3 className="text-3xl font-black text-gray-900">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Benefits Section */}
                <div className="bg-[#00634B] rounded-[48px] p-12 text-white relative overflow-hidden shadow-2xl">
                    <div className="relative z-10">
                        <h2 className="text-3xl font-bold mb-8">{t.whyJoin}</h2>
                        <div className="space-y-6">
                            {t.benefits.map((benefit, i) => (
                                <div key={i} className="flex items-start gap-4">
                                    <div className="bg-white/20 p-1.5 rounded-full mt-1">
                                        <CheckCircle2 size={18} className="text-emerald-200" />
                                    </div>
                                    <p className="text-lg font-medium text-emerald-50/90">{benefit}</p>
                                </div>
                            ))}
                        </div>
                        <button className="mt-12 bg-white text-[#00634B] px-10 py-4 rounded-2xl font-black flex items-center gap-2 hover:bg-emerald-50 transition-all">
                            Learn More <ArrowRight size={20} />
                        </button>
                    </div>
                    {/* Decorative Elements */}
                    <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
                    <div className="absolute -left-16 -top-16 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl"></div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-6">
                    <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8">
                        <h3 className="text-2xl font-bold text-gray-900">Professional Tools</h3>
                        <div className="grid grid-cols-1 gap-4">
                            {[
                                { title: t.actions.listService, icon: Globe, desc: "Create a new legal service offering" },
                                { title: t.actions.manageProfile, icon: ShieldCheck, desc: "Edit your bio, rates, and specialization" },
                                { title: t.actions.documents, icon: Briefcase, desc: "Access case files and client papers" }
                            ].map((action, i) => (
                                <button key={i} className="flex items-center gap-6 p-6 rounded-3xl hover:bg-emerald-50 transition-all border border-transparent hover:border-emerald-100 group text-left">
                                    <div className="bg-gray-50 text-gray-500 p-3 rounded-2xl group-hover:bg-[#00634B] group-hover:text-white transition-all">
                                        <action.icon size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">{action.title}</h4>
                                        <p className="text-gray-500 text-sm">{action.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Verification Badge Info */}
            <div className="bg-emerald-50/50 rounded-[40px] p-8 border border-emerald-100 flex items-center gap-6">
                <div className="bg-[#00634B] text-white p-4 rounded-3xl shadow-lg">
                    <ShieldCheck size={40} />
                </div>
                <div>
                    <h4 className="text-xl font-bold text-[#00634B]">Verified Practitioner Badge</h4>
                    <p className="text-[#00634B]/70 max-w-2xl">
                        All lawyers on NyaySahayak must undergo a rigorous verification process, including Bar Council registration check and expert peer review.
                    </p>
                </div>
            </div>
        </div>
    );
}
