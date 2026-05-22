"use client";

import React, { useState } from 'react';
import { useLanguage } from "@/context/LanguageContext";
import { useLawyers } from "@/context/LawyerContext";
import {
  Search, Filter, Star, MapPin, Briefcase,
  ArrowRight, Clock, IndianRupee, Verified,
  Calendar, Sparkles
} from "lucide-react";
import Image from "next/image";

export default function FindHelpPage() {
  const { language } = useLanguage();
  const { lawyers, loading, filters, setFilters } = useLawyers();
  const [searchTerm, setSearchTerm] = useState("");

  const specializations = [
    "Cyber & Financial Fraud", "Criminal Law", "Family & Matrimonial",
    "Property & Land", "Civil & Consumer Disputes", "Business & Employment",
    "Claims & Compensation"
  ];

  const lawyerTypes = [
    "Private Practice (PVT)", "Senior Counsel / Specialist",
    "Legal Aid / Pro Bono", "Panel / Retainer Lawyer",
    "Nyay Guide (Non-lawyer Support)"
  ];

  const t = {
    en: {
      title: "Find Legal Help",
      subtitle: "Browse our network of verified legal experts.",
      searchPlaceholder: "Search by keyword or expertise...",
      filterTitle: "Filters",
      expLabel: "Min Experience (Years)",
      budgetLabel: "Max Hourly Rate (₹)",
      specLabel: "Major Practice Category",
      typeLabel: "Engagement Model",
      noResults: "No lawyers found matching your criteria.",
      experience: "years experience",
      verify: "Verified Expert",
      bookNow: "Consult Now"
    },
    hi: {
      title: "कानूनी सहायता खोजें",
      subtitle: "सत्यापित कानूनी विशेषज्ञों के हमारे नेटवर्क को ब्राउज़ करें।",
      searchPlaceholder: "कीवर्ड या विशेषज्ञता द्वारा खोजें...",
      filterTitle: "फिल्टर",
      expLabel: "न्यूनतम अनुभव (वर्ष)",
      budgetLabel: "अधिकतम प्रति घंटा दर (₹)",
      specLabel: "प्रमुख अभ्यास श्रेणी",
      typeLabel: "जुड़ाव मॉडल",
      noResults: "आपके मानदंड से मेल खाने वाला कोई वकील नहीं मिला।",
      experience: "वर्षों का अनुभव",
      verify: "सत्यापित विशेषज्ञ",
      bookNow: "परामर्श लें"
    },
    bn: {
      title: "আইনি সাহায্য খুঁজুন",
      subtitle: "আমাদের যাচাইকৃত আইনি বিশেষজ্ঞদের নেটওয়ার্ক ব্রাউজ করুন।",
      searchPlaceholder: "কীওয়ার্ড বা দক্ষতা দ্বারা অনুসন্ধান করুন...",
      filterTitle: "ফিল্টার",
      expLabel: "ন্যূনতম অভিজ্ঞতা (বছর)",
      budgetLabel: "সর্বোচ্চ প্রতি ঘণ্টার হার (₹)",
      specLabel: "প্রধান অনুশীলন বিভাগ",
      typeLabel: "এনগেজমেন্ট মডেল",
      noResults: "আপনার মানদণ্ডের সাথে মিল পাওয়া কোনো আইনজীবী নেই।",
      experience: "বছরের অভিজ্ঞতা",
      verify: "যাচাইকৃত বিশেষজ্ঞ",
      bookNow: "পরামর্শ নিন"
    }
  }[language];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ ...filters, keyword: searchTerm });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-gray-900 mb-2">{t.title}</h1>
        <p className="text-gray-500 text-lg font-medium">{t.subtitle}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filter Sidebar */}
        <aside className="w-full lg:w-80 space-y-6 shrink-0">
          <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm lg:sticky lg:top-8 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-2 mb-6 font-bold text-gray-900 border-b border-gray-50 pb-4">
              <Filter size={20} className="text-[#00634B]" />
              {t.filterTitle}
            </div>

            <div className="space-y-8">
              {/* Specialization Filter */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Practice Category</label>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => setFilters({ ...filters, specialization: undefined })}
                    className={`text-left px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${!filters.specialization ? 'bg-emerald-50 text-[#00634B]' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    All Categories
                  </button>
                  {specializations.map(s => (
                    <button
                      key={s}
                      onClick={() => setFilters({ ...filters, specialization: s })}
                      className={`text-left px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${filters.specialization === s ? 'bg-emerald-50 text-[#00634B]' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Engagement Model Filter */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Lawyer Type</label>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => setFilters({ ...filters, lawyerType: undefined })}
                    className={`text-left px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${!filters.lawyerType ? 'bg-emerald-50 text-[#00634B]' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    Any Type
                  </button>
                  {lawyerTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => setFilters({ ...filters, lawyerType: type })}
                      className={`text-left px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${filters.lawyerType === type ? 'bg-emerald-50 text-[#00634B]' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget Filter */}
              <div className="space-y-4 pt-4 border-t border-gray-50">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rate (₹/hr)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[1000, 3000, 5000].map(p => (
                    <button
                      key={p}
                      onClick={() => setFilters({ ...filters, maxBudget: p })}
                      className={`py-2 rounded-xl text-[10px] font-black border transition-all ${filters.maxBudget === p ? 'bg-[#00634B] text-white border-[#00634B]' : 'bg-white border-gray-100 text-gray-500 hover:border-emerald-200'}`}
                    >
                      ₹{p}+
                    </button>
                  ))}
                  <button
                    onClick={() => setFilters({ ...filters, maxBudget: undefined })}
                    className="py-2 rounded-xl text-[10px] font-black border border-gray-100 text-gray-400 hover:text-[#00634B]"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 space-y-8">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative group">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#00634B] transition-colors">
              <Search size={24} />
            </div>
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              className="w-full bg-white border-none rounded-[32px] py-6 pl-16 pr-32 shadow-sm focus:shadow-xl focus:shadow-emerald-900/5 transition-all outline-none text-lg text-gray-900 font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button
              type="submit"
              className="absolute right-3 top-3 bottom-3 bg-[#00634B] text-white px-8 rounded-2xl font-black text-sm hover:bg-[#004D3C] transition-all"
            >
              Search
            </button>
          </form>

          {/* Results Grid */}
          {loading ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white p-6 rounded-[40px] border border-gray-100 animate-pulse h-80"></div>
              ))}
            </div>
          ) : lawyers.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {lawyers.map((lawyer) => (
                <div key={lawyer.id} className="bg-white p-6 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 group relative flex flex-col hover:-translate-y-1">
                  <div className="absolute top-4 right-4 bg-emerald-50 text-[#00634B] px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-1.5 z-10 border border-emerald-100 uppercase tracking-tighter">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    {lawyer.lawyerType || "Specialist"}
                  </div>

                  <div className="flex gap-6 mb-6">
                    <div className="relative w-28 h-28 rounded-3xl overflow-hidden shadow-lg group-hover:scale-105 transition-transform duration-500 ring-4 ring-emerald-50">
                      <Image
                        src={lawyer.avatar}
                        alt={lawyer.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-gray-900 underline decoration-transparent group-hover:decoration-emerald-200 transition-all leading-tight">Adv. {lawyer.name}</h3>
                        {lawyer.verified && <Verified className="text-blue-500" size={18} />}
                      </div>
                      <p className="text-[#00634B] font-black text-xs inline-flex items-center gap-2 bg-emerald-50 px-2 py-1 rounded-lg">
                        {lawyer.specialization}
                      </p>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1 text-gray-400 text-xs font-bold">
                          <Briefcase size={14} />
                          {lawyer.experience}+ Years
                        </div>
                        <div className="flex items-center gap-1 text-xs font-bold">
                          <Star size={14} className="text-amber-400 fill-amber-400" />
                          <span className="text-gray-900">{lawyer.rating}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-500 text-sm line-clamp-2 mb-6 flex-1 italic font-medium leading-relaxed">
                    "{lawyer.bio}"
                  </p>

                  <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 mb-6 px-1">
                    <div className="flex items-center gap-1.5"><MapPin size={12} /> {lawyer.location}</div>
                    <div className="flex items-center gap-1.5"><Clock size={12} /> 9 AM - 6 PM</div>
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-6 border-t border-gray-50">
                    <div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">Consultation</span>
                      <div className="text-2xl font-black text-gray-900">
                        ₹{lawyer.hourlyRate}<span className="text-xs font-normal text-gray-400">/hr</span>
                      </div>
                    </div>
                    <button className="bg-[#00634B] text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 group-hover:bg-[#004D3C] transition-all shadow-xl shadow-emerald-900/10 hover:scale-105 active:scale-95">
                      {t.bookNow} <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-20 rounded-[48px] border border-dashed border-gray-200 text-center space-y-6">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                <Search size={48} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-900 mb-2">{t.noResults}</h3>
                <p className="text-gray-400 font-medium italic">Try adjusting your filters or keyword for better results.</p>
              </div>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilters({});
                }}
                className="bg-[#00634B] text-white px-10 py-4 rounded-2xl font-black flex items-center gap-2 mx-auto hover:bg-[#004D3C] transition-all"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
