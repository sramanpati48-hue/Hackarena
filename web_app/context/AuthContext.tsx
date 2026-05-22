"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
    onAuthStateChanged,
    User,
    signOut,
    signInWithPopup,
    GoogleAuthProvider
} from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    role: string | null;
    logout: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    role: null,
    logout: async () => { },
    signInWithGoogle: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string | null>(null);

    const normalizeRole = (value: string | null | undefined): string | null => {
        if (!value) return null;
        const normalized = value.trim().toLowerCase();
        if (normalized === "guide" || normalized === "nyay_guide" || normalized === "nyay guide") {
            return "sahayak";
        }
        return normalized;
    };

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
            if (user) {
                setLoading(true);
                setUser(user);

                // Load cached role immediately so UI doesn't flicker to victim
                const roleKey = `role_${user.uid}`;
                const cachedRole = localStorage.getItem(roleKey);
                // Never trust cached victim as authoritative; it can be stale.
                if (cachedRole === "victim") {
                    localStorage.removeItem(roleKey);
                } else if (cachedRole) {
                    setRole(normalizeRole(cachedRole));
                }

                // Fetch role from backend
                try {
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/login`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                                uid: user.uid,
                                email: user.email || "unknown",
                                // Do not force victim on refresh when role cache is missing.
                                ...(cachedRole ? { role: cachedRole } : {}),
                            }),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const normalizedRole = normalizeRole(data.role);
                        setRole(normalizedRole);
                        // Persist only elevated roles; avoid sticky victim cache.
                        if (normalizedRole && normalizedRole !== "victim") {
                            localStorage.setItem(roleKey, normalizedRole);
                        } else {
                            localStorage.removeItem(roleKey);
                        }
                    } else {
                        // Prevent stale victim cache from pinning privileged users.
                        if (cachedRole === "victim") {
                            localStorage.removeItem(roleKey);
                            setRole(null);
                        }
                    }
                } catch (err) {
                    console.error("Error fetching user role:", err);
                    // Keep elevated cached roles, but drop stale victim cache.
                    if (cachedRole === "victim") {
                        localStorage.removeItem(roleKey);
                        setRole(null);
                    }
                }
                setLoading(false);
            } else {
                setUser(null);
                setRole(null);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        if (!auth) return;
        await signOut(auth);
    };

    const signInWithGoogle = async () => {
        if (!auth) {
            throw new Error("Authentication is unavailable. Please check Firebase configuration.");
        }
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    };

    return (
        <AuthContext.Provider value={{ user, loading, role, logout, signInWithGoogle }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
