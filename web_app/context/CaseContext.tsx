"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

export interface LegalCase {
    id: string;
    title: string;
    status: string;
    statusColor?: string;
    clientId: string;
    lawyerId: string;
    lastUpdate: any;
    description: string;
    type: string;
}

export const useCases = () => {
    const { user, role, loading: authLoading } = useAuth();
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Wait for auth and role fetching to complete before attempting Firestore reads
        if (authLoading) return;

        // Only fetch cases for non-moderators (moderators use websockets)
        const normalizedRole = (role || '').trim().toLowerCase();
        if (!user || !user.uid || normalizedRole === 'moderator' || normalizedRole === 'guide' || normalizedRole === 'sahayak' || normalizedRole === 'nyay_guide') {
            setCases([]);
            setLoading(false);
            return;
        }

        if (!db) {
            setCases([]);
            setError("Case data is unavailable. Please configure Firebase environment variables.");
            setLoading(false);
            return;
        }

        try {
            const casesRef = collection(db, 'cases');
            const q = query(
                casesRef,
                where('clientId', '==', user.uid),
                orderBy('lastUpdate', 'desc')
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const casesData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        title: data.title || "Untitled Case",
                        status: data.status || "Pending",
                        statusColor: data.statusColor || "bg-gray-100 text-gray-600",
                        clientId: data.clientId || "",
                        lawyerId: data.lawyerId || "",
                        lastUpdate: data.lastUpdate || null,
                        description: data.description || "",
                        type: data.type || "General"
                    } as LegalCase;
                });

                setCases(casesData);
                setLoading(false);
            }, (err) => {
                console.error("Error fetching cases:", err);
                setError(err.message);
                setLoading(false);
            });

            return () => unsubscribe();
        } catch (err: any) {
            console.error("Error setting up cases listener:", err);
            setError(err.message);
            setLoading(false);
        }
    }, [user, role, authLoading]);

    return { cases, loading, error };
};
