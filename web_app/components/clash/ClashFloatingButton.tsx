"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Swords, GraduationCap, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClashFloatingButton() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <div ref={menuRef} className="fixed bottom-8 left-8 z-30 flex flex-col items-start gap-2">
      {open && (
        <div
          className="mb-1 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 min-w-[180px] animate-in fade-in slide-in-from-bottom-2"
          role="menu"
          aria-label="Clash Mode options"
        >
          <Link
            href="/clash?mode=practice"
            role="menuitem"
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-[#00634B]"
            onClick={() => setOpen(false)}
          >
            <GraduationCap size={18} aria-hidden />
            Practice
          </Link>
          <Link
            href="/clash?mode=real_life"
            role="menuitem"
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-[#00634B]"
            onClick={() => setOpen(false)}
          >
            <Scale size={18} aria-hidden />
            Real Life
          </Link>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-12 h-12 rounded-full bg-[#F57C00] text-white shadow-lg flex items-center justify-center",
          "hover:scale-105 active:scale-95 transition-all ring-2 ring-white",
          "focus:outline-none focus:ring-2 focus:ring-[#F57C00]/50 focus:ring-offset-2"
        )}
        aria-label={open ? "Close Clash menu" : "Open Clash Mode"}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Swords size={22} aria-hidden />
      </button>
    </div>
  );
}
