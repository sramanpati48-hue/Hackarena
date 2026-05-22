"use client";

import React, { createContext, useContext, useState } from "react";

interface ChatContextType {
  isChatOpen: boolean;
  activeQuery: string | null;
  activeSessionId: string | null;
  activeSession: any[] | null;
  setActiveSessionId: (id: string | null) => void;
  setActiveSession: (session: any[] | null) => void;
  openChatWithQuery: (query: string) => void;
  openChatWithSession: (sessionId: string, session: any[]) => void;
  openChat: () => void;
  closeChat: () => void;
  clearActiveQuery: () => void;
  clearActiveSession: () => void;
  sessionCache: any[];
  setSessionCache: (sessions: any[]) => void;
  historyCache: Record<string, any[]>;
  updateHistoryCache: (sessionId: string, history: any[]) => void;
}

const ChatContext = createContext<ChatContextType>({
  isChatOpen: false,
  activeQuery: null,
  activeSessionId: null,
  activeSession: null,
  setActiveSessionId: () => {},
  setActiveSession: () => {},
  openChatWithQuery: () => {},
  openChatWithSession: () => {},
  openChat: () => {},
  closeChat: () => {},
  clearActiveQuery: () => {},
  clearActiveSession: () => {},
  sessionCache: [],
  setSessionCache: () => {},
  historyCache: {},
  updateHistoryCache: () => {},
});

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<any[] | null>(null);
  const [sessionCache, setSessionCache] = useState<any[]>([]);
  const [historyCache, setHistoryCache] = useState<Record<string, any[]>>({});

  const updateHistoryCache = (sessionId: string, history: any[]) => {
    setHistoryCache(prev => ({ ...prev, [sessionId]: history }));
  };

  const openChatWithQuery = (query: string) => {
    setActiveQuery(query);
    setActiveSession(null);
    setActiveSessionId(null);
    setIsChatOpen(true);
  };

  const openChatWithSession = (sessionId: string, session: any[]) => {
    setActiveSessionId(sessionId);
    setActiveSession(session);
    setActiveQuery(null);
    setIsChatOpen(true);
  };

  const openChat = () => setIsChatOpen(true);
  
  const closeChat = () => {
    setIsChatOpen(false);
  };

  const clearActiveQuery = () => {
    setActiveQuery(null);
  };

  const clearActiveSession = () => {
    setActiveSession(null);
    setActiveSessionId(null);
  };

  return (
    <ChatContext.Provider value={{ 
      isChatOpen, activeQuery, activeSession, activeSessionId,
      setActiveSession, setActiveSessionId,
      openChatWithQuery, openChatWithSession, openChat, closeChat, 
      clearActiveQuery, clearActiveSession,
      sessionCache, setSessionCache,
      historyCache, updateHistoryCache
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useGlobalChat = () => useContext(ChatContext);
