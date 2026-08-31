import fs from "node:fs";
import path from "node:path";

/**
 * Registre des icônes de modules personnalisées
 * Vérifie si une icône personnalisée existe dans public/assets/module-icons/<moduleKey>.webp
 */
export function getCustomModuleIcon(moduleKey: string): string | null {
    try {
        const iconPath = path.join(process.cwd(), "public", "assets", "module-icons", `${moduleKey}.webp`);
        if (fs.existsSync(iconPath)) {
            return `/assets/module-icons/${moduleKey}.webp`;
        }
    } catch {
        // Fallthrough
    }
    return null;
}

export function getAllCustomModuleIcons(): Record<string, string> {
    const icons: Record<string, string> = {};
    try {
        const dir = path.join(process.cwd(), "public", "assets", "module-icons");
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                if (file.endsWith(".webp")) {
                    const key = file.replace(/\.webp$/, "");
                    icons[key] = `/assets/module-icons/${file}`;
                }
            }
        }
    } catch {
        // Fallthrough
    }
    return icons;
}
