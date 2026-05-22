"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import {
    Save, User, Briefcase, IndianRupee, MapPin,
    FileText, Sparkles, CheckCircle2, AlertCircle,
    Camera, Loader2, Star, Verified, Calendar, ArrowRight, Clock, Pencil, X, Phone, Mail
} from 'lucide-react';
import Image from 'next/image';


export default function LawyerProfilePage() {
    const { user, role } = useAuth();
    const { language } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    // Profile state
    const [profile, setProfile] = useState({
        name: user?.displayName || "",
        email: user?.email || "",
        specialization: "Cyber & Financial Fraud",
        lawyerType: "Private Practice (PVT)",
        experience: 5,
        hourlyRate: 2000,
        bio: "",
        location: "Mumbai, India",
        avatar: user?.photoURL || "https://images.unsplash.com/photo-1556157382-97dee2dcb9d9?q=80&w=2670&auto=format&fit=crop",
        barRegistrationNumber: "",
        contactNumber: ""
    });

    const t = {
        en: {
            title: "Professional Profile",
            subtitle: "Your public directory listing for clients to discover you.",
            personalInfo: "Personal Information",
            professionalInfo: "Professional Details",
            pricing: "Service Pricing",
            previewTitle: "Directory Preview",
            editBtn: "Edit Profile",
            saveBtn: "Save Profile",
            cancelBtn: "Cancel",
            saving: "Syncing with Directory...",
            nameLabel: "Full Name",
            emailLabel: "Email Address",
            contactLabel: "Contact Number",
            specLabel: "Major Practice Category",
            typeLabel: "Engagement Model (Lawyer Type)",
            expLabel: "Years of Experience",
            rateLabel: "Hourly Rate (₹)",
            bioLabel: "Professional Bio",
            locLabel: "Location",
            barLabel: "Bar Registration Number",
            successMsg: "Profile updated successfully! You are now live in the directory.",
            errorMsg: "Failed to update profile. Please try again.",
            verified: "Verification Pending"
        },
        hi: {
            title: "पेशेवर प्रोफाइल",
            subtitle: "क्लाइंट की खोज के लिए आपकी सार्वजनिक निर्देशिका प्रविष्टि।",
            personalInfo: "व्यक्तिगत जानकारी",
            professionalInfo: "पेशेवर विवरण",
            pricing: "सेवा मूल्य निर्धारण",
            previewTitle: "निर्देशिका पूर्वावलोकन",
            editBtn: "प्रोफ़ाइल संपादित करें",
            saveBtn: "प्रोफ़ाइल सहेजें",
            cancelBtn: "रद्द करें",
            saving: "निर्देशिका के साथ सिंक हो रहा है...",
            nameLabel: "पूरा नाम",
            emailLabel: "ईमेल पता",
            contactLabel: "संपर्क संख्या",
            specLabel: "विशेषज्ञता",
            typeLabel: "जुड़ाव मॉडल (वकील का प्रकार)",
            expLabel: "अनुभव के वर्ष",
            rateLabel: "प्रति घंटा दर (₹)",
            bioLabel: "पेशेवर विवरण",
            locLabel: "स्थान",
            barLabel: "बार पंजीकरण संख्या",
            successMsg: "प्रोफ़ाइल सफलतापूर्वक अपडेट की गई!",
            errorMsg: "प्रोफ़ाइल अपडेट करने में विफल। फिर से प्रयास करें।",
            verified: "सत्यापन लंबित"
        },
        bn: {
            title: "পেশাদার প্রোফাইল",
            subtitle: "ক্লায়েন্টদের আপনাকে খুঁজে পেতে সাহায্য করে।",
            personalInfo: "ব্যক্তিগত তথ্য",
            professionalInfo: "পেশাদার বিবরণ",
            pricing: "পরিষেবা মূল্য নির্ধারণ",
            previewTitle: "ডিরেক্টরি প্রিভিউ",
            editBtn: "প্রোফাইল সম্পাদনা করুন",
            saveBtn: "প্রোফাইল সংরক্ষণ করুন",
            cancelBtn: "বাতিল করুন",
            saving: "ডিরেক্টরির সাথে সিঙ্ক হচ্ছে...",
            nameLabel: "পুরো নাম",
            emailLabel: "ইমেইল ঠিকানা",
            contactLabel: "যোগাযোগের নম্বর",
            specLabel: "বিশেষজ্ঞতা",
            typeLabel: "এনগেজমেন্ট মডেল (আইনজীবীর প্রকার)",
            expLabel: "অভিজ্ঞতার বছর",
            rateLabel: "প্রতি ঘণ্টার হার (₹)",
            bioLabel: "পেশাদার তথ্য",
            locLabel: "অবস্থান",
            barLabel: "বার রেজিস্ট্রেশন নম্বর",
            successMsg: "প্রোফাইল সফলভাবে আপডেট করা হয়েছে!",
            errorMsg: "প্রোফাইল আপডেট করতে ব্যর্থ হয়েছে।",
            verified: "যাচাইকরণ মুলতুবি"
        }
    }[language];

    useEffect(() => {
        async function fetchProfile() {
            if (!user) return;
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/lawyer/profile/${user.uid}`
                );
                if (res.ok) {
                    const data = await res.json();
                    setProfile(prev => ({
                        ...prev,
                        name: data.name || user.displayName || "",
                        email: data.email || user.email || "",
                        specialization: data.specialization || prev.specialization,
                        lawyerType: data.lawyer_type || prev.lawyerType,
                        experience: data.experience ?? prev.experience,
                        hourlyRate: data.hourly_rate ?? prev.hourlyRate,
                        bio: data.bio || "",
                        location: data.location || prev.location,
                        avatar: data.avatar || user.photoURL || prev.avatar,
                        barRegistrationNumber: data.bar_registration_number || "",
                        contactNumber: data.contact_number || "",
                    }));
                }
            } catch (err) {
                console.error("Error fetching profile:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchProfile();
    }, [user]);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAvatarFile(file);
        const blobUrl = URL.createObjectURL(file);
        setAvatarPreview(blobUrl);
        setProfile(prev => ({ ...prev, avatar: blobUrl }));
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSaving(true);
        setStatus('idle');
        try {
            let avatarUrl = profile.avatar;

            // Upload avatar first if a new file was selected
            if (avatarFile) {
                const fd = new FormData();
                fd.append('avatar', avatarFile);
                fd.append('uid', user?.uid || '');
                const uploadRes = await fetch('/api/lawyer/profile', { method: 'PUT', body: fd });
                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    avatarUrl = uploadData.avatarUrl || avatarUrl;
                }
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/lawyers/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid: user?.uid,
                    ...profile,
                    avatar: avatarUrl
                })
            });
            if (res.ok) {
                setStatus('success');
                setIsEditing(false);
                setAvatarFile(null);
                // Update profile with final URL
                setProfile(prev => ({ ...prev, avatar: avatarUrl }));
            } else {
                setStatus('error');
            }
        } catch (err) {
            console.error("Save error:", err);
            setStatus('error');
        } finally {
            setSaving(false);
        }
    };

    // ────── Shared field classes ──────
    const fieldCls = "w-full h-14 px-6 bg-gray-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all font-bold text-gray-900";
    const viewFieldCls = "w-full h-14 px-6 bg-transparent rounded-2xl font-bold text-gray-900 flex items-center truncate";

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-12 h-12 text-[#00634B] animate-spin" />
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">{t.title}</h1>
                    <p className="text-gray-500 text-lg font-medium">{t.subtitle}</p>
                </div>
                <div className="flex items-center gap-3">
                    {isEditing && (
                        <button
                            onClick={() => { setIsEditing(false); setStatus('idle'); }}
                            className="border border-gray-200 text-gray-500 px-6 py-4 rounded-[28px] font-black flex items-center gap-2 hover:bg-gray-50 transition-all"
                        >
                            <X size={20} />
                            {t.cancelBtn}
                        </button>
                    )}
                    <button
                        onClick={isEditing ? () => handleSubmit() : () => { setIsEditing(true); setStatus('idle'); }}
                        disabled={saving}
                        className={`px-10 py-4 rounded-[28px] font-black flex items-center gap-3 transition-all shadow-xl active:scale-95 disabled:opacity-70 ${
                            isEditing
                                ? 'bg-[#00634B] text-white hover:bg-[#004D3C] shadow-emerald-900/10'
                                : 'bg-gray-900 text-white hover:bg-gray-700 shadow-gray-900/10'
                        }`}
                    >
                        {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : isEditing ? <Save size={24} /> : <Pencil size={22} />}
                        {saving ? t.saving : isEditing ? t.saveBtn : t.editBtn}
                    </button>
                </div>
            </div>

            {/* Status Messages */}
            {status === 'success' && (
                <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[32px] flex items-center gap-4 animate-in zoom-in-95 duration-300">
                    <div className="bg-emerald-500 p-2 rounded-full text-white"><CheckCircle2 size={24} /></div>
                    <p className="text-emerald-800 font-black">{t.successMsg}</p>
                </div>
            )}
            {status === 'error' && (
                <div className="bg-red-50 border border-red-100 p-6 rounded-[32px] flex items-center gap-4">
                    <div className="bg-red-500 p-2 rounded-full text-white"><AlertCircle size={24} /></div>
                    <p className="text-red-800 font-black">{t.errorMsg}</p>
                </div>
            )}

            {/* Edit mode banner */}
            {isEditing && (
                <div className="bg-amber-50 border border-amber-200 px-6 py-3 rounded-2xl flex items-center gap-3 text-amber-700 text-sm font-bold animate-in slide-in-from-top-2 duration-300">
                    <Pencil size={16} />
                    You are in edit mode. Make your changes and click "Save Profile" to update.
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Left: Form / View Column */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Section: Personal */}
                    <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5"><User size={120} /></div>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-[#00634B]">
                                <User size={24} />
                            </div>
                            <h3 className="text-2xl font-black text-gray-900">{t.personalInfo}</h3>
                        </div>

                        {/* Avatar + name row */}
                        <div className="flex items-center gap-8">
                            {/* Hidden file input */}
                            <input
                                ref={avatarInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAvatarChange}
                            />
                            <div className={`relative ring-4 ring-emerald-50 rounded-[40px] overflow-hidden ${isEditing ? 'group cursor-pointer' : ''}`}
                                onClick={() => isEditing && avatarInputRef.current?.click()}>
                                <Image
                                    src={avatarPreview || profile.avatar}
                                    alt="Profile"
                                    width={120}
                                    height={120}
                                    className="object-cover"
                                    unoptimized={!!avatarPreview}
                                />
                                {isEditing && (
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1">
                                        <Camera size={26} />
                                        <span className="text-[10px] font-black uppercase tracking-wider">Change</span>
                                    </div>
                                )}
                                {avatarPreview && (
                                    <div className="absolute bottom-1.5 right-1.5 bg-emerald-500 rounded-full p-1">
                                        <Camera size={10} className="text-white" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 space-y-1">
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={profile.name}
                                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                        className={fieldCls + " text-2xl"}
                                        placeholder="Full Name"
                                    />
                                ) : (
                                    <p className="text-2xl font-black text-gray-900">Adv. {profile.name || "—"}</p>
                                )}
                                <div className="flex items-center gap-2 text-[#00634B] font-black text-xs uppercase tracking-widest pt-1">
                                    <Verified size={14} className="text-emerald-500" /> {t.verified}
                                </div>
                            </div>
                        </div>

                        {/* Grid of contact fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Location */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">{t.locLabel}</label>
                                {isEditing ? (
                                    <div className="relative">
                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                        <input type="text" value={profile.location}
                                            onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                                            className={fieldCls + " pl-12"} />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 h-12 px-4 bg-gray-50 rounded-2xl text-gray-700 font-semibold text-sm">
                                        <MapPin size={16} className="text-gray-400 shrink-0" />
                                        {profile.location || "—"}
                                    </div>
                                )}
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">{t.emailLabel}</label>
                                {isEditing ? (
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                        <input type="email" value={profile.email}
                                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                            className={fieldCls + " pl-12"} />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 h-12 px-4 bg-gray-50 rounded-2xl text-gray-700 font-semibold text-sm truncate">
                                        <Mail size={16} className="text-gray-400 shrink-0" />
                                        {profile.email || "—"}
                                    </div>
                                )}
                            </div>

                            {/* Contact */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">{t.contactLabel}</label>
                                {isEditing ? (
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                        <input type="tel" value={profile.contactNumber}
                                            onChange={(e) => setProfile({ ...profile, contactNumber: e.target.value })}
                                            className={fieldCls + " pl-12"}
                                            placeholder="+91 " />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 h-12 px-4 bg-gray-50 rounded-2xl text-gray-700 font-semibold text-sm">
                                        <Phone size={16} className="text-gray-400 shrink-0" />
                                        {profile.contactNumber || "—"}
                                    </div>
                                )}
                            </div>

                            {/* Bar Reg */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">{t.barLabel}</label>
                                {isEditing ? (
                                    <div className="relative">
                                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                        <input type="text" value={profile.barRegistrationNumber}
                                            onChange={(e) => setProfile({ ...profile, barRegistrationNumber: e.target.value })}
                                            className={fieldCls + " pl-12"}
                                            placeholder="MAH/1234/2024" />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 h-12 px-4 bg-gray-50 rounded-2xl text-gray-700 font-semibold text-sm">
                                        <FileText size={16} className="text-gray-400 shrink-0" />
                                        {profile.barRegistrationNumber || "—"}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section: Professional */}
                    <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-[#00634B]">
                                <Briefcase size={24} />
                            </div>
                            <h3 className="text-2xl font-black text-gray-900">{t.professionalInfo}</h3>
                        </div>

                        <div className="space-y-8">
                            {/* Specialization */}
                            <div className="space-y-3">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">{t.specLabel}</label>
                                {isEditing ? (
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        {["Cyber & Financial Fraud", "Criminal Law", "Family & Matrimonial",
                                            "Property & Land", "Civil & Consumer Disputes", "Business & Employment",
                                            "Claims & Compensation"].map(s => (
                                            <button key={s} type="button"
                                                onClick={() => setProfile({ ...profile, specialization: s })}
                                                className={`px-3 py-2.5 rounded-2xl text-[10px] font-black transition-all ${profile.specialization === s ? 'bg-[#00634B] text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-emerald-50'}`}>
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-[#00634B] rounded-2xl font-bold text-sm">
                                        {profile.specialization || "—"}
                                    </div>
                                )}
                            </div>

                            {/* Lawyer Type */}
                            <div className="space-y-3">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">{t.typeLabel}</label>
                                {isEditing ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {["Private Practice (PVT)", "Senior Counsel / Specialist",
                                            "Legal Aid / Pro Bono", "Panel / Retainer Lawyer",
                                            "Nyay Guide (Non-lawyer Support)"].map(type => (
                                            <button key={type} type="button"
                                                onClick={() => setProfile({ ...profile, lawyerType: type })}
                                                className={`px-3 py-2.5 rounded-2xl text-[10px] font-black transition-all ${profile.lawyerType === type ? 'bg-[#00634B] text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-emerald-50'}`}>
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-2xl font-bold text-sm">
                                        {profile.lawyerType || "—"}
                                    </div>
                                )}
                            </div>

                            {/* Experience */}
                            <div className="space-y-3">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">{t.expLabel}</label>
                                {isEditing ? (
                                    <>
                                        <input type="range" min="0" max="40" step="1"
                                            value={profile.experience}
                                            onChange={(e) => setProfile({ ...profile, experience: parseInt(e.target.value) })}
                                            className="w-full accent-[#00634B]" />
                                        <div className="flex justify-between text-lg font-black text-[#00634B]">
                                            <span>0</span>
                                            <span className="bg-emerald-50 px-4 py-1 rounded-xl">{profile.experience}+ Years</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-5 py-3 w-fit">
                                        <Briefcase size={18} className="text-gray-400" />
                                        <span className="text-xl font-black text-gray-900">{profile.experience}+ Years</span>
                                    </div>
                                )}
                            </div>

                            {/* Bio */}
                            <div className="space-y-3">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">{t.bioLabel}</label>
                                {isEditing ? (
                                    <textarea value={profile.bio}
                                        onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                                        rows={4}
                                        className="w-full p-6 bg-gray-50 border-none rounded-[32px] outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all font-bold text-gray-900 resize-none leading-relaxed"
                                        placeholder="Describe your legal expertise..." />
                                ) : (
                                    <p className="text-gray-600 font-medium leading-relaxed bg-gray-50 rounded-[32px] px-6 py-5">
                                        {profile.bio || <span className="text-gray-400 italic">No bio yet. Click Edit Profile to add one.</span>}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section: Pricing */}
                    <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-[#00634B]">
                                <IndianRupee size={24} />
                            </div>
                            <h3 className="text-2xl font-black text-gray-900">{t.pricing}</h3>
                        </div>
                        <div className="flex items-center gap-8">
                            {isEditing ? (
                                <div className="relative flex-1">
                                    <IndianRupee className="absolute left-6 top-1/2 -translate-y-1/2 text-[#00634B]" size={28} />
                                    <input type="number" value={profile.hourlyRate}
                                        onChange={(e) => setProfile({ ...profile, hourlyRate: parseInt(e.target.value) })}
                                        className="w-full h-20 pl-16 pr-8 bg-gray-50 border-none rounded-[32px] outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all text-3xl font-black text-gray-900" />
                                </div>
                            ) : (
                                <div className="flex items-center gap-4 bg-gray-50 px-8 py-5 rounded-[32px]">
                                    <IndianRupee className="text-[#00634B]" size={32} />
                                    <span className="text-4xl font-black text-gray-900">{profile.hourlyRate?.toLocaleString()}</span>
                                    <span className="text-gray-400 font-bold text-lg">/ hr</span>
                                </div>
                            )}
                            <div className="space-y-1 flex-1">
                                <p className="text-sm font-black text-gray-900">Professional Hourly Rate</p>
                                <p className="text-xs text-gray-400 font-medium leading-relaxed">
                                    Clear pricing builds trust. We recommend ₹1000 – ₹5000 based on your experience.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Preview Column */}
                <div className="lg:col-span-1">
                    <div className="sticky top-8 space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles size={18} className="text-emerald-500" />
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">{t.previewTitle}</h3>
                        </div>

                        <div className="bg-white p-8 rounded-[48px] border border-gray-100 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-6 right-6 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-[#00634B] rounded-full text-[10px] font-black uppercase tracking-tighter">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                Available Today
                            </div>

                            <div className="flex gap-6 mb-8 mt-2">
                                <div className="w-24 h-24 rounded-[32px] overflow-hidden relative shadow-lg ring-4 ring-emerald-50">
                                    <Image src={profile.avatar} alt={profile.name} fill className="object-cover" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-black text-gray-900">Adv. {profile.name || "Your Name"}</h3>
                                    <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 w-fit px-3 py-1 rounded-xl mt-1">
                                        <Star size={14} fill="currentColor" /> 4.5 • {profile.specialization}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <p className="text-gray-500 text-sm leading-relaxed line-clamp-3 font-medium">
                                    {profile.bio || "Write a bio to see it here..."}
                                </p>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 p-4 rounded-3xl flex items-center gap-3">
                                        <div className="bg-white p-2 rounded-xl text-gray-400"><Briefcase size={16} /></div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Experience</p>
                                            <p className="text-sm font-extrabold text-gray-900">{profile.experience}+ Yrs</p>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-3xl flex items-center gap-3">
                                        <div className="bg-white p-2 rounded-xl text-[#00634B]"><IndianRupee size={16} /></div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Budget</p>
                                            <p className="text-sm font-extrabold text-gray-900">₹{profile.hourlyRate}/hr</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 pt-1">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                                        <MapPin size={13} /> {profile.location}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                                        <Clock size={13} /> 9 AM - 6 PM
                                    </div>
                                </div>
                            </div>

                            <button className="w-full bg-[#00634B] text-white py-5 rounded-[28px] font-black flex items-center justify-center gap-3 opacity-50 cursor-not-allowed">
                                <Calendar size={20} /> Consult Now <ArrowRight size={20} />
                            </button>
                        </div>

                        <div className="bg-emerald-900 rounded-[40px] p-8 text-white space-y-4 shadow-xl shadow-emerald-900/10">
                            <h4 className="text-xl font-black">Pro Tip 💡</h4>
                            <p className="text-emerald-100/70 text-sm leading-relaxed font-bold">
                                Lawyers with a detailed bio and clear specialization get 3x more consultation requests. Be specific about your expertise!
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
