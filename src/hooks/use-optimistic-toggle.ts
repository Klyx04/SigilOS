"use client";

import { useState, useTransition, useCallback } from "react";
import { toast } from "sonner";

interface OptimisticToggleOptions<T> {
    onMutateServer: (item: T) => Promise<{ success: boolean; error?: string; data?: any }>;
    onSuccess?: (item: T, serverData?: any) => void;
    onError?: (item: T, error?: string) => void;
    successMessage?: string;
}

/**
 * ⚡ #186a — Hook Optimistic UI (Zero-Latency)
 * Met à jour l'interface immédiatement en 0ms côté client lors d'un toggle,
 * et rollback silencieusement en cas d'échec réseau avec notification d'erreur.
 */
export function useOptimisticSet<T extends string | number>(initialSet: Set<T> | T[] = []) {
    const [activeItems, setActiveItems] = useState<Set<T>>(() => new Set(initialSet));
    const [pendingItems, setPendingItems] = useState<Set<T>>(new Set());
    const [, startTransition] = useTransition();

    const toggle = useCallback((item: T, options: OptimisticToggleOptions<T>) => {
        // 1. Optimistic Update immédiat (0ms)
        setActiveItems((prev) => {
            const next = new Set(prev);
            if (next.has(item)) {
                next.delete(item);
            } else {
                next.add(item);
            }
            return next;
        });

        setPendingItems((prev) => new Set(prev).add(item));

        // 2. Exécution serveur en tâche de fond
        startTransition(async () => {
            try {
                const res = await options.onMutateServer(item);
                if (!res.success) {
                    // Rollback si échec
                    setActiveItems((prev) => {
                        const next = new Set(prev);
                        if (next.has(item)) {
                            next.delete(item);
                        } else {
                            next.add(item);
                        }
                        return next;
                    });
                    toast.error(res.error || "Échec de l'action");
                    options.onError?.(item, res.error);
                } else {
                    if (options.successMessage) {
                        toast.success(options.successMessage);
                    }
                    options.onSuccess?.(item, res.data);
                }
            } catch (err: any) {
                // Rollback si exception réseau
                setActiveItems((prev) => {
                    const next = new Set(prev);
                    if (next.has(item)) {
                        next.delete(item);
                    } else {
                        next.add(item);
                    }
                    return next;
                });
                toast.error("Erreur de connexion");
                options.onError?.(item, err.message);
            } finally {
                setPendingItems((prev) => {
                    const next = new Set(prev);
                    next.delete(item);
                    return next;
                });
            }
        });
    }, []);

    return {
        has: useCallback((item: T) => activeItems.has(item), [activeItems]),
        isPending: useCallback((item: T) => pendingItems.has(item), [pendingItems]),
        setItems: useCallback((items: Set<T> | T[]) => setActiveItems(new Set(items)), []),
        items: activeItems,
        toggle,
    };
}
