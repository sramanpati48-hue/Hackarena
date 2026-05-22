"use client";

import { useState } from "react";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { CaseSidebar } from "@/components/chat/CaseSidebar";

export default function CasesPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-full w-full bg-white dark:bg-slate-900 relative overflow-hidden">
      <CaseSidebar
        isCollapsed={isSidebarCollapsed}
        onCollapse={() => setIsSidebarCollapsed(true)}
        onExpand={() => setIsSidebarCollapsed(false)}
      />

      <div className="flex-1 relative overflow-hidden h-full min-w-0">
        <ChatInterface />
      </div>
    </div>
  );
}
