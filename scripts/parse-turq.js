const cheerio = require('cheerio');
const fetch = require('node-fetch');

async function run() {
  const html = await fetch('https://www.dofuspourlesnoobs.com/quecirctes-du-dofus-turquoise.html').then(r=>r.text());
  const $ = cheerio.load(html);
  const res = [];
  $('ul li, div, p').each((i, el) => {
    const t = $(el).text();
    if (t.includes(' x ') || t.match(/^\d+\s*x\s+/)) {
       res.push(t.trim());
    }
  });
  console.log('Ingrédients trouvés:', res.filter(r => r.length < 100));
}
run();
