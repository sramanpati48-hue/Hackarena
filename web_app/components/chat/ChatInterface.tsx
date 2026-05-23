"use client";

import { useState, useRef, useEffect } from "react";
import { Send, CheckCircle, User, Copy, Sparkles, MessageSquare, ArrowDown, Plus, ChevronDown, Menu } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AgentLog } from "./AgentLog";
import { StructuredReport } from "./StructuredReport";
import { ActionButtons } from "./ActionButtons";
import { VoiceInput, VoiceInputRef } from "./VoiceInput";
import { PDFDownloadPanel } from "./PDFDownloadPanel";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/context/AuthContext";
import { useGlobalChat } from "@/context/ChatContext";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { LawyerBrowserPanel, LawyerProfile } from "./LawyerBrowserPanel";
import { SahayakBrowserPanel } from "./SahayakBrowserPanel";
import { NodalGuideBrowserPanel } from "./NodalGuideBrowserPanel";
import { FemaleNyayGuidePanel } from "./FemaleCounsellorPanel";
import { RoutingConsentModal } from "./RoutingConsentModal";
import { ClashFloatingButton } from "@/components/clash/ClashFloatingButton";
interface Message {
  role: "user" | "assistant";
  content: string;
  agent?: string; // Add agent field
}

interface LogEntry {
  type: string;
  agent?: string;
  content: string;
  timestamp: string;
}

const SUGGESTED_QUESTIONS = [
  { icon: MessageSquare, text: "How do I file a property dispute case?", payload: "I want to file a property dispute case. What is the procedure?" },
  { icon: Sparkles, text: "Check my consumer rights", payload: "What are my basic consumer rights in India?" },
  { icon: CheckCircle, text: "Verify a legal document", payload: "How can I verify if a property document is authentic?" },
];

