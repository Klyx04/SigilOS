/**
 * parse-tougli.ts
 * Parses Tougli HTML files (Google Sheets exports) to extract quest names per success section.
 * Generates dofus-configs/{slug}.json for each Dofus.
 * 
 * Usage: npx tsx scripts/parse-tougli.ts
 */

import * as fs from "fs";
import * as path from "path";

// ─── Config: mapping of HTML filename → dofus config ─────────────────────────
const TOUGLI_MAP: Array<{
    htmlFile: string;
    slug: string;
    displayName: string;
    color: string;
    dofusItemId?: number; // DofusDB item ID for icon
}> = [
    { htmlFile: "Dofus Argenté.html",             slug: "argent",       displayName: "Dofus Argenté",             color: "#C0C0C0", dofusItemId: 7822 },
    { htmlFile: "Dofus Ebene.html",               slug: "ebene",        displayName: "Dofus Ébène",               color: "#2D1B00", dofusItemId: 7823 },
    { htmlFile: "Dofus Turquoise.html",            slug: "turquoise",    displayName: "Dofus Turquoise",           color: "#00C8C8", dofusItemId: 7824 },
    { htmlFile: "Dofus Emeraude.html",             slug: "emeraude",     displayName: "Dofus Émeraude",            color: "#00A550", dofusItemId: 7825 },
    { htmlFile: "Dofus Ivoire.html",               slug: "ivoire",       displayName: "Dofus Ivoire",              color: "#F5F5DC", dofusItemId: 7826 },
    { htmlFile: "Dofus Pourpre.html",              slug: "pourpre",      displayName: "Dofus Pourpre",             color: "#800020", dofusItemId: 7827 },
    { htmlFile: "Dofus Ocre.html",                 slug: "ocre",         displayName: "Dofus Ocre",                color: "#CC7722", dofusItemId: 7828 },
    { htmlFile: "Dofus Tacheté.html",              slug: "tachete",      displayName: "Dofus Tacheté",             color: "#8B4513", dofusItemId: 7829 },
    { htmlFile: "Dofus Nebuleux.html",             slug: "nebuleux",     displayName: "Dofus Nébuleux",            color: "#483D8B", dofusItemId: 7830 },
    { htmlFile: "Dofus Forgelave.html",            slug: "forgelave",    displayName: "Dofus Forgelave",           color: "#FF4500", dofusItemId: 7831 },
    { htmlFile: "Dofus des Glaçes.html",           slug: "glace",        displayName: "Dofus des Glaces",          color: "#ADD8E6", dofusItemId: 7832 },
    { htmlFile: "Dofus Cauchemar.html",            slug: "cauchemar",    displayName: "Dofus Cauchemar",           color: "#4B0082", dofusItemId: 7833 },
    { htmlFile: "Dofus Sylvestre.html",            slug: "sylvestre",    displayName: "Dofus Sylvestre",           color: "#228B22", dofusItemId: 7834 },
    { htmlFile: "Dofus Cacao.html",                slug: "cacao",        displayName: "Dofus Cacao",               color: "#7B3F00", dofusItemId: 7835 },
    { htmlFile: "Dofus Cawotte.html",              slug: "cawotte",      displayName: "Dofus Cawotte",             color: "#FF6347", dofusItemId: 7836 },
    { htmlFile: "Dofus Abyssal.html",              slug: "abyssal",      displayName: "Dofus Abyssal",             color: "#191970", dofusItemId: 7837 },
    { htmlFile: "Dofus Argenté scintillant.html",  slug: "argent-scint", displayName: "Dofus Argenté Scintillant", color: "#E0E0FF", dofusItemId: 7838 },
    { htmlFile: "Dofawa.html",                     slug: "dofawa",       displayName: "Dofawa",                    color: "#FF69B4", dofusItemId: 7839 },
    { htmlFile: "Dofoozbz.html",                   slug: "dofoozbz",     displayName: "Dofoozbz",                  color: "#32CD32", dofusItemId: 7840 },
    { htmlFile: "Dokille.html",                    slug: "dokille",      displayName: "Dokille",                   color: "#8B0000", dofusItemId: 7841 },
    { htmlFile: "Dokoko.html",                     slug: "dokoko",       displayName: "Dokoko",                    color: "#FFD700", dofusItemId: 7842 },
    { htmlFile: "Dolmanax.html",                   slug: "dolmanax",     displayName: "Dolmanax",                  color: "#D2691E", dofusItemId: 7843 },
    { htmlFile: "Dom de pin.html",                 slug: "dom-de-pin",   displayName: "Dom de Pin",                color: "#006400", dofusItemId: 7844 },
    { htmlFile: "Domakuro.html",                   slug: "domakuro",     displayName: "Domakuro",                  color: "#2F4F4F", dofusItemId: 7845 },
    { htmlFile: "Dorigami.html",                   slug: "dorigami",     displayName: "Dorigami",                  color: "#FF1493", dofusItemId: 7846 },
    { htmlFile: "Dotruche.html",                   slug: "dotruche",     displayName: "Dotruche",                  color: "#DAA520", dofusItemId: 7847 },
    { htmlFile: "Dofus Kaliptus.html",             slug: "kaliptus",     displayName: "Dofus Kaliptus",            color: "#2E8B57", dofusItemId: 7848 },
    { htmlFile: "Dofus Vulbis.html",               slug: "vulbis",       displayName: "Dofus Vulbis",              color: "#9B59B6", dofusItemId: 7849 },
    { htmlFile: "Dofus des Veilleurs.html",        slug: "veilleurs",    displayName: "Dofus des Veilleurs",       color: "#1ABC9C", dofusItemId: 7850 },
];

