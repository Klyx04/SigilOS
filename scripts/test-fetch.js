const axios = require('axios');

async function testFetch() {
    try {
        const response = await axios.get('https://duffus.fr/avis-de-recherche', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        console.log(response.data.substring(0, 5000));
    } catch (error) {
        console.error('Fetch failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data Sample:', String(error.response.data).substring(0, 1000));
        }
    }
}

testFetch();
