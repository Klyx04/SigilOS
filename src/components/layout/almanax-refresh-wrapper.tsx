"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface AlmanaxRefreshWrapperProps {
    children: React.ReactNode;
    secondsUntilMidnight: number;
}

/**
 * Client wrapper that triggers a page refresh at midnight (Paris time)
 * to fetch the new Almanax data
 */
export function AlmanaxRefreshWrapper({ children, secondsUntilMidnight }: AlmanaxRefreshWrapperProps) {
    const router = useRouter();

    useEffect(() => {
        // Set a timer to refresh the page at midnight
        const timeoutId = setTimeout(() => {
            router.refresh();
        }, secondsUntilMidnight * 1000);

        return () => clearTimeout(timeoutId);
    }, [secondsUntilMidnight, router]);

    return <>{children}</>;
}
