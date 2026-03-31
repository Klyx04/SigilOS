const fs = require('fs');
const content = fs.readFileSync('A:/SigilOS/Tougli_HTML/Dofus Argenté.html', 'utf8');
console.log(content.substring(0, 100000));
