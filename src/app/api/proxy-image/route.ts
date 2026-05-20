import { NextRequest, NextResponse } from "next/server";

const ALLOWED_DOMAINS = [
  "imgur.com",
  "i.imgur.com",
  "dofuspourlesnoobs.com",
  "www.dofuspourlesnoobs.com",
  "ganymede-dofus.com",
  "ganymede-app.com",
];

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname.toLowerCase();

    // Validate the domain is in our whitelist
    const isAllowed = ALLOWED_DOMAINS.some(allowed => 
      domain === allowed || domain.endsWith("." + allowed)
    );

    if (!isAllowed) {
      return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
    }

    // Prepare headers to bypass hotlinking detection
    const headers = new Headers();
    headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    headers.set("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");
    headers.set("Accept-Language", "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7");
    // Spoof Referer to the target domain itself to bypass hotlink protection
    const targetOrigin = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
    headers.set("Referer", `${targetOrigin}/`);
    headers.set("Origin", targetOrigin);
    headers.set("Sec-Fetch-Dest", "image");
    headers.set("Sec-Fetch-Mode", "no-cors");
    headers.set("Sec-Fetch-Site", "same-origin");
    
    // Perform fetching on behalf of the client
    const response = await fetch(url, {
      headers,
      method: "GET",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status} ${response.statusText}` }, 
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid URL or proxy error" }, { status: 400 });
  }
}
