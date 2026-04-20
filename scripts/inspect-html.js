const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('duffus_bounties.html', 'utf8');
const $ = cheerio.load(html);

// High-level search for anything that looks like a bounty card
$('div, a').each((i, el) => {
    const text = $(el).text();
    if (text.includes("Fouduglen")) {
        console.log('--- FOUND Fouduglen in element ---');
        console.log('Tag:', el.tagName);
        console.log('Classes:', $(el).attr('class'));
        console.log('Parent Classes:', $(el).parent().attr('class'));
        // console.log('Outer HTML Snippet:', $(el).prop('outerHTML').substring(0, 500));
    }
});
