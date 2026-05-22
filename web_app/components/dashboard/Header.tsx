import React from 'react';
import Image from 'next/image';
import { Bell, Globe, Search, Mic, ChevronDown, LogIn, UserPlus, LogOut, MessageSquare, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useGlobalChat } from '@/context/ChatContext';

interface Notification {
    id: string;
    title: string;
    message: string;
    time: string;
    type: 'scam' | 'message' | 'case';
    read: boolean;
    payload?: string;
}

export const translations = {
    en: {
        morning: "Good Morning",
        afternoon: "Good Afternoon",
        evening: "Good Evening",
        searchPlaceholder: "What legal issue are you facing?",
        helpText: "How can we help you today?",
        notifMarkRead: "Mark all read",
        notifViewAll: "View All Activities",
        profileTitle: "Profile",
        logout: "Logout",
        login: "Log In",
        signup: "Sign Up",
        urgentHelp: "Need Urgent Help?",
        callNow: "Call Now",
        popularSearches: "Popular Searches:",
        langName: "English",
        searchBtn: "Search",
        aiBadge: "AI Powered Legal Intelligence",
        heroTitle: "Your Trusted AI Legal Companion",
        quickActions: "Quick Actions",
        viewAll: "View All",
        popularServices: "Popular Services",
        caseTracker: "My Case Tracker",
        chatNow: "Chat Now",
        fileCase: "File a Case",
        talkLawyer: "Talk to a Lawyer",
        knowRights: "Know Your Rights",
        trackStatus: "Track Case Status"
    },
    hi: {
        morning: "शुभ प्रभात",
        afternoon: "नमस्कार",
        evening: "शुभ संध्या",
        searchPlaceholder: "आप किस कानूनी समस्या का सामना कर रहे हैं?",
        helpText: "आज हम आपकी कैसे मदद कर सकते हैं?",
        notifMarkRead: "सभी पढ़े गए के रूप में चिह्नित करें",
        notifViewAll: "सभी गतिविधियां देखें",
        profileTitle: "प्रोफ़ाइल",
        logout: "लॉग आउट",
        login: "लॉग इन",
        signup: "साइन अप",
        urgentHelp: "क्या आपको तत्काल सहायता की आवश्यकता है?",
        callNow: "अभी कॉल करें",
        popularSearches: "लोकप्रिय खोजें:",
        langName: "हिंदी",
        searchBtn: "खोजें",
        aiBadge: "एआई संचालित कानूनी खुफिया",
        heroTitle: "आपका विश्वसनीय एआई कानूनी साथी",
        quickActions: "त्वरित कार्रवाई",
        viewAll: "सभी देखें",
        popularServices: "लोकप्रिय सेवाएं",
        caseTracker: "मेरा केस ट्रैकर",
        chatNow: "अभी चैट करें",
        fileCase: "केस दर्ज करें",
        talkLawyer: "वकील से बात करें",
        knowRights: "अपने अधिकार जानें",
        trackStatus: "केस की स्थिति ट्रैक करें"
    },
    bn: {
        morning: "সুপ্রভাত",
        afternoon: "শুভ অপরাহ্ন",
        evening: "শুভ সন্ধ্যা",
        searchPlaceholder: "আপনি কি আইনি সমস্যার সম্মুখীন হচ্ছেন?",
        helpText: "আজ আমরা আপনাকে কিভাবে সাহায্য করতে পারি?",
        notifMarkRead: "সব পড়া হয়েছে হিসেবে চিহ্নিত করুন",
        notifViewAll: "সব কার্যক্রম দেখুন",
        profileTitle: "প্রোফাইল",
        logout: "লগ আউট",
        login: "লগ ইন",
        signup: "সাইন আপ",
        urgentHelp: "জরুরি সাহায্য প্রয়োজন?",
        callNow: "এখনই কল করুন",
        popularSearches: "জনপ্রিয় অনুসন্ধান:",
        langName: "বাংলা",
        searchBtn: "অনুসন্ধান",
        aiBadge: "এআই চালিত আইনি বুদ্ধিমত্তা",
        heroTitle: "আপনার বিশ্বস্ত এআই আইনি সঙ্গী",
        quickActions: "দ্রুত পদক্ষেপ",
        viewAll: "সব দেখুন",
        popularServices: "জনপ্রিয় পরিষেবা",
        caseTracker: "আমার কেস ট্র্যাকার",
        chatNow: "এখনই চ্যাট করুন",
        fileCase: "মামলা দায়ের করুন",
        talkLawyer: "আইনজীবীর সাথে কথা বলুন",
        knowRights: "আপনার অধিকার জানুন",
        trackStatus: "মামলার স্থিতি ট্র্যাক করুন"
    }
};

