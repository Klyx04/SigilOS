import * as fs from "fs";
import * as path from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";

const DPLN_BASE = "https://www.dofuspourlesnoobs.com";

const ASSETS_TO_DOWNLOAD = [
    // --- ELEVAGE ---
    { dir: "elevage", filename: "montures_types.png", url: `${DPLN_BASE}/uploads/1/3/0/1/13010384/tuto3ielevage-sommaire_orig.jpg` },
    { dir: "elevage", filename: "dragodindes.png", url: `${DPLN_BASE}/uploads/1/3/0/1/13010384/tuto3i7dragos_orig.png` },
    { dir: "elevage", filename: "muldos.png", url: `${DPLN_BASE}/uploads/1/3/0/1/13010384/tuto3i8muldos_orig.png` },
    { dir: "elevage", filename: "volkornes.png", url: `${DPLN_BASE}/uploads/1/3/0/1/13010384/tuto3i9volkornes_orig.png` },
    { dir: "elevage", filename: "stats_dragodindes.jpg", url: `${DPLN_BASE}/uploads/1/3/0/1/13010384/tuto3i10statsdragos_orig.jpg` },
    { dir: "elevage", filename: "stats_muldos.jpg", url: `${DPLN_BASE}/uploads/1/3/0/1/13010384/tuto3i11statsmuldos_orig.jpg` },
    { dir: "elevage", filename: "stats_volkornes.jpg", url: `${DPLN_BASE}/uploads/1/3/0/1/13010384/tuto3i12statsvolkornes_orig.jpg` },
    { dir: "elevage", filename: "enclos_guilde.jpg", url: `${DPLN_BASE}/uploads/1/3/0/1/13010384/tuto3i23enclos_orig.jpg` },
    { dir: "elevage", filename: "craft_objets.png", url: `${DPLN_BASE}/uploads/1/3/0/1/13010384/tuto3i24crafts_orig.png` },
    { dir: "elevage", filename: "filet_capture.png", url: `${DPLN_BASE}/uploads/1/3/0/1/13010384/tuto3i13filet_orig.png` },
    { dir: "elevage", filename: "makina.png", url: `${DPLN_BASE}/uploads/1/3/0/1/13010384/tuto3i15makina_orig.png` },
    { dir: "elevage", filename: "animakina.png", url: `${DPLN_BASE}/uploads/1/3/0/1/13010384/tuto3i20animakina_orig.png` },
    { dir: "elevage", filename: "kromakina.png", url: `${DPLN_BASE}/uploads/1/3/0/1/13010384/tuto3i21kromakina_orig.png` },
    { dir: "elevage", filename: "optimakina.png", url: `${DPLN_BASE}/uploads/1/3/0/1/13010384/tuto3i22optimakina_orig.png` },
];

async function downloadFile(url: string, dest: string) {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 100) {
        console.log(`⏩ Already exists: ${path.basename(dest)}`);
        return;
    }

    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.dofuspourlesnoobs.com/",
            },
        });
        if (!res.ok) {
            console.warn(`⚠️ HTTP ${res.status} for ${url}`);
            return;
        }
        const fileStream = fs.createWriteStream(dest);
        await finished(Readable.fromWeb(res.body as any).pipe(fileStream));
        console.log(`✅ Saved: ${path.basename(dest)} (${fs.statSync(dest).size} bytes)`);
    } catch (e: any) {
        console.error(`❌ Error downloading ${url}:`, e.message);
    }
}

async function main() {
    const baseDir = path.join(process.cwd(), "public/images/guides");
    for (const item of ASSETS_TO_DOWNLOAD) {
        const targetDir = path.join(baseDir, item.dir);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        const dest = path.join(targetDir, item.filename);
        await downloadFile(item.url, dest);
    }
    console.log("✨ All guide images downloaded!");
}

main().catch(console.error);
