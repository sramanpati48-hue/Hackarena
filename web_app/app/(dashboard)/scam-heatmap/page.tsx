"use client";

import { Suspense } from "react";
import { ScamHeatmap } from "@/components/dashboard/ScamHeatmap";

export default function ScamHeatmapPage() {
  return (
    <div className="w-full">
      <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading intelligence map...</div>}>
        <ScamHeatmap />
      </Suspense>
    </div>
  );
}
