"use server";
import { logger } from "@/lib/logger";

type AlmanaxData = {
    bonus: {
        description: string;
        type: {
            name: string;
            id: string;
        };
    };
    tribute: {
        item: {
            name: string;
            image_urls: {
                icon: string;
            };
        };
        quantity: number;
    };
    date: string;
};

/**
 * Calculate seconds until midnight in Paris timezone
 */
function getSecondsUntilMidnight(): number {
    const now = new Date();
    // Get current time in Paris timezone
    const parisTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));

    // Calculate midnight Paris time
    const midnight = new Date(parisTime);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);

    // Calculate difference in seconds, add 60s buffer to ensure API has updated
    const secondsUntilMidnight = Math.floor((midnight.getTime() - parisTime.getTime()) / 1000) + 60;

    // Minimum 60 seconds, maximum 24 hours
    return Math.max(60, Math.min(secondsUntilMidnight, 86400));
}

export async function getAlmanaxData(): Promise<{
    success: boolean;
    data?: AlmanaxData;
    error?: string;
    secondsUntilMidnight?: number;
}> {
    try {
        // Use Paris timezone for date to match Dofus game day
        const parisDate = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }); // YYYY-MM-DD format
        const secondsUntilMidnight = getSecondsUntilMidnight();
        const url = `https://api.dofusdu.de/dofus2/fr/almanax/${parisDate}`;

        let res = await fetch(url, {
            headers: {
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            },
            next: { revalidate: secondsUntilMidnight }, // Dynamic cache until midnight
        });

        if (!res.ok) {
            logger.warn(`Direct fetch for Almanax data failed (${res.status}), trying proxy...`);
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            res = await fetch(proxyUrl, {
                headers: { "User-Agent": "SigilOS/1.0" },
                next: { revalidate: secondsUntilMidnight }
            });

            if (res.ok) {
                const text = await res.text();
                try {
                    const json = JSON.parse(text);
                    if (json.contents) {
                        return { success: true, data: JSON.parse(json.contents), secondsUntilMidnight };
                    }
                } catch (e) {
                    throw new Error(`Proxy returned invalid JSON: ${text.slice(0, 100)}`);
                }
            }
            throw new Error(`Proxy fallback failed. Status: ${res.status}`);
        }

        const data = await res.json();
        return { success: true, data, secondsUntilMidnight };
    } catch (error) {
        logger.error("Almanax Fetch Error:", error);
        return { success: false, error: "Impossible de charger l'Almanax" };
    }
}
