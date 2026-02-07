
async function checkTemplate() {
    console.log("Fetching Template 1...");
    try {
        const res = await fetch("https://www.metamob.fr/api/v1/quest-templates/1?limit=3", {
            headers: { "Accept": "application/json" }
        });
        console.log("Status:", res.status);
        const json = await res.json();
        console.log("Full Response:", JSON.stringify(json, null, 2));
    } catch (e) {
        console.error(e);
    }
}

checkTemplate();
