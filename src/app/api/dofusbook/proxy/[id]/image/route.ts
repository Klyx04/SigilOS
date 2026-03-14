import { NextResponse } from "next/server";

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
];

function getRandomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Image Proxy for Dofusbook Summary JPG.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    if (!id || id.length < 3) {
        return new NextResponse("Invalid ID", { status: 400 });
    }

    try {
        let finalId = id;

        // Support d-bk.net short IDs
        if (!/^\d+$/.test(id)) {
            const shortUrl = `https://d-bk.net/fr/d/${id}`;
            const res = await fetch(shortUrl, { 
                method: "HEAD", 
                redirect: "follow",
                headers: { "User-Agent": getRandomUA() }
            });
            const finalUrl = res.url;
            const idMatch = finalUrl.match(/equipement\/(?:[a-z]+\/)?(\d+)/i);
            if (idMatch) {
                finalId = idMatch[1];
            } else {
                return new NextResponse("Could not resolve short URL", { status: 404 });
            }
        }

        const url = `https://www.dofusbook.net/fr/equipement/${finalId}.jpg`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": getRandomUA(),
                "Referer": `https://www.dofusbook.net/fr/equipement/${finalId}`,
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
            },
            next: { revalidate: 86400 } // Cache image for 24h
        });

        if (!response.ok) {
            console.error(`Dofusbook Image Proxy Fail [${id}]:`, response.status);
            return new NextResponse("Image not found", { status: 404 });
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get("Content-Type") || "image/jpeg";

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600"
            }
        });
    } catch (e) {
        console.error("Dofusbook Image Proxy Error:", e);
        return new NextResponse("Server Error", { status: 500 });
    }
}