type Language = 'en' | 'hi' | 'bn';

interface HeaderProps {
    // language and onLanguageChange removal as we use context now
}

export const DashboardHeader = () => {
    const { user, logout } = useAuth();
    const router = useRouter();
    const { language, setLanguage } = useLanguage();
    const { openChatWithQuery } = useGlobalChat();
    const [greeting, setGreeting] = React.useState("");
    const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
    const [isLanguageOpen, setIsLanguageOpen] = React.useState(false);
    const [notifications, setNotifications] = React.useState<Notification[]>([
        {
            id: '2',
            title: 'Lawyer Message',
            message: 'Adv. John Doe replied to your property dispute query.',
            time: '1 hour ago',
            type: 'message',
            read: true
        },
        {
            id: '3',
            title: 'Case Update',
            message: 'Your cyber fraud report has been successfully filed with the cyber cell.',
            time: '3 hours ago',
            type: 'case',
            read: true
        }
    ]);

    // Fetch nearby scams on load
    React.useEffect(() => {
        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/scams/nearby?lat=${latitude}&lon=${longitude}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.scams && data.scams.length > 0) {
                            // Calculate nearest scam
                            const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                                const R = 6371; // Earth radius in km
                                const dLat = (lat2 - lat1) * (Math.PI / 180);
                                const dLon = (lon2 - lon1) * (Math.PI / 180);
                                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                return R * c;
                            };

                            let nearestScam = data.scams[0];
                            let minDistance = haversineDistance(latitude, longitude, nearestScam.lat, nearestScam.lon);

                            for (let i = 1; i < data.scams.length; i++) {
                                const dist = haversineDistance(latitude, longitude, data.scams[i].lat, data.scams[i].lon);
                                if (dist < minDistance) {
                                    minDistance = dist;
                                    nearestScam = data.scams[i];
                                }
                            }

                            // Deduplicate or replace existing scam notification
                            setNotifications(prev => {
                                const filtered = prev.filter(n => n.type !== 'scam');
                                return [{
                                    id: `scam-${Date.now()}`,
                                    title: `🚨 Scam Alert: ${nearestScam.city}`,
                                    message: nearestScam.title.length > 80 ? nearestScam.title.substring(0, 80) + '...' : nearestScam.title, 
                                    payload: JSON.stringify({
                                        lat: nearestScam.lat,
                                        lon: nearestScam.lon,
                                        title: nearestScam.title
                                    }), 
                                    time: 'Just now',
                                    type: 'scam',
                                    read: false
                                }, ...filtered];
                            });
                        }
                    }
                } catch (err) {
                    console.error("Failed to fetch nearby scams:", err);
                }
            },
            (error) => {
                console.warn("Geolocation denied or failed:", error);
            }
        );
    }, []);

    const displayName = user?.displayName || user?.email?.split('@')[0] || "Guest";
    const firstName = displayName.split(' ')[0];

    React.useEffect(() => {
        const hour = new Date().getHours();
        const t = translations[language];
        if (hour < 12) setGreeting(t.morning);
        else if (hour < 17) setGreeting(t.afternoon);
        else setGreeting(t.evening);
    }, [language]);

    return (
        <header className="flex items-center justify-between mb-8">
            <div className="animate-in fade-in slide-in-from-left duration-700">
                <h2 className="text-2xl font-bold text-gray-900">
                    {greeting}, <span className="text-[#00634B]">{firstName}!</span>
                </h2>
                <p className="text-gray-500 text-sm">{translations[language].helpText}</p>
            </div>

            <div className="flex items-center gap-6">
                <div className="relative group">
                    <button
                        onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                        className={`p-2.5 rounded-full border shadow-sm transition-all relative ${isNotificationsOpen ? 'bg-emerald-50 border-[#00634B] text-[#00634B]' : 'bg-white border-gray-200 text-gray-600 hover:border-[#00634B] hover:bg-gray-50'
                            }`}
                    >
                        <Bell size={20} className="transition-colors" />
                        {user && (
                            <span className="absolute -top-1 -right-1 bg-[#F57C00] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#F8F9FA] group-hover:scale-110 transition-transform">
                                {notifications.filter(n => !n.read).length}
                            </span>
                        )}
                    </button>

                    {/* Notification Dropdown */}
                    {isNotificationsOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setIsNotificationsOpen(false)}
                            />
                            <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-emerald-50/30">
                                    <h3 className="font-bold text-gray-900">Notifications</h3>
                                    {user && <button className="text-[10px] font-bold text-[#00634B] uppercase tracking-wider hover:underline">{translations[language].notifMarkRead}</button>}
                                </div>
                                <div className="max-h-[400px] overflow-y-auto">
                                    {user ? (
                                        notifications.length > 0 ? (
                                            notifications.map((notif) => (
                                                <div 
                                                    key={notif.id} 
                                                    className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer group/item ${!notif.read ? 'bg-emerald-50/20' : ''}`}
                                                    onClick={() => {
                                                        if (notif.type === 'scam') {
                                                            setIsNotificationsOpen(false);
                                                            if (notif.payload) {
                                                                try {
                                                                    const payloadData = JSON.parse(notif.payload);
                                                                    router.push(`/scam-heatmap?scamLat=${payloadData.lat}&scamLon=${payloadData.lon}&scamTitle=${encodeURIComponent(payloadData.title)}`);
                                                                } catch (e) {
                                                                    router.push('/scam-heatmap');
                                                                }
                                                            } else {
                                                                router.push('/scam-heatmap');
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <div className="flex gap-3">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${notif.type === 'scam' ? 'bg-orange-100 text-orange-600' :
                                                            notif.type === 'message' ? 'bg-blue-100 text-blue-600' :
                                                                'bg-emerald-100 text-emerald-600'
                                                            }`}>
                                                            {notif.type === 'scam' ? <ShieldAlert size={20} /> :
                                                                notif.type === 'message' ? <MessageSquare size={20} /> :
                                                                    <CheckCircle2 size={20} />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start mb-0.5">
                                                                <p className="text-sm font-bold text-gray-900 leading-tight truncate pr-4">{notif.title}</p>
                                                                {!notif.read && <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-1" />}
                                                            </div>
                                                            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-1">{notif.message}</p>
                                                            <p className="text-[10px] font-medium text-gray-400">{notif.time}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center">
                                                <Bell className="mx-auto text-gray-200 mb-2" size={32} />
                                                <p className="text-sm text-gray-400">No new notifications</p>
                                            </div>
                                        )
                                    ) : (
                                        <div className="p-8 text-center space-y-4">
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                                                <LogIn className="text-gray-300" size={28} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">Sign in for alerts</p>
                                                <p className="text-xs text-gray-500 mt-1">Get real-time updates on your cases and scam warnings.</p>
                                            </div>
                                            <Link href="/login" onClick={() => setIsNotificationsOpen(false)}>
                                                <button className="w-full bg-[#00634B] text-white py-2 rounded-xl text-xs font-bold hover:bg-[#004D3C] transition-all">Log In Now</button>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 bg-gray-50/50 border-t border-gray-50 text-center">
                                    <button className="text-xs font-bold text-gray-500 hover:text-[#00634B] transition-colors">{translations[language].notifViewAll}</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="relative group">
                    <button
                        onClick={() => setIsLanguageOpen(!isLanguageOpen)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border shadow-sm text-sm font-bold transition-all ${isLanguageOpen ? 'bg-emerald-50 border-[#00634B] text-[#00634B]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                            }`}
                    >
                        <Globe size={18} className={isLanguageOpen ? 'text-[#00634B]' : 'text-gray-500'} />
                        {translations[language].langName}
                        <ChevronDown size={14} className={`transition-transform duration-200 ${isLanguageOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isLanguageOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsLanguageOpen(false)} />
                            <div className="absolute right-0 mt-2 w-40 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                {(['en', 'hi', 'bn'] as const).map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={() => {
                                            setLanguage(lang);
                                            setIsLanguageOpen(false);
                                        }}
                                        className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-emerald-50 flex items-center justify-between ${language === lang ? 'text-[#00634B] bg-emerald-50/50' : 'text-gray-700'
                                            }`}
                                    >
                                        {translations[lang].langName}
                                        {language === lang && <div className="w-1.5 h-1.5 rounded-full bg-[#00634B]" />}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {user ? (
                    <div className="flex items-center gap-4 pl-4 border-l border-gray-200">
                        <div className="flex items-center gap-3 group cursor-pointer">
                            <div className="text-right">
                                <p className="text-xs text-gray-500">{displayName}</p>
                                <p className="text-sm font-bold text-gray-900 flex items-center gap-1 group-hover:text-[#00634B] transition-colors">
                                    {displayName} <ChevronDown size={14} />
                                </p>
                            </div>
                            <div className="w-10 h-10 relative rounded-full overflow-hidden border-2 border-white shadow-sm ring-2 ring-[#00C853] group-hover:ring-[#00634B] transition-all">
                                {user?.photoURL ? (
                                    <Image src={user.photoURL} alt="Profile" fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                                        {displayName[0]}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title={translations[language].logout}
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                        <Link href="/login">
                            <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-100 transition-all">
                                <LogIn size={18} />
                                {translations[language].login}
                            </button>
                        </Link>
                        <Link href="/signup">
                            <button className="flex items-center gap-2 bg-[#00634B] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/10 hover:bg-[#004D3C] transition-all">
                                <UserPlus size={18} />
                                {translations[language].signup}
                            </button>
                        </Link>
                    </div>
                )}
            </div>
        </header>
    );
};

export const HeroSearch = () => {
    const { language } = useLanguage();
    const popularTags = ["Property Dispute", "Divorce", "FIR", "Consumer Rights", "Labour Law"];
    const t = translations[language];

    const heroTitleParts = t.heroTitle.split(" AI ");
    const heroTitleFirst = heroTitleParts[0];
    const heroTitleSecond = heroTitleParts[1] || "";

    return (
        <div className="relative bg-emerald-50/50 rounded-[2px] overflow-hidden mb-12 shadow-sm border border-emerald-100 group">
            {/* Decorative background gradients (low occupancy) */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/30"></div>

            {/* Ambient glows */}
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-200/20 rounded-full blur-[80px]"></div>
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-200/20 rounded-full blur-[10px]"></div>

            {/* Hero artwork as watermark */}
            <div className="absolute inset-0 opacity-[0.4] mix-blend-multiply pointer-events-none group-hover:scale-105 transition-transform duration-1000">
                <Image src="/4.png" alt="Hero Background" fill className="object-cover" />
            </div>

            <div className="relative px-12 py-16 flex flex-col items-start gap-8">
                <div className="max-w-2xl space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/50 border border-emerald-200 text-emerald-800 text-xs font-bold tracking-wider uppercase">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        {t.aiBadge}
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 tracking-tight leading-tight">
                        {heroTitleFirst} <br />
                        <span className="text-[#00634B]">AI {heroTitleSecond}</span>
                    </h1>
                    <p className="text-gray-600 text-lg max-w-lg">
                        Get instant legal guidance, case analysis, and procedural support at your fingertips.
                    </p>
                </div>

                <div className="w-full max-w-2xl">
                    <div className="flex items-center bg-white p-2 rounded-2xl shadow-xl shadow-emerald-900/5 gap-2 mb-6 border border-emerald-100 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all">
                        <Search className="text-emerald-700 ml-3" size={24} />
                        <input
                            type="text"
                            placeholder={t.searchPlaceholder}
                            className="flex-1 text-lg outline-none placeholder:text-gray-400 bg-transparent text-gray-900 py-3"
                        />
                        <div className="h-10 w-px bg-gray-100 mx-2"></div>
                        <button className="p-3 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-all rounded-xl">
                            <Mic size={24} />
                        </button>
                        <button className="bg-[#00634B] text-white px-10 py-4 rounded-xl font-bold flex items-center gap-2 hover:bg-[#004D3C] shadow-lg shadow-emerald-900/20 transform active:scale-95 transition-all">
                            <Search size={20} />
                            {t.searchBtn}
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-gray-500 text-sm font-medium">{t.popularSearches}</span>
                        <div className="flex flex-wrap gap-2">
                            {popularTags.map((tag) => (
                                <button
                                    key={tag}
                                    className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition-all border border-emerald-100/50"
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
