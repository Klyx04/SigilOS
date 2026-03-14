/**
 * Test des entêtes CORS de l'API Dofusbook
 */
async function testCORS() {
    const url = "https://www.dofusbook.net/api/stuffs/dofus/public/16093854";
    
    // On simule une requête venant de SigilOS
    const res = await fetch(url, {
        method: "OPTIONS",
        headers: {
            "Origin": "https://sigilos.fr",
            "Access-Control-Request-Method": "GET"
        }
    });

    console.log("CORS Status:", res.status);
    console.log("Access-Control-Allow-Origin:", res.headers.get("access-control-allow-origin"));
    console.log("Access-Control-Allow-Methods:", res.headers.get("access-control-allow-methods"));
}

testCORS().catch(console.error);
