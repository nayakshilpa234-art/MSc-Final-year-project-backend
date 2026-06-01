const express = require('express');
const router = express.Router();
const axios = require('axios');

// Get nearby places using Overpass API
router.get('/', async (req, res) => {
    try {
        const { lat, lng, type } = req.query;
        
        if (!lat || !lng || !type) {
            return res.status(400).json({ error: 'lat, lng, and type are required' });
        }
        
        // Map our type to OSM tags
        let tag = '';
        if (type === 'restaurant') tag = 'amenity=restaurant';
        else if (type === 'hospital') tag = 'amenity=hospital';
        else if (type === 'atm') tag = 'amenity=atm';
        else if (type === 'hotel') tag = 'tourism=hotel';
        else if (type === 'police') tag = 'amenity=police';
        else if (type === 'attraction') tag = 'tourism=attraction';
        else tag = `amenity=${type}`; // fallback
        
        // Search within ~5km radius
        const radius = 5000;
        
        const overpassQuery = `
            [out:json];
            node(${tag})(around:${radius},${lat},${lng});
            out 20;
        `;
        
        const response = await axios.post('https://overpass-api.de/api/interpreter', overpassQuery);
        
        const places = response.data.elements.map(el => ({
            id: el.id,
            name: el.tags.name || 'Unnamed place',
            lat: el.lat,
            lng: el.lon,
            distance: calculateDistance(lat, lng, el.lat, el.lon),
            type
        })).sort((a, b) => a.distance - b.distance);
        
        res.json(places);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1); // returned in km
}

module.exports = router;
