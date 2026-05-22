import React from 'react';
import Image from 'next/image';
import {
    ArrowRight,
    Users,
    Home,
    Scale,
    Briefcase,
    Heart,
    Building2,
    ShieldAlert,
    Plus,
    Clock,
    MessageCircle,
    ChevronRight,
    Calendar
} from 'lucide-react';
import { translations } from './Header';
import { useLanguage } from '@/context/LanguageContext';
import { useCases } from '@/context/CaseContext';

export const PopularServices = () => {
    const { language } = useLanguage();
    const t = translations[language];
    const services = [
        {
            name: language === 'en' ? "Family Law" : (language === 'hi' ? "पारिवारिक कानून" : "পারিবারিক আইন"),
            icon: Users,
            desc: language === 'en' ? "Divorce, Maintenance" : (language === 'hi' ? "तलाक, रखरखाव" : "বিবাহবিচ্ছেদ, ভরণপোষণ"),
            color: "bg-[#FFF4E5]",
            iconColor: "text-[#F57C00]"
        },
        {
            name: language === 'en' ? "Property" : (language === 'hi' ? "संपत्ति" : "সম্পত্তি"),
            icon: Home,
            desc: language === 'en' ? "Disputes, Registrations" : (language === 'hi' ? "विवाद, पंजीकरण" : "বিরোধ, নিবন্ধন"),
            color: "bg-[#E6F0ED]",
            iconColor: "text-[#00634B]"
        },
        {
            name: language === 'en' ? "Criminal" : (language === 'hi' ? "आपराधिक" : "ফৌজদারি"),
            icon: Scale,
            desc: language === 'en' ? "FIR, Bail, Defense" : (language === 'hi' ? "एफआईआर, जमानत, बचाव" : "এফআইআর, জামিন, প্রতিরক্ষা"),
            color: "bg-[#FFF4F0]",
            iconColor: "text-[#FF5722]"
        },
        {
            name: language === 'en' ? "Employment" : (language === 'hi' ? "रोजगार" : "কর্মসংস্থান"),
            icon: Briefcase,
            desc: language === 'en' ? "Workplace Rights" : (language === 'hi' ? "कार्यस्थल अधिकार" : "কর্মক্ষেত্রের অধিকার"),
            color: "bg-[#E0F2F1]",
            iconColor: "text-[#009688]"
        },
        {
            name: language === 'en' ? "Consumer" : (language === 'hi' ? "उपभोक्ता" : "ভোক্তা"),
            icon: ShieldAlert,
            desc: language === 'en' ? "Complaints, Refunds" : (language === 'hi' ? "शिकायतें, धनवापसी" : "অভিযোগ, ফেরত"),
            color: "bg-[#F3F4FB]",
            iconColor: "text-[#4338CA]"
        },
        {
            name: language === 'en' ? "Cyber Law" : (language === 'hi' ? "साइबर कानून" : "সাইবার আইন"),
            icon: ShieldAlert,
            desc: language === 'en' ? "Fraud, Privacy" : (language === 'hi' ? "धोखाधड़ी, गोपनीयता" : "প্রতারণা, গোপনীয়তা"),
            color: "bg-[#E3F2FD]",
            iconColor: "text-[#1E88E5]"
        },
    ];

    return (
        <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">{t.popularServices}</h3>
                <button className="text-[#00634B] text-sm font-semibold flex items-center gap-1 hover:underline">
                    {t.viewAll} <ArrowRight size={16} />
                </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
                {services.map((service, index) => (
                    <div key={index} className="bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group">
                        <div className={`${service.color} ${service.iconColor} p-3 rounded-2xl group-hover:scale-110 transition-transform`}>
                            <service.icon size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 text-sm">{service.name}</h4>
                            <p className="text-gray-400 text-xs">{service.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const CaseTracker = () => {
    const { language } = useLanguage();
    const { cases: realCases, loading } = useCases();
    const t = translations[language];

    const mockCases = [
        {
            id: "#2458",
            title: language === 'en' ? "Property Dispute" : (language === 'hi' ? "संपत्ति विवाद" : "সম্পত্তি বিরোধ"),
            status: language === 'en' ? "In Progress" : (language === 'hi' ? "प्रगति पर है" : "চলমান"),
            statusColor: "bg-[#FFF4E5] text-[#F57C00]"
        },
        {
            id: "#2491",
            title: language === 'en' ? "FIR Filing" : (language === 'hi' ? "एफआईआर फाइलिंग" : "এফআইআর দায়ের"),
            status: language === 'en' ? "Under Review" : (language === 'hi' ? "समीक्षाधीन" : "পর্যালোচনাধীন"),
            statusColor: "bg-[#E3F2FD] text-[#1E88E5]"
        },
        {
            id: "#2500",
            title: language === 'en' ? "Divorce Petition" : (language === 'hi' ? "तलाक याचिका" : "বিবাহবিচ্ছেদ আবেদন"),
            status: language === 'en' ? "Hearing on 25 Apr" : (language === 'hi' ? "25 अप्रैल को सुनवाई" : "২৫ এপ্রিল শুনানি"),
            statusColor: "bg-[#E6F9F2] text-[#059669]"
        },
    ];

    const displayCases = realCases.length > 0 ? realCases.slice(0, 3) : mockCases;

    return (
        <div className="w-96">
            <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-6 mb-4">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">{t.caseTracker}</h3>
                    <button className="text-[#00634B] text-sm font-semibold flex items-center gap-1 hover:underline">
                        {language === 'en' ? "See All" : (language === 'hi' ? "सभी देखें" : "সব দেখুন")} <ArrowRight size={16} />
                    </button>
                </div>

                <div className="space-y-6 relative">
                    <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-100"></div>
                    {displayCases.map((c, index) => (
                        <div key={index} className="flex items-center gap-4 relative">
                            <div className={`w-3.5 h-3.5 rounded-full border-2 border-white ring-2 ${index === 0 ? 'ring-[#00634B]' : 'ring-gray-200'} bg-white z-10`}></div>
                            <div className="flex-1 flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-800">
                                        Case <span className="text-gray-400 font-normal">{c.id.slice(0, 5)}</span> — {c.title}
                                    </h4>
                                </div>
                                <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${c.statusColor}`}>
                                    {c.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100">
                    <h4 className="text-sm font-bold text-gray-900 mb-4">Upcoming Hearing</h4>
                    <div className="bg-[#FFF8F1] rounded-2xl p-4 flex items-center gap-4 border border-[#FFD8B1]/50">
                        <div className="bg-white p-2 rounded-xl shadow-sm text-[#F57C00]">
                            <Calendar size={24} />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">25 Apr 2024, 10:30 AM</p>
                            <p className="text-xs text-gray-500">City Civil Court, Room 203</p>
                        </div>
                        <button className="bg-white px-4 py-2 rounded-xl text-xs font-bold text-gray-800 shadow-sm border border-gray-100 hover:bg-gray-50">
                            View Details
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-[#E6F0ED] rounded-[32px] p-6 relative overflow-hidden group cursor-pointer border border-[#00634B]/10">
                <div className="relative z-10">
                    <h3 className="text-[#00634B] font-bold text-xl mb-1">{t.urgentHelp}</h3>
                    <p className="text-[#00634B]/70 text-sm mb-4">
                        {language === 'en' ? "Chat with our Legal Expert" : (language === 'hi' ? "हमारे कानूनी विशेषज्ञ के साथ चैट करें" : "আমাদের আইনি বিশেষজ্ঞের সাথে চ্যাট করুন")}
                    </p>
                    <button className="bg-[#004D3C] text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#00382C] transition-all">
                        {t.chatNow} <ArrowRight size={18} />
                    </button>
                </div>
                <div className="absolute right-0 bottom-0 w-24 h-24 opacity-80 group-hover:scale-110 transition-transform">
                    <Image src="/user-profile.png" alt="Expert" fill className="object-cover rounded-tl-[32px]" />
                </div>
            </div>
        </div>
    );
};
