import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    try {
        let finalId = id;

        // Si l'ID contient autre chose que des chiffres (ex: "1R9xf" format url courte d-bk.net)
        if (!/^\d+$/.test(id)) {
            const shortUrl = `https://d-bk.net/fr/d/${id}`;
            const { stdout: headers } = await execAsync(`curl.exe -sI "${shortUrl}"`);
            const locationMatch = headers.match(/Location:\s*([^\r\n]+)/i);

            if (locationMatch) {
                const redirectUrl = locationMatch[1].trim();
                const idMatch = redirectUrl.match(/equipement\/(?:[a-z]+\/)?(\d+)/i);
                if (idMatch) {
                    finalId = idMatch[1];
                } else {
                    return NextResponse.json({ error: "L'URL raccourcie ne redirige pas vers un équipement valide" }, { status: 400 });
                }
            } else {
                return NextResponse.json({ error: "Impossible de résoudre le lien Dofusbook raccourci" }, { status: 404 });
            }
        }

        const url = `https://www.dofusbook.net/api/stuffs/dofus/public/${finalId}`;
        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
        const referer = "https://www.dofusbook.net/";

        // Execute curl command
        const { stdout, stderr } = await execAsync(
            `curl.exe -L "${url}" -A "${userAgent}" -H "Referer: ${referer}" --max-time 10`

        );

        if (!stdout) {
            console.error(`[Dofusbook Proxy] Empty response for ${id}:`, stderr);
            return NextResponse.json({ error: "Empty response" }, { status: 502 });
        }

        try {
            const data = JSON.parse(stdout);

            // DEBUG: See what Dofusbook is actually sending us
            console.log(`[Dofusbook Proxy] Build ${id} keys:`, Object.keys(data));
            if (data.stuff) {
                console.log(`[Dofusbook Proxy] Build ${id} Class:`, data.stuff.character_class, "Level:", data.stuff.character_level);
            }

            return NextResponse.json(data, {
                headers: {
                    "Cache-Control": "no-store" // Force fresh data for debugging
                }
            });
        } catch (parseError) {
            console.error(`[Dofusbook Proxy] Parse error for ${id}. Stdout snippet: ${stdout.substring(0, 100)}`);
            return NextResponse.json({ error: "Invalid JSON" }, { status: 502 });
        }
    } catch (error: any) {
        console.error(`[Dofusbook Proxy] Execution error for build ${id}:`, error.message);
        return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }
}