export function ChatInterface() {
  const pathname = usePathname();
  const isCasesPage = pathname === "/cases";
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [structuredReport, setStructuredReport] = useState<any>(null);
  const [suggestedActions, setSuggestedActions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [currentCaseId, setCurrentCaseId] = useState<string | null>(null);
  const [currentCasePending, setCurrentCasePending] = useState(false);
  const [questionFlowActive, setQuestionFlowActive] = useState(false);
  
  // Lawyer browser panel state
  const [recommendedLawyers, setRecommendedLawyers] = useState<LawyerProfile[]>([]);
  const [lawyerCaseId, setLawyerCaseId] = useState<string | null>(null);
  const [showLawyerPanel, setShowLawyerPanel] = useState(false);

  // Sahayak browser panel state
  const [recommendedSahayaks, setRecommendedSahayaks] = useState<any[]>([]);
  const [sahayakCaseId, setSahayakCaseId] = useState<string | null>(null);
  const [showSahayakPanel, setShowSahayakPanel] = useState(false);
  const [acceptedSahayakId, setAcceptedSahayakId] = useState<string | null>(null);

  // Nodal Guide modal panel state
  const [nodalGuideProfiles, setNodalGuideProfiles] = useState<any[]>([]);
  const [showNodalGuidePanel, setShowNodalGuidePanel] = useState(false);
  const [routingRecommendation, setRoutingRecommendation] = useState<any | null>(null);
  const [showRoutingConsentModal, setShowRoutingConsentModal] = useState(false);
  const [femaleNyayGuideProfiles, setFemaleNyayGuideProfiles] = useState<any[]>([]);
  const [showFemaleNyayGuidePanel, setShowFemaleNyayGuidePanel] = useState(false);
  
  // PDF download state - automatically populated when pdf_ready event received
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  
  // Global Chat Context
  const { 
    activeQuery, activeSession, activeSessionId, clearActiveQuery, clearActiveSession,
    historyCache, updateHistoryCache
  } = useGlobalChat();

  // Local Session ID
  const [localSessionId, setLocalSessionId] = useState<string>("");

  // Input collapse state: collapses after each submit, expands on click
  const [isInputCollapsed, setIsInputCollapsed] = useState(false);

  // TTS playback state
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopTTS = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = "";
      currentAudioRef.current = null;
    }
    setIsPlayingTTS(false);
  };

  const cleanTTS = (text: string) => {
    return text
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/<[^>]*>?/gm, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\{.*?\}/g, '')
      .replace(/[*_#`~>-]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  useEffect(() => {
    if (activeSessionId) {
       setLocalSessionId(activeSessionId);
    } else if (!localSessionId) {
       setLocalSessionId(crypto.randomUUID());
    }
  }, [activeSessionId, localSessionId]);
  
  // Real-time Intervention State
  const [interventionCaseId, setInterventionCaseId] = useState<string | null>(null);
  const [interventionCollection, setInterventionCollection] = useState<string>("moderator");

  // Auth state
  const { user, role, loading: authLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const MESSAGE_LIMIT = 10;

  const buildUserWebSocketUrl = (uid: string) => {
    const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL || "").trim();

    if (rawApiUrl) {
      try {
        const parsed = new URL(rawApiUrl);
        const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
        const cleanedPath = parsed.pathname.replace(/\/$/, "");
        return `${wsProtocol}//${parsed.host}${cleanedPath}/ws/user/${uid}`;
      } catch {
        // fallback to relative host below
      }
    }

    if (typeof window !== "undefined") {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProtocol}//${window.location.host}/ws/user/${uid}`;
    }

    return `ws://localhost:8000/ws/user/${uid}`;
  };

  // Session ID
  const userIdRef = useRef(user?.uid || `anon_${Math.floor(Math.random() * 1000)}`);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);
  // Stable refs for WS handler — avoids closing/reopening WS on state changes
  const interventionCaseIdRef = useRef<string | null>(null);
  const localSessionIdRef = useRef<string>("");
  const wsRef = useRef<WebSocket | null>(null);
  // Track which session we've already fetched so we don't hit the API more than once per session
  const lastFetchedSessionRef = useRef<string>("");

  // Auto-submit from context
  useEffect(() => {
    if (activeQuery && !isLoading) {
      handleSubmit(undefined, activeQuery);
      clearActiveQuery();
    }
  }, [activeQuery, isLoading]);

  // Load Active Session from Context (e.g. from My Cases)
  useEffect(() => {
    if (activeSession && Array.isArray(activeSession)) {
      setMessages(activeSession);
      clearActiveSession();
    }
  }, [activeSession]);

  useEffect(() => {
    if (user && localSessionId) {
      // Reset session-bound case/PDF state before restoring current session data
      setCurrentCaseId(null);
      setCurrentPdfUrl(null);
      setCurrentCasePending(false);
      userIdRef.current = user.uid;
      // Only fetch from backend if this session hasn't been fetched yet
      if (lastFetchedSessionRef.current !== localSessionId) {
        lastFetchedSessionRef.current = localSessionId;
        loadChatFromFirestore(user.uid, localSessionId);
        restoreSahayakPanel(localSessionId);
      }
    }
  }, [user?.uid, localSessionId]);

  // Keep refs in sync with state so the WS handler always reads fresh values without re-mounting
  useEffect(() => { interventionCaseIdRef.current = interventionCaseId; }, [interventionCaseId]);
  useEffect(() => { localSessionIdRef.current = localSessionId; }, [localSessionId]);

  // Real-time WebSocket Listener for Moderator Intervention
    // 🔌 WebSocket Management for Real-time Updates (Intervention Status)
    // IMPORTANT: depends ONLY on user.uid so it never tears down mid-session unexpectedly
    useEffect(() => {
        if (!user || authLoading) return;

        let destroyed = false;
        let reconnectTimeout: NodeJS.Timeout;

        const connect = () => {
            if (destroyed) return;

          const wsUrl = buildUserWebSocketUrl(user.uid);
            
            console.log(`🔌 Attempting WebSocket connection to: ${wsUrl}`);
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("✅ WebSocket Connected for user:", user.uid);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log("📩 WebSocket message received:", data.type);
          // Read from refs so we never need stale closure values
          const currentCaseId = interventionCaseIdRef.current;
          const currentSessionId = localSessionIdRef.current;

          if (data.type === "intervention_resolved") {
            const matchesByCase = currentCaseId && data.case_id === currentCaseId;
            const matchesBySession = currentSessionId && data.session_id === currentSessionId;
            if (matchesByCase || matchesBySession) {
              // Break the loading lock and present the moderator's response
              setIsLoading(false);
              let nextHistory: Message[] | null = null;
              const moderatorText = data.moderator_response || "A moderator has reviewed your case.";

              setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.agent === "legal_moderator" && lastMsg.content === moderatorText) {
                  return prev;
                }
                const newHistory: Message[] = [...prev, {
                  role: "assistant",
                  content: moderatorText,
                  agent: "legal_moderator"
                }];
                nextHistory = newHistory;
                return newHistory;
              });

              if (currentSessionId && nextHistory) {
                setTimeout(() => updateHistoryCache(currentSessionId, nextHistory as Message[]), 0);
              }

              const opts = data.moderator_options;
              let routingFromModerator: any = data.routing_recommendation || null;
              if (Array.isArray(opts) && opts.length > 0) {
                const cleanOpts = opts.filter((opt: any) => {
                  if (!opt || typeof opt !== "object") return true;
                  if (opt.type === "routing_bundle" && opt.routing_recommendation && !routingFromModerator) {
                    routingFromModerator = opt.routing_recommendation;
                    return false;
                  }
                  return opt.type !== "routing_bundle";
                });
                setSuggestedActions(cleanOpts);
              } else if (typeof opts === 'string') {
                try {
                  const parsed = JSON.parse(opts);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    const cleanParsed = parsed.filter((opt: any) => {
                      if (!opt || typeof opt !== "object") return true;
                      if (opt.type === "routing_bundle" && opt.routing_recommendation && !routingFromModerator) {
                        routingFromModerator = opt.routing_recommendation;
                        return false;
                      }
                      return opt.type !== "routing_bundle";
                    });
                    setSuggestedActions(cleanParsed);
                  }
                } catch (_) { /* ignore */ }
              }
              if (routingFromModerator) {
                setRoutingRecommendation(routingFromModerator);
                setShowRoutingConsentModal(true);
              }
              setInterventionCaseId(null);
              setCurrentCasePending(false);
            }
          }
        } catch (e) {
          console.error("Error parsing websocket message in chat interface:", e);
        }
      };

            ws.onerror = (error) => {
                console.error("❌ WebSocket error in ChatInterface:", error);
                // Attempt to log more detail if available
                if (ws.readyState === WebSocket.CLOSED) {
                console.error(`WebSocket is CLOSED for URL: ${wsUrl}. Check server route/prefix and mixed-content (ws:// vs wss://).`);
                }
            };

            ws.onclose = (event) => {
                console.log(`🔌 WebSocket Closed (code: ${event.code}, reason: ${event.reason || 'none'})`);
                if (!destroyed) {
                    // Auto-reconnect after 3 seconds if not intentionally closed
                    reconnectTimeout = setTimeout(connect, 3000);
                }
            };
        };

        connect();

        return () => {
            console.log("🧹 Cleaning up WebSocket connection...");
            destroyed = true;
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
                wsRef.current.close(1000, "Component unmounting");
            }
        };
    }, [user?.uid, authLoading]);

  const loadChatFromFirestore = async (uid: string, sessionId?: string) => {
    // Check Cache First
    if (sessionId && historyCache[sessionId] && historyCache[sessionId].length > 0) {
      setMessages(historyCache[sessionId]);
      
      // Restore options from the last message if available from cache
      const lastMsg = historyCache[sessionId][historyCache[sessionId].length - 1];
      if (lastMsg.options && Array.isArray(lastMsg.options)) {
        setSuggestedActions(lastMsg.options);
      } else {
        setSuggestedActions([]);
      }
      // Still try to restore sahayak panel from Supabase even when using cache
      if (sessionId) {
        restoreSahayakPanel(sessionId);
        restoreCasePdf(sessionId, uid);
      }
      return; // Exit early since we used cache
    }

    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/chat/history?uid=${uid}`;
      if (sessionId) {
        url += `&session_id=${sessionId}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.history) {
          setMessages(data.history);
          if (sessionId) {
            updateHistoryCache(sessionId, data.history);
          }
          // Restore options from the last message if available
          if (data.history.length > 0) {
            const lastMsg = data.history[data.history.length - 1];
            if (lastMsg.options && Array.isArray(lastMsg.options)) {
              setSuggestedActions(lastMsg.options);
            } else {
              setSuggestedActions([]);
            }
          }
        } else {
          setMessages([]);
          if (sessionId) updateHistoryCache(sessionId, []);
        }
        // Restore sahayak panel if this session had one
        if (sessionId) {
          restoreSahayakPanel(sessionId);
          restoreCasePdf(sessionId, uid);
        }
      }
    } catch (err) {
      console.error("Error loading chat history:", err);
    }
  };

  const restoreCasePdf = async (sessionId: string, uid: string) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_URL}/api/cases?uid=${encodeURIComponent(uid)}`);
      if (!res.ok) return;

      const data = await res.json();
      if (data.status !== "success" || !Array.isArray(data.cases)) return;

      // Bind to the currently open chat session only, and only to its latest case record.
      // This prevents stale PDFs from older cases in the same session from being shown.
      const sessionCases = data.cases.filter((c: any) => c?.session_id === sessionId);
      const latestSessionCase = sessionCases.length > 0 ? sessionCases[0] : null;

      if (!latestSessionCase || !latestSessionCase.pdf_url) {
        setCurrentCaseId(null);
        setCurrentPdfUrl(null);
        setCurrentCasePending(Boolean(latestSessionCase?.pending));
        return;
      }

      if (latestSessionCase.case_id) {
        setCurrentCaseId(latestSessionCase.case_id);
      }
      if (latestSessionCase.pdf_url) {
        setCurrentPdfUrl(latestSessionCase.pdf_url);
      }
      setCurrentCasePending(Boolean(latestSessionCase.pending));
    } catch (err) {
      console.error("Error restoring case PDF:", err);
    }
  };

  /**
   * Checks Supabase for a sahayak case linked to this session.
   * - If case is "accepted": shows the assigned guide's profile card (read-only).
   * - If case is "pending":  shows the browsing panel so user can still pick a guide.
   */
  const restoreSahayakPanel = async (sessionId: string) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_URL}/api/sahayak/session-case?session_id=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.status !== "success" || !data.case) return;

      const sc = data.case;
      setSahayakCaseId(sc.id);

      if (sc.status === "accepted" && sc.assigned_sahayak_profile) {
        // Convert db profile → panel format and show as single-item list (the assigned guide)
        const p = sc.assigned_sahayak_profile;
        setRecommendedSahayaks([{
          uid: p.uid || sc.assigned_sahayak_id,
          name: p.name || sc.assigned_sahayak_name || "Nyay Guide",
          location: p.location || "",
          occupation: p.occupation || "Community Legal Aid",
          bio: p.bio || "",
          avatar: p.avatar || "",
          contact_number: p.contact_number || "",
          email: p.email || "",
          availability: p.availability || "Available",
          rating: p.rating || 4.5,
          cases_resolved: p.cases_resolved || 0,
          languages: p.languages || [],
          isAssigned: true, // flag so panel can show "Already connected" state
        }]);
        setAcceptedSahayakId(sc.assigned_sahayak_id || null);
        setShowSahayakPanel(true);
      } else if (sc.status === "pending") {
        // Fetch all profiles for browsing (user hasn't picked yet)
        const profRes = await fetch(`${API_URL}/api/sahayak/profiles`);
        if (profRes.ok) {
          const profData = await profRes.json();
          if (profData.profiles && profData.profiles.length > 0) {
            setRecommendedSahayaks(profData.profiles.map((p: any) => ({
              uid: p.uid, name: p.name, location: p.location, occupation: p.occupation,
              bio: p.bio, avatar: p.avatar, contact_number: p.contact_number,
              email: p.email, availability: p.availability,
              rating: p.rating || 4.5, cases_resolved: p.cases_resolved || 0,
              languages: p.languages || [],
            })));
            setShowSahayakPanel(true);
          }
        }
      }
    } catch (err) {
      console.error("Error restoring sahayak panel:", err);
    }
  };

  // Add agent mapping for colors
  const [validationComplete, setValidationComplete] = useState(false);


  // Handle Copy
  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Reset validation state on new query
  useEffect(() => {
    if (isLoading) {
      setValidationComplete(false);
    }
  }, [isLoading]);

  // Add agent mapping for colors
  const agentColors: Record<string, string> = {
    cyber: "bg-cyan-500/20 text-cyan-700 border-cyan-500/30",
    scam: "bg-red-500/20 text-red-700 border-red-500/30",
    civil: "bg-blue-500/20 text-blue-700 border-blue-500/30",
    domestic: "bg-purple-500/20 text-purple-700 border-purple-500/30",
    document: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
    sahayak: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30",
    legal_moderator: "bg-rose-500/20 text-rose-700 border-rose-500/30"
  };

  function ValidationAnimation({ isVerified }: { isVerified: boolean }) {
    const status = isVerified ? 'verified' : 'forwarding';

    return (
      <div className="mt-4 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {status === 'forwarding' ? (
          <>
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 border-2 border-slate-200 rounded-full opacity-20"></div>
              <div className="absolute inset-0 border-2 border-t-[#00634B] rounded-full animate-spin"></div>
            </div>
            <span className="text-sm text-slate-400 font-medium animate-pulse">
              Forwarding to Legal Moderator...
            </span>
          </>
        ) : (
          <>
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50">
              <CheckCircle className="w-3 h-3 text-emerald-600" />
            </div>
            <span className="text-sm text-emerald-600 font-bold">
              Verified by Legal Moderator
            </span>
          </>
        )}
      </div>
    );
  }

  function ChatMessage({
    msg,
    index,
    isLast,
    structuredReport,
    suggestedActions,
    validationComplete,
    copiedIndex,
    handleCopy,
    handleChecklistSelect,
    handleAction,
    setValidationComplete,
    isNew // Add isNew to props
  }: any) {
    return (
      <div className={cn(
        "max-w-3xl mx-auto w-full flex gap-4 duration-500",
        isNew ? "animate-in fade-in slide-in-from-bottom-4" : "",
        msg.role === "user" ? "flex-row-reverse" : "flex-row"
      )}>
        <div className={cn(
          "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border overflow-hidden",
          msg.role === "user" ? "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700" : "bg-[#E6F0ED] dark:bg-emerald-900/30 border-[#00634B]/20 dark:border-emerald-500/20"
        )}>
          {msg.role === "user" ? (
            <User size={20} className="text-gray-400 dark:text-gray-300" />
          ) : (
            <div className="relative w-full h-full p-1.5">
              <Image src="/3.png" alt="AI Assistant" fill className="object-contain dark:hidden" />
              <Image src="/2.png" alt="AI Assistant" fill className="object-contain hidden dark:block" />
            </div>
          )}
        </div>

        <div className={cn(
          "flex-1 space-y-3",
          msg.role === "user" ? "text-right" : "text-left"
        )}>
          {msg.role === "user" ? (
            <div className="inline-block bg-[#E6F0ED] dark:bg-[#00634B] text-[#00634B] dark:text-emerald-50 px-6 py-4 rounded-[2rem] rounded-tr-sm font-bold shadow-sm max-w-[85%] text-left">
              {msg.content}
            </div>
          ) : (
            <div className="w-full space-y-4 group text-left">
              {msg.agent && (
                <div className={cn(
                  "flex items-center gap-2 mb-2 w-fit px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-[0.1em] shadow-sm",
                  msg.agent.toLowerCase() === "scam" ? "bg-red-50 text-red-600 border-red-100" :
                    "bg-white text-[#00634B] border-[#00634B]/20"
                )}>
                  <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {msg.agent}
                </div>
              )}

              <div className="relative border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-7 py-6 rounded-[2.5rem] rounded-tl-sm shadow-xl shadow-gray-200/20 dark:shadow-none leading-relaxed font-medium">
                <div className="prose-custom text-gray-700 dark:text-gray-300 text-[15px] leading-[1.8]">
                  <ReactMarkdown
                    components={{
                      // Headings
                      h1: ({ children }) => <h1 className="text-xl font-black text-gray-900 dark:text-white mt-5 mb-3 pb-1 border-b border-gray-100 dark:border-slate-700">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-4 mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-bold text-[#00634B] mt-3 mb-1.5">{children}</h3>,
                      // Paragraph
                      p: ({ children }) => <p className="mb-3 last:mb-0 leading-[1.85]">{children}</p>,
                      // Bold & Italic
                      strong: ({ children }) => <strong className="font-bold text-gray-900 dark:text-white">{children}</strong>,
                      em: ({ children }) => <em className="italic text-gray-600 dark:text-gray-400">{children}</em>,
                      // Unordered list
                      ul: ({ children }) => <ul className="my-3 ml-5 space-y-1.5 list-none">{children}</ul>,
                      li: ({ children, ...props }: any) => (
                        <li className="relative pl-4 before:content-['▸'] before:absolute before:left-0 before:text-[#00634B] before:font-bold">
                          {children}
                        </li>
                      ),
                      // Ordered list
                      ol: ({ children }) => <ol className="my-3 ml-5 space-y-1.5 list-decimal list-outside pl-1">{children}</ol>,
                      // Blockquote
                      blockquote: ({ children }) => (
                        <blockquote className="my-3 pl-4 border-l-4 border-[#00634B]/40 bg-[#E6F0ED]/30 dark:bg-emerald-900/10 rounded-r-lg py-2 text-gray-600 dark:text-gray-300 italic text-sm">
                          {children}
                        </blockquote>
                      ),
                      // Inline code
                      code: ({ inline, children, ...props }: any) => inline
                        ? <code className="bg-gray-100 dark:bg-slate-700 text-[#00634B] dark:text-emerald-400 px-1.5 py-0.5 rounded text-[13px] font-mono">{children}</code>
                        : <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-gray-200 p-4 rounded-xl my-3 overflow-x-auto text-sm font-mono leading-relaxed"><code>{children}</code></pre>,
                      // Clickable links
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#00634B] dark:text-emerald-400 underline underline-offset-2 hover:text-[#004D3C] dark:hover:text-emerald-300 transition-colors break-all"
                        >
                          {children}
                        </a>
                      ),
                      // Horizontal rule
                      hr: () => <hr className="my-4 border-gray-100 dark:border-slate-700" />,
                      // Table
                      table: ({ children }) => <div className="overflow-x-auto my-3"><table className="min-w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">{children}</table></div>,
                      thead: ({ children }) => <thead className="bg-[#E6F0ED]/60 dark:bg-emerald-900/20">{children}</thead>,
                      th: ({ children }) => <th className="px-4 py-2 text-left font-bold text-[#00634B] text-xs uppercase tracking-wider">{children}</th>,
                      td: ({ children }) => <td className="px-4 py-2 border-t border-gray-100 dark:border-slate-700">{children}</td>,
                    }}
                  >
                    {msg.content || "..."}
                  </ReactMarkdown>
                </div>
                <button
                  onClick={() => handleCopy(msg.content, index)}
                  className="absolute bottom-4 right-6 p-2 text-gray-300 hover:text-[#00634B] opacity-0 group-hover:opacity-100 transition-all bg-white rounded-xl border border-gray-100 shadow-sm"
                  title="Copy to clipboard"
                >
                  {copiedIndex === index ? <CheckCircle size={14} className="text-[#00634B]" /> : <Copy size={14} />}
                </button>
              </div>

              {isLast && structuredReport && (
                <StructuredReport
                  report={structuredReport}
                  onChecklistSelect={handleChecklistSelect}
                />
              )}

              {isLast && structuredReport?.risk_level === "High" && (
                <ValidationAnimation
                  isVerified={msg.agent === "legal_moderator"}
                />
              )}

              {isLast && suggestedActions.length > 0 && (
                (!structuredReport || structuredReport.risk_level !== "High" || msg.agent === "legal_moderator") && (
                  <ActionButtons actions={suggestedActions} onSelect={handleAction} />
                )
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentAgentRef = useRef<string | null>(null);
  const displayAgentRef = useRef<string | null>(null);
  const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceInputRef = useRef<VoiceInputRef>(null);
  const isConversationActive = useRef<boolean>(false);
  const savedCaseIdsRef = useRef<Set<string>>(new Set());
  const completedCaseIdsRef = useRef<Set<string>>(new Set());

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [query]);

  // Geolocation Request
  const [userLocation, setUserLocation] = useState<{ lat: number, lon: number } | null>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  // Unified Stream Processor
  const processStream = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    const decoder = new TextDecoder();
    let assistantMessage = "";
    let finalCleanContent = "";

    // Add temporary empty assistant message to stream into
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(line => line.trim() !== "");

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.type === "agent_start") {
              currentAgentRef.current = data.agent;
              const excludedDisplayAgents = ["question_processor", "report_generator", "legal_moderator", "supervisor", "agent"];
              if (!displayAgentRef.current && !excludedDisplayAgents.includes(String(data.agent).toLowerCase())) {
                displayAgentRef.current = data.agent;
              }
              setMessages(prev => {
                const newMsgs = [...prev];
                const lastMsg = newMsgs[newMsgs.length - 1];
                if (lastMsg.role === "assistant") {
                  if (!lastMsg.agent) {
                    lastMsg.agent = displayAgentRef.current || data.agent;
                  }
                }
                return newMsgs;
              });
            } else if (data.type === "log") {
              setLogs(prev => [...prev, {
                type: "log",
                agent: data.agent,
                content: data.content,
                timestamp: new Date().toLocaleTimeString()
              }]);

              // Update user bubble with the actual transcription
              if (data.content.startsWith("Transcription: ")) {
                const text = data.content.replace("Transcription: ", "").replace(/^'|'$/g, "");
                setMessages(prev => {
                  const newMsgs = [...prev];
                  // Find the last user message
                  for (let i = newMsgs.length - 1; i >= 0; i--) {
                    if (newMsgs[i].role === "user") {
                      newMsgs[i].content = "🎤 " + text;
                      break;
                    }
                  }
                  return newMsgs;
                });
              }
            } else if (data.type === "answer") {
              let token = data.content;
              if (typeof token !== "string") {
                token = typeof token?.text === "string" ? token.text : JSON.stringify(token);
              }
              assistantMessage += token;

              // Comprehensive client-side prefix stripping (server also strips, this is the safety net)
              let cleanContent = assistantMessage;

              const stripPatterns = [
                // "Output: civil" / supervisor leak
                /^Output:\s*(?:civil|cyber|domestic|scam|document|sahayak|legal_moderator|lawyer_forwarder)\s*/i,
                // "civil: ", "cyber: " etc.
                /^(?:civil|cyber|domestic|scam|document|sahayak|supervisor|assistant)\s*:\s*/i,
                // "Civil Agent: " etc.
                /^(?:civil|cyber|domestic|scam|document|sahayak|legal\s*moderator|lawyer\s*forwarder|supervisor)\s*agent\s*:\s*/i,
                // "I'm the Civil Agent." preambles
                /^I'm\s+the\s+(?:civil|cyber|domestic|scam|document|sahayak)\s+agent[.,!\s]*/i,
                /^I\s+am\s+the\s+(?:civil|cyber|domestic|scam|document|sahayak)\s+agent[.,!\s]*/i,
                // "AI Assistant: "
                /^AI\s*(?:Legal\s*)?Assistant\s*:\s*/i,
                // "Legal Moderator: "
                /^Legal\s*Moderator\s*:\s*/i,
              ];

              stripPatterns.forEach(regex => {
                cleanContent = cleanContent.replace(regex, '');
              });

              // Also strip by current agent name dynamically
              if (currentAgentRef.current) {
                const agentName = currentAgentRef.current.replace(/_/g, '[_ ]?');
                cleanContent = cleanContent
                  .replace(new RegExp(`^${agentName}[\\s_]?agent:\\s*`, 'i'), '')
                  .replace(new RegExp(`^${agentName}:\\s*`, 'i'), '');
              }

              cleanContent = cleanContent.trimStart();
              finalCleanContent = cleanContent;

              setMessages(prev => {
                const newMsgs = [...prev];
                const lastMsg = newMsgs[newMsgs.length - 1];
                if (lastMsg.role === "assistant") {
                  lastMsg.content = cleanContent;
                  lastMsg.agent = lastMsg.agent || displayAgentRef.current || currentAgentRef.current || undefined;
                }
                return newMsgs;
              });
            } else if (data.type === "lawyer_recommendations") {
              // Lawyer forwarder agent sent structured lawyer data
              if (data.lawyers && data.lawyers.length > 0) {
                setRecommendedLawyers(data.lawyers);
                setLawyerCaseId(data.lawyer_case_id || null);
                setShowLawyerPanel(true);
              }
            } else if (data.type === "sahayak_recommendations") {
              // Sahayak agent sent nearby guide profiles
              setRecommendedSahayaks(data.sahayaks || []);
              setSahayakCaseId(data.sahayak_case_id || null);
              setShowSahayakPanel(true);
            } else if (data.type === "nodal_guide_panel") {
              // Nodal Guide agent: user consented — show Gram Nyayalaya modal
              setNodalGuideProfiles(data.profiles || []);
              setShowNodalGuidePanel(true);
            } else if (data.type === "female_nyayguide_panel") {
              // Direct trauma-safe flow: open female NyayGuide panel immediately.
              setFemaleNyayGuideProfiles(data.profiles || []);
              setShowFemaleNyayGuidePanel(true);
            } else if (data.type === "routing_consent_modal") {
              // State-wise official police/cyber/legal-aid route consent
              setRoutingRecommendation(data.routing || null);
              setShowRoutingConsentModal(Boolean(data.routing));
            } else if (data.type === "pending_questions") {
              setQuestionFlowActive(true);
              setStructuredReport(null);
              setSuggestedActions([]);
              setCurrentPdfUrl(null);
              setLogs(prev => [...prev, {
                type: "log",
                agent: "question_processor",
                content: `Question ${Number(data.current_index || 0) + 1} of ${Array.isArray(data.questions) ? data.questions.length : 0} ready`,
                timestamp: new Date().toLocaleTimeString()
              }]);
            } else if (data.type === "pdf_ready") {
              // ✅ PDF automatically generated and ready for download
              console.log("📄 PDF is ready:", data.pdf_url);
              setQuestionFlowActive(false);
              if (data.case_id) {
                setCurrentCaseId(data.case_id);
              }
              if (data.pdf_url) {
                setCurrentPdfUrl(data.pdf_url);
              }

              // Persist complete case context (summary + Q&A + language + pdf URL) in Supabase
              if (user && data.case_id && !completedCaseIdsRef.current.has(data.case_id)) {
                completedCaseIdsRef.current.add(data.case_id);
                const completePayload = {
                  uid: user.uid,
                  case_id: data.case_id,
                  session_id: localSessionId,
                  structured_report: data.structured_report || structuredReport || {},
                  situation_summary: data.situation_summary || {},
                  collected_answers: data.collected_answers || {},
                  session_data: messages,
                  user_language: data.user_language || "english",
                  pdf_url: data.pdf_url || null,
                  generate_pdf: false
                };

                fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/cases/complete`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(completePayload)
                }).catch((err) => {
                  console.error("Failed to persist completed case:", err);
                  completedCaseIdsRef.current.delete(data.case_id);
                });
              }

              // Show completion message with download available
              setMessages(prev => [...prev, {
                role: "assistant",
                content: `✅ **Case document completed and ready!** Your comprehensive case report with all information has been generated and is ready for download from your case history.`,
                agent: "system"
              }]);
            } else if (data.type === "data") {
              const hasPendingQuestions = Array.isArray(data.pending_questions) && data.pending_questions.length > 0;
              if (hasPendingQuestions) {
                setQuestionFlowActive(true);
                setStructuredReport(null);
                setSuggestedActions([]);
                setCurrentPdfUrl(null);
              } else {
                setQuestionFlowActive(false);
                setStructuredReport(data.structured_report || null);
                setSuggestedActions(data.suggested_actions || []);
                if (data.routing_recommendation) {
                  setRoutingRecommendation(data.routing_recommendation);
                }
                if (data.show_routing_consent && data.routing_recommendation) {
                  setShowRoutingConsentModal(true);
                }
                if (data.show_female_nyayguide_panel) {
                  setFemaleNyayGuideProfiles(data.female_nyayguide_profiles || []);
                  setShowFemaleNyayGuidePanel(true);
                }
              }
              if (data.case_id) {
                setCurrentCaseId(data.case_id);
              }
              if (data.intervention_required) {
                  setInterventionCaseId(data.case_id);
                  setInterventionCollection(data.intervention_collection || "moderator");
                  setCurrentCasePending(true);
              }
              
              // Automatically formalize this thread into a distinct User Case in Firestore
              if (data.structured_report && data.case_id && user && !savedCaseIdsRef.current.has(data.case_id) && !data.case_completed) {
                savedCaseIdsRef.current.add(data.case_id);
                try {
                  // Reconstruct the final message array purely from the synchronous state closure update
                  setMessages(prev => {
                    const payload = {
                      uid: user.uid,
                      case_id: data.case_id,
                      structured_report: data.structured_report,
                      session_data: prev
                    };
                    
                    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/cases`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload)
                    }).catch(console.error);

                    return prev;
                  });
                } catch (e) {
                  console.error("Failed to save formalized case:", e);
                }
              }

            } else if (data.type === "error") {
              console.error("Stream error:", data.content);
            }
          } catch (e) {
            console.error("Error parsing NDJSON line:", e);
          }
        }
      }
    } catch (err) {
      console.error("Stream reading error:", err);
    }
    
    return finalCleanContent;
  };

  const handleNewChat = () => {
    setMessages([]);
    setStructuredReport(null);
    setSuggestedActions([]);
    setLogs([]);
    setQuery("");
    currentAgentRef.current = null;
    displayAgentRef.current = null;
    clearActiveSession();
    clearActiveQuery();
    setLocalSessionId(crypto.randomUUID());
    setIsInputCollapsed(false); // Always show input on new chat
    setRecommendedLawyers([]);
    setShowLawyerPanel(false);
    setLawyerCaseId(null);
    setCurrentPdfUrl(null); // Reset PDF URL for new chat
    setQuestionFlowActive(false);
    setRoutingRecommendation(null);
    setShowRoutingConsentModal(false);
    setFemaleNyayGuideProfiles([]);
    setShowFemaleNyayGuidePanel(false);
  };

  const handleLawyerAccept = async (lawyer: LawyerProfile) => {
    if (!lawyerCaseId || !lawyer.user_id) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/lawyer/cases/${lawyerCaseId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lawyer_id: lawyer.user_id })
      });
      // Add a user-facing message confirmation
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `✅ **Request sent to ${lawyer.name}!** They will review your case and get in touch with you shortly. Your case ID is \`${lawyerCaseId}\`.`,
        agent: "lawyer_forwarder"
      }]);
    } catch (e) {
      console.error("Failed to accept lawyer case:", e);
    }
  };

  const handleLawyerReject = (lawyer: LawyerProfile) => {
    // Just update UI — no backend action needed for rejection
    console.log("Rejected lawyer:", lawyer.name);
  };

  const handleSubmit = async (e?: React.FormEvent, overrideQuery?: string): Promise<string | void> => {
    e?.preventDefault();
    
    // Manual submit terminates continuous conversation loop
    if (!overrideQuery) {
      isConversationActive.current = false;
    }
    
    let text = overrideQuery || query;
    if ((!text.trim() && selectedContexts.length === 0) || isLoading) return;

    if (selectedContexts.length > 0 && !overrideQuery) {
      text = `[Context: ${selectedContexts.join(", ")}] ${text}`;
    }

    setQuery("");
    setSelectedContexts([]);
    setStructuredReport(null);
    setSuggestedActions([]);
    setQuestionFlowActive(false);
    setCurrentPdfUrl(null);
    setCurrentCaseId(null);
    setShowRoutingConsentModal(false);
    setIsLoading(true);
    setIsInputCollapsed(true); // Collapse input after send
    currentAgentRef.current = null;
    displayAgentRef.current = null;

    if (messages.length >= MESSAGE_LIMIT * 2 && !user) {
      setShowAuthModal(true);
      return;
    }

    setMessages(prev => [...prev, { role: "user", content: text }]);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          user_id: userIdRef.current,
          user_name: user?.displayName || user?.email?.split("@")[0] || "User",
          location: userLocation,
          session_id: localSessionId,
          // Send last 6 messages (3 exchanges) as rolling context for the backend
          session_history: messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
        }),
      });

      if (!response.body) throw new Error("No response body");
      return await processStream(response.body.getReader());
    } catch (err) {
      console.error("Chat Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (action: any) => {
    handleSubmit(undefined, action.label || action.payload);
  };

  const handleChecklistSelect = (item: string) => {
    if (!selectedContexts.includes(item)) {
      setSelectedContexts(prev => [...prev, item]);
    }
  };

  const removeContext = (item: string) => {
    setSelectedContexts(prev => prev.filter(c => c !== item));
  };

  useEffect(() => {
    if (!isLoading && messages.length > 0 && user && localSessionId) {
      // Sync to Firestore via backend
      syncHistoryToBackend(user.uid, messages, localSessionId);
    }
  }, [messages, user, localSessionId, isLoading]);

  const syncHistoryToBackend = async (uid: string, history: Message[], sessionId: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/chat/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: uid,
          session_id: sessionId,
          session_data: history
        })
      });
    } catch (e) {
      console.error("Error syncing history:", e);
    }
  };

  const handleTranscription = async (text: string, mode: "dictation" | "conversation", languageCode?: string) => {
    if (mode === "dictation") {
      isConversationActive.current = false;
      setQuery(prev => prev + (prev.length > 0 ? " " : "") + text);
      setTimeout(() => textareaRef.current?.focus(), 100);
    } else {
      // Conversation mode
      isConversationActive.current = true;
      const finalAssistantResponse = await handleSubmit(undefined, text);
      
      if (finalAssistantResponse) {
        try {
          // Clean the text to remove markdown, brackets, urls
          const ttsText = cleanTTS(finalAssistantResponse);
          if (!ttsText) throw new Error("Narratable text is empty afte cleaning.");

          setIsPlayingTTS(true);
          
          // Play the response using Sarvam TTS proxy
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/synthesize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              text: ttsText,
              target_language_code: languageCode || "hi-IN" 
            })
          });
          
          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`TTS generation failed: ${response.status} ${errText}`);
          }
          
          const rawBlob = await response.blob();
          if (rawBlob.size === 0) throw new Error("Received empty audio blob from TTS API");
          
          // Explicitly set the MIME type so the browser doesn't throw a NotSupportedError
          const audioBlob = new Blob([rawBlob], { type: "audio/mp3" });
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          
          // Stop any previous audio before playing this one
          stopTTS();
          currentAudioRef.current = audio;
          
          audio.onended = () => {
             URL.revokeObjectURL(audioUrl); // Clean up memory
             currentAudioRef.current = null;
             setIsPlayingTTS(false);
             if (isConversationActive.current && voiceInputRef.current?.mode === "conversation") {
                voiceInputRef.current.startRecording();
             }
          };
          
          audio.onerror = (e) => {
             console.error("Audio playback error:", e, audio.error);
             currentAudioRef.current = null;
             setIsPlayingTTS(false);
             if (isConversationActive.current && voiceInputRef.current?.mode === "conversation") {
                voiceInputRef.current.startRecording();
             }
          };
          
          // Attempt to play (might require user interaction first, but mic click should suffice)
          await audio.play();
        } catch (e) {
          console.error("Audio synthesis/playback error:", e);
          setIsPlayingTTS(false);
          currentAudioRef.current = null;
          if (isConversationActive.current && voiceInputRef.current?.mode === "conversation") {
             voiceInputRef.current.startRecording();
          }
        }
      } else {
         // Auto-restart if there was no final text response but conversation is still active
         if (isConversationActive.current && voiceInputRef.current?.mode === "conversation") {
            voiceInputRef.current.startRecording();
         }
      }
    }
  };

  // Handle scroll detection
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 300;
    setShowScrollButton(!isNearBottom && messages.length > 0);
  };

  // Scroll to bottom helper
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    chatEndRef.current?.scrollIntoView({ behavior });
  };

  // Auto scroll logic
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 250;

    if (isNearBottom || messages.length <= 1) {
      scrollToBottom(isLoading ? "auto" : "smooth");

      const timer = setTimeout(() => {
        scrollToBottom("smooth");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, logs, isLoading, structuredReport, suggestedActions, validationComplete]);

  return (
    <div className="flex bg-white dark:bg-slate-900 h-full max-h-screen overflow-hidden font-sans text-slate-900 dark:text-slate-100 selection:bg-[#00634B]/20">

      {/* Side Console Panel */}
      <AgentLog logs={logs} isOpen={isLogOpen} onToggle={() => setIsLogOpen(!isLogOpen)} />

      {/* Main Chat Area */}
      <main className="flex-1 flex transition-all duration-300 relative min-w-0 overflow-hidden">
        {/* Chat Column */}
        <div className={cn(
          "flex flex-col transition-all duration-500 relative",
          showLawyerPanel ? "flex-1" : "flex-1"
        )}>
        {!isCasesPage && (
          <Link
            href="/cases"
            title="Open Cases"
            className="absolute top-4 left-4 z-50 bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 shadow-sm rounded-[14px] p-2.5 flex items-center justify-center text-gray-500 hover:text-[#00634B] hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-all duration-200 active:scale-95"
          >
            <Menu size={20} />
          </Link>
        )}

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={(user, role) => {
            setShowAuthModal(false);
            // Re-sync logic is handled by useEffect on user/messages
            if (query) handleSubmit();
          }}
        />

        {/* Chat Stream */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className={cn(
            "flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar scroll-smooth will-change-transform relative transition-all duration-500",
            isInputCollapsed ? "pb-20" : "pb-48"
          )}
        >
          {messages.length === 0 && (
            <div className="max-w-3xl mx-auto w-full flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in zoom-in-95 duration-700">
              <div className="w-24 h-24 bg-[#E6F0ED] dark:bg-emerald-900/30 rounded-[40px] flex items-center justify-center mb-8 border-2 border-[#00634B]/10 shadow-xl shadow-[#00634B]/5 relative p-4">
                <Image src="/3.png" alt="AI Assistant" fill className="object-contain p-4 dark:hidden" />
                <Image src="/2.png" alt="AI Assistant" fill className="object-contain p-4 hidden dark:block" />
              </div>
              <h2 className="text-4xl font-black mb-4 text-gray-900 dark:text-white tracking-tight text-center">How can I help you?</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm text-center mb-12 text-lg">
                Your AI Legal Expert for procedures, rights, and document assistance.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full px-4">
                {SUGGESTED_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSubmit(undefined, q.payload)}
                    className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-[#00634B]/30 hover:-translate-y-1 transition-all text-left group"
                  >
                    <div className="bg-gray-50 dark:bg-slate-700 p-2 rounded-xl group-hover:bg-[#E6F0ED] dark:group-hover:bg-[#00634B]/20 transition-colors">
                      <q.icon className="w-5 h-5 text-gray-400 dark:text-gray-300 group-hover:text-[#00634B] dark:group-hover:text-emerald-400" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white">{q.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}


          {messages.map((msg, i) => (
            <ChatMessage
              key={i}
              msg={msg}
              index={i}
              isLast={i === messages.length - 1}
              isNew={i >= messages.length - 2} // Animate the latest user/assistant pair
              structuredReport={structuredReport}
              suggestedActions={suggestedActions}
              validationComplete={validationComplete}
              copiedIndex={copiedIndex}
              handleCopy={handleCopy}
              handleChecklistSelect={handleChecklistSelect}
              handleAction={handleAction}
              setValidationComplete={setValidationComplete}
            />
          ))}

          {/* Floating Scroll to Bottom Button */}
          {showScrollButton && (
            <button
              onClick={() => scrollToBottom("smooth")}
              className="fixed bottom-32 right-12 z-20 bg-white dark:bg-slate-800 p-3 rounded-full shadow-2xl border border-gray-100 dark:border-slate-700 text-[#00634B] hover:bg-[#E6F0ED] dark:hover:bg-slate-700 hover:scale-110 active:scale-95 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
              title="Scroll to bottom"
            >
              <ArrowDown size={20} className="animate-bounce" />
            </button>
          )}

          {/* Thinking Indicator */}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="max-w-3xl mx-auto w-full flex gap-4 animate-in fade-in duration-300">
              <div className="w-10 h-10 rounded-2xl bg-[#E6F0ED] dark:bg-emerald-900/30 border border-[#00634B]/20 flex items-center justify-center shadow-sm relative overflow-hidden">
                <Image src="/3.png" alt="AI Assistant" fill className="object-contain p-1.5 dark:hidden animate-pulse" />
                <Image src="/2.png" alt="AI Assistant" fill className="object-contain p-1.5 hidden dark:block animate-pulse" />
              </div>
              <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-6 py-4 rounded-[2rem] rounded-tl-sm shadow-xl shadow-gray-200/10 dark:shadow-none">
                <div className="flex gap-1.5 mt-1">
                  <div className="w-1.5 h-1.5 bg-[#00634B]/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-[#00634B]/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-[#00634B] rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          )}

          {/* Intervention Waiting Lock */}
          {currentCasePending && (
            <div className="max-w-3xl mx-auto w-full flex items-center justify-center py-6 animate-in fade-in duration-500">
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 px-6 py-4 rounded-2xl flex items-center gap-4 shadow-sm">
                <div className="relative w-6 h-6 flex-shrink-0">
                  <div className="absolute inset-0 border-2 border-orange-200 rounded-full opacity-20"></div>
                  <div className="absolute inset-0 border-2 border-t-orange-500 rounded-full animate-spin"></div>
                </div>
                <div>
                   <h4 className="text-orange-900 dark:text-orange-400 font-bold text-sm uppercase tracking-wider">Pending Moderator Review</h4>
                   <p className="text-orange-700 dark:text-orange-300 text-sm mt-0.5">A legal moderator is reviewing this case. You can continue chatting while review is in progress.</p>
                </div>
              </div>
            </div>
          )}

          <div className="h-24 md:h-32 flex-shrink-0" />
          <div ref={chatEndRef} />
        </div>

        {/* Floating restore button when input is collapsed */}
        {isInputCollapsed && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <button
              onClick={() => {
                setIsInputCollapsed(false);
                setTimeout(() => textareaRef.current?.focus(), 100);
              }}
              className="flex items-center gap-2.5 bg-[#00634B] hover:bg-[#004D3C] text-white text-xs font-bold px-5 py-3 rounded-full shadow-2xl shadow-[#00634B]/30 hover:scale-105 active:scale-95 transition-all group"
            >
              <MessageSquare size={15} className="group-hover:scale-110 transition-transform" />
              <span>Reply</span>
            </button>
          </div>
        )}

        {/* Floating Input Area */}
        <div
          className={cn(
            "absolute bottom-8 left-0 right-0 px-6 z-20 pointer-events-none flex justify-center transition-all duration-500",
            isInputCollapsed
              ? "opacity-0 translate-y-8 pointer-events-none select-none"
              : "opacity-100 translate-y-0"
          )}
        >
          <div className="w-full max-w-4xl pointer-events-auto transition-all duration-300">
            <div className="relative flex flex-col gap-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl p-2 rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15)] dark:shadow-none border border-gray-100 dark:border-slate-700 ring-1 ring-black/5 hover:ring-[#00634B]/20 transition-all">

              {/* Selected Context Badges */}
              {selectedContexts.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 pt-2 pb-1">
                  {selectedContexts.map((ctx, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-[#E6F0ED] text-[#00634B] border border-[#00634B]/10 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
                      <span>{ctx}</span>
                      <button
                        onClick={() => removeContext(ctx)}
                        className="hover:text-red-500 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 w-full px-2">
                <div className="pb-2.5 pl-2 flex items-center gap-1.5">
                  <div className={isPlayingTTS ? "opacity-30 pointer-events-none" : ""}>
                    <VoiceInput
                      ref={voiceInputRef}
                      onTranscription={handleTranscription}
                      isProcessing={isLoading}
                    />
                  </div>
                  {isPlayingTTS && (
                    <button
                      type="button"
                      onClick={stopTTS}
                      title="Stop Speaking"
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 hover:scale-105 active:scale-95 transition-all outline-none"
                    >
                      <div className="w-3.5 h-3.5 bg-red-600 dark:bg-red-500 rounded-sm"></div>
                    </button>
                  )}
                  {/* Manual collapse button */}
                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsInputCollapsed(true)}
                      title="Collapse input"
                      className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-[#00634B] hover:bg-[#E6F0ED] transition-all"
                    >
                      <ChevronDown size={16} />
                    </button>
                  )}
                </div>

                <form
                  onSubmit={(e) => handleSubmit(e)}
                  className="flex-1 relative pb-2"
                >

                  <textarea
                    ref={textareaRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder={currentCasePending ? "Moderator review pending. You can still continue chatting..." : "Ask follow-up or provide details..."}
                    rows={1}
                    className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none focus:border-0 focus-visible:ring-0 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-base py-3.5 pl-2 resize-none max-h-48 min-h-[48px] leading-relaxed transition-all disabled:opacity-50"
                    disabled={isLoading}
                  />
                  <div className="absolute -bottom-1 left-2 text-[9px] text-gray-300 font-bold uppercase tracking-widest pointer-events-none">
                    Shift + Enter for new line • Enter to send {!user && `(${Math.floor(messages.length / 2)}/${MESSAGE_LIMIT})`}
                  </div>
                  <button
                    type="submit"
                    disabled={!query.trim() || isLoading}
                    className="absolute right-1 bottom-2 w-12 h-12 bg-[#00634B] text-white rounded-full hover:bg-[#004D3C] hover:scale-110 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 transition-all shadow-xl shadow-[#00634B]/20 flex items-center justify-center group"
                  >
                    <Send className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </form>
              </div>
            </div>
            <div className="text-center mt-3 text-[10px] text-gray-400 font-black tracking-[0.2em] uppercase opacity-60">
              Verified AI Legal Intelligence
            </div>
          </div>
        </div>

        </div>

        {/* Lawyer Browser Split Panel */}
        {showLawyerPanel && recommendedLawyers.length > 0 && !showSahayakPanel && (
          <div className="w-[420px] flex-shrink-0 h-full overflow-hidden border-l border-gray-100 dark:border-slate-700 animate-in slide-in-from-right-8 duration-500">
            <LawyerBrowserPanel
              lawyers={recommendedLawyers}
              lawyerCaseId={lawyerCaseId}
              onClose={() => setShowLawyerPanel(false)}
              onAccept={handleLawyerAccept}
              onReject={handleLawyerReject}
            />
          </div>
        )}

        {/* Sahayak Browser Split Panel */}
        {showSahayakPanel && (
          <div className="w-[440px] flex-shrink-0 h-full overflow-hidden border-l border-gray-100 dark:border-slate-700 animate-in slide-in-from-right-8 duration-500">
            <SahayakBrowserPanel
              sahayaks={recommendedSahayaks}
              sahayakCaseId={sahayakCaseId}
              userId={user?.uid || ""}
              initialAcceptedId={acceptedSahayakId}
              onClose={() => { setShowSahayakPanel(false); setAcceptedSahayakId(null); }}
              onAccept={(uid, name) => {
                setShowSahayakPanel(false);
                setAcceptedSahayakId(null);
                setMessages(prev => [
                  ...prev,
                  { role: "assistant", content: `✅ You're now connected with **${name}**, your Nyay Guide! They'll contact you soon to provide hands-on assistance.` }
                ]);
              }}
            />
          </div>
        )}

        {/* PDF Download Panel */}
        <PDFDownloadPanel caseId={currentCaseId ?? undefined} pdfUrl={currentPdfUrl} />

        {/* Nodal Guide Modal Panel */}
        {showNodalGuidePanel && (
          <NodalGuideBrowserPanel
            profiles={nodalGuideProfiles}
            caseId={currentCaseId}
            userId={user?.uid || ""}
            onConnect={(profile) => {
              setShowNodalGuidePanel(false);
              setMessages(prev => [
                ...prev,
                { role: "assistant", content: `✅ You're now connected with **${profile.name}** (Gram Nyayalaya Nodal Guide). They will contact you soon for in-person legal assistance. 🏛️` }
              ]);
            }}
            onClose={() => setShowNodalGuidePanel(false)}
          />
        )}

        {showRoutingConsentModal && routingRecommendation && (
          <RoutingConsentModal
            routing={routingRecommendation}
            onClose={() => setShowRoutingConsentModal(false)}
          />
        )}

        {showFemaleNyayGuidePanel && (
          <FemaleNyayGuidePanel
            profiles={femaleNyayGuideProfiles}
            caseId={currentCaseId}
            userId={user?.uid || ""}
            onConnect={(profile) => {
              setShowFemaleNyayGuidePanel(false);
              setMessages(prev => [
                ...prev,
                { role: "assistant", content: `✅ You're now connected with **${profile.name}** (Female NyayGuide).` }
              ]);
            }}
            onClose={() => setShowFemaleNyayGuidePanel(false)}
          />
        )}
      </main>

      <ClashFloatingButton />
    </div>
  );
}
