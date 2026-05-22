"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Lawyer {
    id: string;
    name: string;
    specialization: string;
    lawyerType: string;
    experience: number;
    hourlyRate: number;
    rating: number;
    bio: string;
    avatar: string;
    location: string;
    verified: boolean;
}

interface LawyerFilters {
    specialization?: string;
    lawyerType?: string;
    minExperience?: number;
    maxBudget?: number;
    keyword?: string;
}

interface LawyerContextType {
    lawyers: Lawyer[];
    loading: boolean;
    error: string | null;
    filters: LawyerFilters;
    setFilters: (filters: LawyerFilters) => void;
    searchLawyers: (query: string) => Promise<void>;
}

const LawyerContext = createContext<LawyerContextType | undefined>(undefined);

export const LawyerProvider = ({ children }: { children: React.ReactNode }) => {
    const [lawyers, setLawyers] = useState<Lawyer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<LawyerFilters>({});

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const normalizeLawyer = (raw: any): Lawyer => {
        const professional = raw?.professional_details || {};
        const parsedExperience = Number(raw?.experience ?? professional?.yearsOfExperience ?? 0);
        const parsedRate = Number(raw?.hourly_rate ?? raw?.hourlyRate ?? 0);
        const parsedRating = Number(raw?.rating ?? 0);

        return {
            id: String(raw?.id ?? raw?.user_id ?? raw?.uid ?? raw?.firebase_uid ?? raw?.email ?? crypto.randomUUID()),
            name: String(raw?.name ?? professional?.fullName ?? "Legal Expert"),
            specialization: String(raw?.specialization ?? professional?.specialization ?? "General Practice"),
            lawyerType: String(raw?.lawyer_type ?? raw?.lawyerType ?? "Consultation"),
            experience: Number.isFinite(parsedExperience) ? parsedExperience : 0,
            hourlyRate: Number.isFinite(parsedRate) ? parsedRate : 0,
            rating: Number.isFinite(parsedRating) && parsedRating > 0 ? parsedRating : 4.5,
            bio: String(raw?.bio ?? "Experienced legal professional."),
            avatar: String(
                raw?.avatar ||
                "https://images.unsplash.com/photo-1556157382-97dee2dcb9d9?q=80&w=2670&auto=format&fit=crop"
            ),
            location: String(raw?.location ?? professional?.officeAddress ?? "India"),
            verified: Boolean(raw?.verified ?? professional?.fullName),
        };
    };

    const applyFilters = (rows: Lawyer[], activeFilters: LawyerFilters): Lawyer[] => {
        return rows.filter((l) => {
            if (activeFilters.specialization && l.specialization !== activeFilters.specialization) {
                return false;
            }
            if (activeFilters.lawyerType && l.lawyerType !== activeFilters.lawyerType) {
                return false;
            }
            if (activeFilters.minExperience && l.experience < activeFilters.minExperience) {
                return false;
            }
            if (activeFilters.maxBudget && l.hourlyRate > activeFilters.maxBudget) {
                return false;
            }
            return true;
        });
    };

    const searchLawyers = async (keyword: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/lawyers/search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: keyword })
            });
            if (res.ok) {
                const data = await res.json();
                const normalized = (data.lawyers || []).map(normalizeLawyer);
                setLawyers(applyFilters(normalized, filters));
            } else {
                const errData = await res.json().catch(() => ({}));
                setError(errData?.detail || "Failed to search lawyers.");
                setLawyers([]);
            }
        } catch (err: any) {
            console.error("Vector search error:", err);
            setError(err.message);
            setLawyers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Keyword search uses vector search endpoint.
        if (filters.keyword) {
            searchLawyers(filters.keyword);
            return;
        }

        let cancelled = false;

        const fetchLawyers = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`${API_URL}/api/lawyers`);
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData?.detail || "Failed to fetch lawyers.");
                }
                const data = await res.json();
                const normalized = (data.lawyers || []).map(normalizeLawyer);
                if (!cancelled) {
                    setLawyers(applyFilters(normalized, filters));
                }
            } catch (err: any) {
                console.error("Error fetching lawyers:", err);
                if (!cancelled) {
                    setError(err.message || "Unable to load lawyers.");
                    setLawyers([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchLawyers();

        return () => {
            cancelled = true;
        };
    }, [filters, API_URL]);

    return (
        <LawyerContext.Provider value={{ lawyers, loading, error, filters, setFilters, searchLawyers }}>
            {children}
        </LawyerContext.Provider>
    );
};

export const useLawyers = () => {
    const context = useContext(LawyerContext);
    if (context === undefined) {
        throw new Error('useLawyers must be used within a LawyerProvider');
    }
    return context;
};
