import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const image = searchParams.get("image");

    if (!image || !/^\d+$/.test(image)) {
        return NextResponse.json({ error: "Invalid image ID" }, { status: 400 });
    }

    try {
        const imageUrl = `https://www.dofusroom.com/img/assets/items/${image}.png`;
        const res = await fetch(imageUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.dofusroom.com/buildroom/build/show/413702"
            },
            next: { revalidate: 86400 } // Cache for 24 hours
        });

        if (!res.ok) {
            return new Response("Failed to fetch image from source", { status: res.status });
        }

        const buffer = await res.arrayBuffer();

        return new Response(buffer, {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            }
        });
    } catch (err) {
        console.error("[DofusRoom Image Proxy] Error:", err);
        return new Response("Internal server error", { status: 500 });
    }
}
