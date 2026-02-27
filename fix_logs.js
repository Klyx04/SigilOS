const fs = require('fs');

function fixLogs(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Make sure logger is imported if we are using it
    if (!content.includes('import { logger } from "@/lib/logger";') && !content.includes("import { logger }")) {
        // Find the last import
        const lastImportIndex = content.lastIndexOf('import ');
        if (lastImportIndex !== -1) {
            const endOfLastImport = content.indexOf('\n', lastImportIndex);
            content = content.slice(0, endOfLastImport) + '\nimport { logger } from "@/lib/logger";' + content.slice(endOfLastImport);
        } else {
            content = 'import { logger } from "@/lib/logger";\n' + content;
        }
    }

    content = content.replace(/console\.log\((.*?)\);/g, (match, p1) => `logger.info(${p1});`);
    content = content.replace(/console\.warn\((.*?)\);/g, (match, p1) => `logger.warn(${p1});`);
    content = content.replace(/console\.error\((.*?)\);/g, (match, p1) => {
        // Only split by first comma safely (simple heuristic)
        let firstComma = p1.indexOf(',');
        if (firstComma !== -1) {
            let msg = p1.substring(0, firstComma).trim();
            let err = p1.substring(firstComma + 1).trim();
            return `logger.error(${msg}, { error: ${err} });`;
        }
        return `logger.error(${p1});`;
    });

    fs.writeFileSync(filePath, content, 'utf8');
}

fixLogs('a:/SigilOS/src/server/actions/profile-actions.ts');
fixLogs('a:/SigilOS/src/server/actions/user-actions.ts');
