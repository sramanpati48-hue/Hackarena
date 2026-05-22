import React from 'react';
import Image from 'next/image';
import {
    Home,
    Search,
    FileText,
    Briefcase,
    FolderOpen,
    Users,
    Scale,
    Info,
    Phone,
    ChevronDown,
    Globe,
    LogOut,
    ShieldAlert,
    ListChecks,
    Activity,
    Database,
    HeartHandshake,
    MessageSquare
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const victimNavItems = [
    { icon: Home, label: 'Home', href: '/' },
    { icon: Search, label: 'Find Legal Help', href: '/find-help' },
    { icon: FileText, label: 'File a Case', href: '/file-case', hasSub: true },
    { icon: MessageSquare, label: 'Cases (Chat)', href: '/cases' },
    { icon: Briefcase, label: 'Formalized Cases', href: '/my-cases' },
    { icon: FolderOpen, label: 'Documents', href: '/documents' },
    { icon: Users, label: 'Lawyers', href: '/lawyers' },
    { icon: Scale, label: 'Legal Rights', href: '/legal-rights' },
    // { icon: BookOpen, label: 'Resources', href: '/resources', hasSub: true },
    { icon: Info, label: 'About Us', href: '/about' },
];

const moderatorNavItems = [
    { icon: Activity, label: 'Overview', href: '/moderator' },
    { icon: ListChecks, label: 'Review Queue', href: '/moderator/queue' },
    { icon: Globe, label: 'MLAT Cases', href: '/moderator/mlat' },
    { icon: Database, label: 'Audit Logs', href: '/moderator/logs' },
];

const guideNavItems = [
    { icon: HeartHandshake, label: 'Sahayak Help Queue', href: '/sahayak' },
];

export const Sidebar = () => {
    const { user, logout, role, loading } = useAuth();
    const pathname = usePathname();

    const normalizedRole = (role || '').trim().toLowerCase();
    const isModeratorRoute = pathname.startsWith('/moderator');
    const isSahayakRoute = pathname.startsWith('/sahayak');

    const isModerator = normalizedRole === 'moderator' || (!normalizedRole && isModeratorRoute);
    const isGuide = normalizedRole === 'guide' || normalizedRole === 'sahayak' || normalizedRole === 'nyay_guide' || (!normalizedRole && isSahayakRoute);
    const isLawyer = normalizedRole === 'lawyer';
    const isVictim = normalizedRole === 'victim' || (!normalizedRole && !isModeratorRoute && !isSahayakRoute && !pathname.startsWith('/lawyer'));

    return (
        <aside className="w-64 bg-white border-r border-[#E5E7EB] h-screen fixed left-0 top-0 flex flex-col overflow-y-auto custom-scrollbar">
            <Link href="/" className="p-6 flex items-center gap-4 group/logo cursor-pointer">
                <div className="w-12 h-12 relative flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-xl shadow-emerald-900/5 flex items-center justify-center transition-all duration-300 group-hover/logo:scale-110 group-hover/logo:rotate-3 group-hover/logo:border-emerald-100">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent rounded-2xl opacity-0 group-hover/logo:opacity-100 transition-opacity" />
                    <div className="w-8 h-8 relative z-10">
                        <Image src="/2.png" alt="Nyaysahayak Logo" fill className="object-contain" />
                    </div>
                </div>
                <div className="flex flex-col">
                    <h1 className="text-[#00634B] font-black text-xl leading-tight tracking-tight group-hover/logo:text-[#014D3C] transition-colors">
                        Nyay<span className="text-gray-900">Sahayak</span>
                    </h1>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.15em]">
                            Legal Help for All
                        </p>
                    </div>
                </div>
            </Link>

            <nav className="flex-1 px-4 py-2">
                {isModerator ? moderatorNavItems.map((item, index) => {
                    const isActive = pathname === item.href;
                    return (
                        <div key={index} className="mb-1">
                            <Link href={item.href}>
                                <button
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                                        ? 'bg-[#00634B] text-white shadow-lg shadow-[#00634B]/20'
                                        : 'text-[#4B5563] hover:bg-gray-50 hover:pl-4 focus:ring-2 focus:ring-[#00634B]/20'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        {React.createElement(item.icon, { size: 20, className: isActive ? 'text-white' : 'text-[#6B7280] group-hover:text-[#00634B]' })}
                                        <span className={`font-medium text-sm transition-transform ${isActive ? 'scale-105' : 'group-hover:translate-x-1'}`}>{item.label}</span>
                                    </div>
                                    {('hasSub' in item && (item as any).hasSub) && <ChevronDown size={14} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-[#00634B]'} />}
                                </button>
                            </Link>
                        </div>
                    );
                }) : isGuide ? guideNavItems.map((item, index) => {
                    const isActive = pathname === item.href;
                    return (
                        <div key={index} className="mb-1">
                            <Link href={item.href}>
                                <button
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                                        ? 'bg-[#00634B] text-white shadow-lg shadow-[#00634B]/20'
                                        : 'text-[#4B5563] hover:bg-gray-50 hover:pl-4 focus:ring-2 focus:ring-[#00634B]/20'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        {React.createElement(item.icon, { size: 20, className: isActive ? 'text-white' : 'text-[#6B7280] group-hover:text-[#00634B]' })}
                                        <span className={`font-medium text-sm transition-transform ${isActive ? 'scale-105' : 'group-hover:translate-x-1'}`}>{item.label}</span>
                                    </div>
                                    {('hasSub' in item && (item as any).hasSub) && <ChevronDown size={14} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-[#00634B]'} />}
                                </button>
                            </Link>
                        </div>
                    );
                }) : isVictim ? victimNavItems.map((item, index) => {
                    const isActive = pathname === item.href;
                    return (
                        <div key={index} className="mb-1">
                            <Link href={item.href}>
                                <button
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                                        ? 'bg-[#00634B] text-white shadow-lg shadow-[#00634B]/20'
                                        : 'text-[#4B5563] hover:bg-gray-50 hover:pl-4 focus:ring-2 focus:ring-[#00634B]/20'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        {React.createElement(item.icon, { size: 20, className: isActive ? 'text-white' : 'text-[#6B7280] group-hover:text-[#00634B]' })}
                                        <span className={`font-medium text-sm transition-transform ${isActive ? 'scale-105' : 'group-hover:translate-x-1'}`}>{item.label}</span>
                                    </div>
                                    {('hasSub' in item && (item as any).hasSub) && <ChevronDown size={14} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-[#00634B]'} />}
                                </button>
                            </Link>
                        </div>
                    );
                }) : null}

                {isLawyer && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                        <Link href="/lawyer">
                            <button
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${pathname === '/lawyer'
                                    ? 'bg-[#00634B] text-white shadow-lg shadow-[#00634B]/20'
                                    : 'text-[#4B5563] hover:bg-emerald-50 hover:pl-4'
                                    }`}
                            >
                                <Activity size={20} className={pathname === '/lawyer' ? 'text-white' : 'text-[#6B7280] group-hover:text-[#00634B]'} />
                                <span className="font-bold text-sm">Dashboard Overview</span>
                            </button>
                        </Link>
                        <Link href="/lawyer/cases">
                            <button
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${pathname === '/lawyer/cases'
                                    ? 'bg-[#00634B] text-white shadow-lg shadow-[#00634B]/20'
                                    : 'text-[#4B5563] hover:bg-emerald-50 hover:pl-4'
                                    }`}
                            >
                                <Briefcase size={20} className={pathname === '/lawyer/cases' ? 'text-white' : 'text-[#6B7280] group-hover:text-[#00634B]'} />
                                <span className="font-bold text-sm">Client Cases</span>
                            </button>
                        </Link>
                        <Link href="/lawyer/profile">
                            <button
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${pathname === '/lawyer/profile'
                                    ? 'bg-[#00634B] text-white shadow-lg shadow-[#00634B]/20'
                                    : 'text-[#4B5563] hover:bg-emerald-50 hover:pl-4'
                                    }`}
                            >
                                <Users size={20} className={pathname === '/lawyer/profile' ? 'text-white' : 'text-[#6B7280] group-hover:text-[#00634B]'} />
                                <span className="font-bold text-sm">Professional Profile</span>
                            </button>
                        </Link>
                    </div>
                )}

                {user && !loading && (
                    <div className="mt-8 pt-4 border-t border-gray-100">
                        <button
                            onClick={logout}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-500 hover:bg-red-50 hover:pl-4 transition-all duration-200 group"
                        >
                            <LogOut size={20} className="text-red-400 group-hover:text-red-500" />
                            <span className="font-bold text-sm">Logout</span>
                        </button>
                    </div>
                )}
            </nav>

            <div className="p-4">
                <div className="bg-[#FFF8F1] border-2 border-dashed border-[#FFD8B1] rounded-2xl p-4 relative overflow-hidden">
                    <h3 className="text-gray-900 font-semibold text-sm mb-1">Need Urgent Help?</h3>
                    <div className="flex items-center gap-2 text-[#00634B] mt-2">
                        <div className="bg-[#E6F0ED] p-1.5 rounded-full">
                            <Phone size={16} fill="currentColor" />
                        </div>
                        <span className="font-bold text-lg">1800-123-4567</span>
                    </div>
                    <p className="text-gray-500 text-[10px] mt-1 ml-9">24/7 Helpline</p>

                    <button className="w-full mt-4 bg-[#00634B] text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#00634B]/20">
                        <Phone size={18} fill="white" />
                        Call Now
                    </button>
                </div>

                <div className="mt-4 flex items-center justify-between px-2">
                    <button className="flex items-center gap-2 text-gray-600 text-sm bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                        <Globe size={16} />
                        <span>English</span>
                        <ChevronDown size={14} />
                    </button>
                </div>

                <p className="text-center text-gray-400 text-[10px] mt-4">
                    © 2026 NyaySahayak
                </p>
            </div>
        </aside>
    );
};
