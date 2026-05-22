"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Loader2, Lock, ChevronRight, Globe } from "lucide-react";
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Redirect if already logged in
    React.useEffect(() => {
        if (user) {
            router.push("/");
        }
    }, [user, router]);

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError("");
        if (!auth) {
            setError("Authentication is unavailable. Please configure Firebase environment variables.");
            setIsLoading(false);
            return;
        }
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            
            // Sync with backend to get role
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    uid: result.user.uid,
                    email: result.user.email || "unknown"
                })
            });
            
            const data = await res.json();
            if (data.role === "moderator") {
                router.push("/moderator");
            } else {
                router.push("/");
            }
        } catch (err: any) {
            console.error(err);
            setError("Failed to sign in with Google. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        if (!auth) {
            setError("Authentication is unavailable. Please configure Firebase environment variables.");
            setIsLoading(false);
            return;
        }
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            
            // Sync with backend to get role
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    uid: result.user.uid,
                    email: result.user.email || "unknown"
                })
            });
            
            const data = await res.json();
            if (data.role === "moderator") {
                router.push("/moderator");
            } else {
                router.push("/");
            }
        } catch (err: any) {
            console.error(err);
            setError("Invalid email or password. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8F9FA] flex flex-col md:flex-row font-sans">
            {/* Left side: Branding/Art */}
            <div className="hidden md:flex md:w-1/2 bg-[#00634B] relative overflow-hidden items-center justify-center p-12">
                <div className="absolute inset-0 opacity-20">
                    <Image src="/4.png" alt="Background" fill className="object-cover" />
                </div>
                <div className="relative z-10 max-w-lg text-white">
                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-3xl w-fit mb-8 border border-white/20">
                        <Image src="/3.png" alt="Logo" width={64} height={64} />
                    </div>
                    <h1 className="text-5xl font-black mb-6 leading-tight tracking-tight">
                        Your Trusted <br />
                        AI Legal Partner
                    </h1>
                    <p className="text-emerald-50/80 text-xl leading-relaxed mb-8">
                        Access instant legal intelligence, procedures, and documentation support anywhere, anytime.
                    </p>
                    <div className="flex items-center gap-4 py-6 border-t border-white/10">
                        <div className="flex -space-x-3">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="w-10 h-10 rounded-full border-2 border-[#00634B] bg-emerald-100 flex items-center justify-center overflow-hidden">
                                    <Image src={`/user-${i}.png`} alt="User" width={40} height={40} className="object-cover" />
                                </div>
                            ))}
                        </div>
                        <p className="text-sm font-medium italic text-emerald-100">Joined by 10,000+ citizens daily</p>
                    </div>
                </div>
            </div>

            {/* Right side: Login form */}
            <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative">
                <div className="absolute top-8 right-8 flex items-center gap-2">
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all">
                        <Globe size={14} />
                        English
                    </button>
                </div>

                <div className="w-full max-w-md animate-in fade-in slide-in-from-right-4 duration-700">
                    <div className="mb-10 text-center md:text-left">
                        <h2 className="text-3xl font-black text-gray-900 mb-2">Welcome Back</h2>
                        <p className="text-gray-500 font-medium">Log in to NyayaSahayak to access your profile</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl font-semibold flex items-center gap-3 animate-in shake duration-500">
                            <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
                            {error}
                        </div>
                    )}

                    <div className="space-y-4 mb-8">
                        <button
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                            className="w-full h-14 flex items-center justify-center gap-4 bg-white border border-gray-200 rounded-2xl text-gray-700 font-bold hover:bg-gray-50 hover:border-emerald-500/30 transition-all shadow-sm active:scale-95 group disabled:opacity-50"
                        >
                            <svg className="w-6 h-6 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Continue with Google
                        </button>

                        <div className="relative py-4 flex items-center">
                            <div className="flex-grow border-t border-gray-100"></div>
                            <span className="flex-shrink-0 mx-4 text-xs font-black text-gray-300 uppercase tracking-widest">or login with email</span>
                            <div className="flex-grow border-t border-gray-100"></div>
                        </div>

                        <form onSubmit={handleEmailSignIn} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-black text-gray-700 uppercase tracking-wider pl-1">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-600 transition-colors" size={20} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full h-14 pl-12 pr-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium"
                                        placeholder="name@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between pl-1">
                                    <label className="text-sm font-black text-gray-700 uppercase tracking-wider">Password</label>
                                    <button type="button" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">Forgot Password?</button>
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-600 transition-colors" size={20} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full h-14 pl-12 pr-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-14 bg-[#00634B] hover:bg-[#004D3C] text-white font-black rounded-2xl shadow-xl shadow-emerald-900/10 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-70 group"
                            >
                                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                    <>
                                        Sign In <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    <p className="text-center text-gray-500 font-bold">
                        New to NyayaSahayak? {" "}
                        <Link href="/signup" className="text-emerald-600 hover:text-emerald-700 transition-colors">
                            Create an account
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
