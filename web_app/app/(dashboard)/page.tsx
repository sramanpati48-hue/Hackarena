"use client";

import { useLanguage } from "@/context/LanguageContext";
import { HeroSearch } from "@/components/dashboard/Header";
import { QuickActions, HowItWorks } from "@/components/dashboard/Actions";
import { PopularServices, CaseTracker } from "@/components/dashboard/Services";
import { ScamHeatmap } from "@/components/dashboard/ScamHeatmap";

export default function Home() {
  const { language } = useLanguage();

  return (
    <>
      <HeroSearch />
      <QuickActions />
      <HowItWorks />
      <div className="flex gap-12 mt-12">
        <PopularServices />
        <CaseTracker />
      </div>
    </>
  );
}
