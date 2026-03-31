const fs = require('fs');
const content = fs.readFileSync('A:/SigilOS/Tougli_HTML/Dofus Argenté.html', 'utf8');
const links = content.match(/href="[^"]+"/g);
if (links) {
    console.log(`Found ${links.length} total links.`);
    links.slice(0, 50).forEach(l => console.log(l));
} else {
    console.log('No links found.');
}