const TOUGLI_DIR = path.join(__dirname, "..", "Tougli_HTML");
const CONFIGS_DIR = path.join(__dirname, "dofus-configs");

// HTML entity decode helper
function decodeHtml(html: string): string {
    return html
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&\#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

/**
 * Extract quest names from a Tougli HTML file.
 * The Tougli HTML uses Google Sheets export format.
 * Quest links are in <td class="s69"> and <td class="s75"> with <a href="dofuspourlesnoobs.com">Quest Name</a>
 * Section headers are in <td> colspan=31 "Liste des quêtes" ... then "Prérequis"
 */
function extractQuestsFromHtml(htmlContent: string): { mainQuests: string[]; prereqQuests: string[] } {
    const mainQuests: string[] = [];
    const prereqQuests: string[] = [];

    // Find "Liste des quêtes" and "Prérequis" section boundaries
    const listeIdx = htmlContent.indexOf("Liste des qu");
    const prereqIdx = htmlContent.indexOf(">Prérequis<", listeIdx);

    if (listeIdx === -1) {
        console.warn("Could not find 'Liste des quêtes' section");
        // Try to extract all quest links
    }

    // Extract all quest links: <a href="dofuspourlesnoobs.com/...">Quest Name</a>
    // These appear in cells with class s69 or s75
    const questLinkRegex = /<td[^>]*class="s(?:69|75)"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<\/td>/gi;
    let match;
    
    // If we have section boundaries, use them
    if (prereqIdx !== -1 && listeIdx !== -1) {
        const mainSection = htmlContent.substring(listeIdx, prereqIdx);
        const prereqSection = htmlContent.substring(prereqIdx);

        while ((match = questLinkRegex.exec(mainSection)) !== null) {
            const name = decodeHtml(match[1].trim());
            if (name && !mainQuests.includes(name)) mainQuests.push(name);
        }
        questLinkRegex.lastIndex = 0;
        while ((match = questLinkRegex.exec(prereqSection)) !== null) {
            const name = decodeHtml(match[1].trim());
            if (name && !prereqQuests.includes(name)) prereqQuests.push(name);
        }
    } else {
        // No clear structure: dump everything
        while ((match = questLinkRegex.exec(htmlContent)) !== null) {
            const name = decodeHtml(match[1].trim());
            if (name && !mainQuests.includes(name)) mainQuests.push(name);
        }
    }

    return { mainQuests, prereqQuests };
}

/**
 * Group quests by success section.
 * In Tougli HTML, section names appear as large text before the quest list.
 * They're in <td class="s30"> colspan=31 or similar large bold cells.
 */
function extractSuccessSections(htmlContent: string): Array<{ name: string; quests: string[] }> {
    const sections: Array<{ name: string; quests: string[] }> = [];
    
    // Find section headers - these are in bold cells with a title before quest rows
    // Pattern: <td ... colspan="31"...>SECTION NAME</td>
    const sectionHeaderRegex = /<td[^>]*colspan="[234]\d"[^>]*>([\s\S]*?)<\/td>/gi;
    const sectionPositions: Array<{ name: string; idx: number }> = [];
    
    let m;
    while ((m = sectionHeaderRegex.exec(htmlContent)) !== null) {
        if (m[0].includes("<a ")) continue;
        if (m[0].includes("<img ")) continue;
        const rawName = m[1].replace(/<[^>]+>/g, "").trim();
        const name = decodeHtml(rawName);
        if (name && name.length > 2 && name.length < 50 && !name.includes("\n")) {
            sectionPositions.push({ name, idx: m.index });
        }
    }
    
    // For each section, extract quests until the next section
    const questLinkRegex = /<td[^>]*class="s(?:69|75)"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<\/td>/gi;
    
    for (let i = 0; i < sectionPositions.length; i++) {
        const start = sectionPositions[i].idx;
        const end = sectionPositions[i + 1]?.idx ?? htmlContent.length;
        const slice = htmlContent.substring(start, end);
        
        const quests: string[] = [];
        questLinkRegex.lastIndex = 0;
        let qm;
        while ((qm = questLinkRegex.exec(slice)) !== null) {
            const name = decodeHtml(qm[1].trim());
            if (name && !quests.includes(name)) quests.push(name);
        }
        
        if (quests.length > 0) {
            sections.push({ name: sectionPositions[i].name, quests });
        }
    }
    
    // If no sections found, return flat list
    if (sections.length === 0) {
        const { mainQuests } = extractQuestsFromHtml(htmlContent);
        if (mainQuests.length > 0) {
            sections.push({ name: "Quêtes principales", quests: mainQuests });
        }
    }
    
    return sections;
}

async function main() {
    if (!fs.existsSync(CONFIGS_DIR)) {
        fs.mkdirSync(CONFIGS_DIR, { recursive: true });
    }

    for (const entry of TOUGLI_MAP) {
        const htmlPath = path.join(TOUGLI_DIR, entry.htmlFile);
        if (!fs.existsSync(htmlPath)) {
            console.log(`⚠️  Skipping ${entry.htmlFile} (not found)`);
            continue;
        }

        const outputPath = path.join(CONFIGS_DIR, `${entry.slug}.json`);
        if (fs.existsSync(outputPath)) {
            console.log(`✓  ${entry.slug}.json already exists, skipping`);
            continue;
        }

        console.log(`📖 Parsing ${entry.htmlFile}...`);
        const html = fs.readFileSync(htmlPath, "utf-8");
        
        const sections = extractSuccessSections(html);
        console.log(`   Found ${sections.length} sections, ${sections.reduce((a, s) => a + s.quests.length, 0)} quests`);

        const config = {
            slug: entry.slug,
            displayName: entry.displayName,
            color: entry.color,
            dofusItemId: entry.dofusItemId,
            successes: sections.map(s => ({
                name: s.name,
                zone: "unknown", // will be enriched by compiler via DofusDB
                quests: s.quests,
            })),
        };

        fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), "utf-8");
        console.log(`   ✅ Written to ${entry.slug}.json`);
    }
    
    console.log("\n🎉 Parsing complete!");
}

main().catch(console.error);
