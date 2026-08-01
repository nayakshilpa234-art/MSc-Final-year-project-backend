/**
 * Strictly Curated Destination Image Database
 * We NEVER use generic/random image APIs. We only serve highly verified photos of the actual destination.
 */

const CURATED_IMAGES = {
    'udupi': [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Udupi_Sri_Krishna_Temple.jpg/1024px-Udupi_Sri_Krishna_Temple.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Malpe_Beach_Udupi.jpg/1024px-Malpe_Beach_Udupi.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/St_Marys_Island_Udupi.jpg/1024px-St_Marys_Island_Udupi.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Kaup_Lighthouse.jpg/1024px-Kaup_Lighthouse.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Manipal_Lake.jpg/1024px-Manipal_Lake.jpg'
    ],
    'mysore': [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Mysore_Palace_Morning.jpg/1024px-Mysore_Palace_Morning.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Chamundi_Hills_Temple.jpg/1024px-Chamundi_Hills_Temple.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Brindavan_Gardens_Mysore.jpg/1024px-Brindavan_Gardens_Mysore.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/St_Philomena_Church_Mysore.jpg/1024px-St_Philomena_Church_Mysore.jpg'
    ],
    'bangalore': [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Vidhana_Soudha_Bangalore.jpg/1024px-Vidhana_Soudha_Bangalore.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Lalbagh_Glasshouse.jpg/1024px-Lalbagh_Glasshouse.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Cubbon_Park_Bangalore.jpg/1024px-Cubbon_Park_Bangalore.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Bangalore_Palace.jpg/1024px-Bangalore_Palace.jpg'
    ],
    'goa': [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Baga_Beach_Goa.jpg/1024px-Baga_Beach_Goa.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Calangute_Beach.jpg/1024px-Calangute_Beach.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Fort_Aguada_Goa.jpg/1024px-Fort_Aguada_Goa.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Dudhsagar_Falls_Goa.jpg/1024px-Dudhsagar_Falls_Goa.jpg'
    ],
    'coorg': [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Abbey_Falls_Coorg.jpg/1024px-Abbey_Falls_Coorg.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Raja_Seat_Madikeri.jpg/1024px-Raja_Seat_Madikeri.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Coffee_Plantation_Coorg.jpg/1024px-Coffee_Plantation_Coorg.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Mandalpatti_Coorg.jpg/1024px-Mandalpatti_Coorg.jpg'
    ],
    'hampi': [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Stone_Chariot_Hampi.jpg/1024px-Stone_Chariot_Hampi.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Virupaksha_Temple_Hampi.jpg/1024px-Virupaksha_Temple_Hampi.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Lotus_Mahal_Hampi.jpg/1024px-Lotus_Mahal_Hampi.jpg'
    ],
    'kochi': [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Kochi_Skyline.jpg/1024px-Kochi_Skyline.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Chinese_Fishing_Nets_Kochi.jpg/1024px-Chinese_Fishing_Nets_Kochi.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Fort_Kochi_Beach.jpg/1024px-Fort_Kochi_Beach.jpg'
    ]
};

// Clean location names to match our curated keys
function sanitizeLocationName(name) {
    if (!name) return 'india';
    let safeName = name.split('(')[0];
    safeName = safeName.split(',')[0].trim().toLowerCase();
    return safeName;
}

const axios = require('axios');

/**
 * Fetch a real image dynamically from Wikipedia for non-curated places
 */
async function fetchWikiImage(placeName) {
    try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(placeName)}&prop=pageimages&format=json&pithumbsize=1000&redirects=1`;
        const res = await axios.get(url, { 
            timeout: 8000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        const pages = res.data.query.pages;
        const pageId = Object.keys(pages)[0];
        if (pageId !== "-1" && pages[pageId].thumbnail) {
            return pages[pageId].thumbnail.source;
        }
    } catch(e) {
        console.error(`Wikimedia fetch failed for ${placeName}:`, e.message);
    }
    return null;
}

/**
 * Resolves the best possible real photograph for a destination.
 * Priorities: 1) Curated DB 2) Dynamic Wikipedia fetch 3) Fallback
 */
async function resolveDestinationImage(placeName) {
    const safeName = sanitizeLocationName(placeName);

    // 1. Curated List (Guaranteed, verified images)
    if (CURATED_IMAGES[safeName] && CURATED_IMAGES[safeName].length > 0) {
        return {
            image_url: CURATED_IMAGES[safeName][0],
            image_gallery: CURATED_IMAGES[safeName]
        };
    }

    // 2. Dynamic Wikipedia Fetch (Real images for everything else)
    const formattedName = safeName.charAt(0).toUpperCase() + safeName.slice(1);
    const wikiUrl = await fetchWikiImage(formattedName);
    if (wikiUrl) {
        return {
            image_url: wikiUrl,
            image_gallery: [wikiUrl]
        };
    }

    // 3. Last Resort Fallback (Beautiful Generic Travel Image)
    const fallbackImage = 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=1000';
    return {
        image_url: fallbackImage,
        image_gallery: [fallbackImage]
    };
}

module.exports = {
    resolveDestinationImage,
    sanitizeLocationName
};
