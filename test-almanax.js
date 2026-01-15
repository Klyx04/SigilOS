async function main() {
    const query = "abraknyde";
    const url = `https://api.dofusdu.de/dofus2/fr/sets/search?query=${query}&limit=1`;

    console.log(`Testing: ${url}`);
    try {
        const res = await fetch(url);
        console.log(`Status: ${res.status}`);
        if (res.ok) {
            const data = await res.json();
            const item = data[0] || data;
            console.log("Full Set Structure:", JSON.stringify(item, null, 2));
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}
main();
