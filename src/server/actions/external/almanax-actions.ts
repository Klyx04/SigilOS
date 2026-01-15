"use server";

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

export async function getAlmanaxData(): Promise<{ success: boolean; data?: AlmanaxData; error?: string }> {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const res = await fetch(`https://api.dofusdu.de/dofus2/fr/almanax/${today}`, {
            next: { revalidate: 3600 }, // Cache for 1 hour
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch Almanax data. Status: ${res.status}`);
        }

        const data = await res.json();
        return { success: true, data };
    } catch (error) {
        console.error("Almanax Fetch Error:", error);
        return { success: false, error: "Impossible de charger l'Almanax" };
    }
}
