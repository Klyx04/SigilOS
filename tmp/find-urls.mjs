import fs from 'fs';
import path from 'path';

function findUrls(dir) {
    const files = fs.readdirSync(dir);
    const urls = new Set();

    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            findUrls(fullPath).forEach(u => urls.add(u));
        } else if (fullPath.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const matches = content.match(/https:\/\/[a-zA-Z0-9.\-_/]+[a-zA-Z0-9/]/g);
            if (matches) {
                for (const m of matches) urls.add(m);
            }
        }
    }
    return urls;
}

const allUrls = Array.from(findUrls('a:\\SigilOS\\tmp\\ankama-launcher-extracted'));
const result = allUrls.filter(u => u.includes('ankama') || u.includes('zaap') || u.includes('api')).join('\n');
fs.writeFileSync('a:\\SigilOS\\tmp\\urls.txt', result);
