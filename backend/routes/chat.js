const express = require('express');
const router = express.Router();
const axios = require('axios');
const Destination = require('../models/Destination');

// Smart keyword-based NLP logic with expanded detection
function getKeywords(msg) {
    const text = msg.toLowerCase();
    const categories = ['beach', 'mountain', 'historical', 'cultural', 'adventure', 'religious', 'wildlife'];
    let foundCategory = categories.find(c => text.includes(c));
    // Also detect plural/alternate forms
    if (!foundCategory && text.includes('beaches')) foundCategory = 'beach';
    if (!foundCategory && text.includes('mountains')) foundCategory = 'mountain';
    if (!foundCategory && text.includes('temple')) foundCategory = 'religious';
    if (!foundCategory && text.includes('church')) foundCategory = 'religious';
    if (!foundCategory && text.includes('fort')) foundCategory = 'historical';
    if (!foundCategory && text.includes('palace')) foundCategory = 'historical';
    if (!foundCategory && text.includes('trek')) foundCategory = 'adventure';
    if (!foundCategory && text.includes('safari')) foundCategory = 'wildlife';
    
    let intent = 'unknown';

    if (text.match(/\b(recommend|places|where to go|tourist|explore|visit|show|suggest|best|top|famous|popular|destination)\b/)) {
        intent = 'recommendation';
    } else if (text.match(/\b(book|reserve|booking)\b/)) {
        intent = 'booking';
    } else if (text.match(/\b(hi|hello|hey|greetings)\b/)) {
        intent = 'greeting';
    } else if (text.includes('thank')) {
        intent = 'thanks';
    } else if (text.match(/\b(bye|goodbye|see ya)\b/)) {
        intent = 'bye';
    } else if (text.includes('trips') || text.includes('packages') || text.includes('table')) {
        intent = 'trips';
    } else if (text.match(/\b(day|days|week|itinerary|plan|budget)\b/) && text.match(/\b(trip|tour|travel)\b/)) {
        intent = 'recommendation';
    }

    // If a category was found but no intent was matched, assume recommendation
    if (foundCategory && intent === 'unknown') intent = 'recommendation';

    console.log(`Debug getKeywords -> text: "${text}", intent: "${intent}", category: "${foundCategory || 'none'}"`);
    return { intent, category: foundCategory, text };
}

// Make sure to install: npm install @google/generative-ai
const { GoogleGenerativeAI } = require('@google/generative-ai');

router.post('/', async (req, res) => {
    const { message, history } = req.body;
    
    // Check if Gemini API is configured
    if (process.env.GEMINI_API_KEY) {
        try {
            console.log("Using Google Generative AI SDK for request...");
            
            let languageContext = "en";
            let communityPlacesContext = "No community places available.";
            let memoryContext = "No memory context.";
            
            const authHeader = req.header('Authorization');
            if (authHeader) {
                const token = authHeader.replace('Bearer ', '');
                if (token && token !== 'null') {
                    try {
                        const jwt = require('jsonwebtoken');
                        const decoded = jwt.verify(token, process.env.JWT_SECRET);
                        let userId = decoded.user.id;
                        const UserPreferences = require('../models/UserPreferences');
                        const prefs = await UserPreferences.findOne({ userId });
                        if (prefs) {
                            languageContext = prefs.preferredLanguage || "en";
                            memoryContext = `USER MEMORY CONTEXT:
- Favorite Destinations: ${(prefs.favoriteDestinations || []).join(', ')}
- Budget Preference: ${prefs.budgetPreference}
- Travel Style: ${(prefs.travelStyle || []).join(', ')}
- Dietary Preference: ${prefs.dietaryPreference}
- Previous Trips: ${(prefs.previousTrips || []).map(t => t.destination).join(', ')}
If the user doesn't specify details, default to these preferences. Acknowledge them if relevant.`;
                        } else {
                            memoryContext = "User is new. Pay attention to preferences to store them.";
                        }
                    } catch(e) { console.log('Invalid token in chat', e.message); }
                }
            }
            
            try {
                const CommunityPlace = require('../models/CommunityPlace');
                const places = await CommunityPlace.find({ isApproved: true }).limit(5);
                if (places.length > 0) {
                    communityPlacesContext = "COMMUNITY HIDDEN GEMS:\n" + places.map(p => `- ${p.placeName} (${p.category}): ${p.description}`).join('\n');
                }
            } catch(e) { console.log('Failed to fetch community places', e.message); }
            
            const systemPrompt = `You are an intelligent, conversational AI travel companion.
You must deeply understand the user's intent and extract specific constraints from their message.

${memoryContext}

MOOD DETECTION:
If the user expresses emotions (e.g., bored, stressed, adventurous), suggest mood-appropriate destinations and set action to "MOOD_SUGGESTION".

ITINERARY GENERATION:
If the user asks for a trip plan or itinerary, generate a structured day-by-day plan with timings, places, and costs. Set action to "GENERATE_ITINERARY".

HIDDEN GEMS:
${communityPlacesContext}
Include these in recommendations if relevant. Set action to "HIDDEN_GEMS" if you are specifically recommending these.

COMPANION MODE:
If the user asks for nearby places (restaurants, hotels, hospitals, ATMs), set action to "NEARBY_PLACES".

SAFETY INFO:
If the user asks for safety, emergency contacts, or weather warnings, set action to "SAFETY_INFO".

LANGUAGE:
Respond in the language specified by code: "${languageContext}" (en=English, hi=Hindi, kn=Kannada).

If the user asks for a standard recommendation or trip plan, generate complete travel recommendation cards.
Customize the budgets, itineraries, and hotels strictly based on the extracted constraints.

Categories MUST be one of: beach, mountain, historical, cultural, adventure, religious, wildlife.

Respond strictly in JSON format ONLY, without markdown backticks. 
Format MUST exactly match this structure (include travel_cards, itinerary, mood_cards, hidden_gems as arrays when relevant based on the action):
{
  "reply": "Your conversational reply acknowledging their constraints.",
  "action": "RECOMMENDATION", // Or MOOD_SUGGESTION, GENERATE_ITINERARY, NEARBY_PLACES, HIDDEN_GEMS, SAFETY_INFO
  "extracted_constraints": {
    "destination": "Goa",
    "budget": 15000,
    "days": 5,
    "interests": ["beach", "party"],
    "transport": "train",
    "hotel": "cheap"
  },
  "memory_updates": {
    "favoriteDestinations": ["Goa"],
    "budgetPreference": "mid-range",
    "travelStyle": ["beach", "party"],
    "dietaryPreference": "both",
    "mood": "happy"
  },
  "travel_cards": [
    {
      "place_name": "Goa",
      "location": "Goa, India",
      "category": "beach",
      "rating": "4.8",
      "reviews": "12.4k reviews",
      "description": "Custom description matching their interests.",
      "image_url": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=1000",
      "image_gallery": [
        "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2",
        "https://images.unsplash.com/photo-1542401886-65d6c61db217"
      ],
      "map_url": "https://maps.google.com/?q=Goa",
      "best_time": "Nov - Feb",
      "entry_fee": "Varies",
      "tags": ["Beach", "Budget"],
      "weather": {
        "temperature": "28°C",
        "condition": "Sunny"
      },
      "budgets": {
        "5_days": "₹14000"
      },
      "estimated_costs": {
        "low_budget": {
          "hotel": 1200,
          "food": 500,
          "transport": 800,
          "activities": 200,
          "taxes": 486,
          "total": 3186
        },
        "high_budget": {
          "hotel": 8000,
          "food": 2000,
          "transport": 3500,
          "activities": 1500,
          "taxes": 2700,
          "total": 17700
        }
      },
      "packing_list": ["Sunscreen", "Swimwear"],
      "itinerary": [
        {
          "day": 1,
          "title": "Arrival",
          "activities": ["Check-in to budget hotel", "Beach walk"]
        }
      ],
      "hotels": [
        {
          "name": "Budget Inn Goa",
          "type": "budget",
          "price_per_night": 1200,
          "food_cost": 400,
          "room_type": "Standard Double",
          "amenities": ["Free WiFi", "AC", "Pool"],
          "nearby_attractions": ["Baga Beach"],
          "rating": 4.2,
          "reviews_count": 120,
          "image_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1000"
        },
        {
          "name": "Luxury Beach Resort",
          "type": "luxury",
          "price_per_night": 8000,
          "food_cost": 1500,
          "room_type": "Ocean View Suite",
          "amenities": ["Spa", "Private Beach", "Gym", "Breakfast Included"],
          "nearby_attractions": ["Aguada Fort"],
          "rating": 4.9,
          "reviews_count": 850,
          "image_url": "https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=1000"
        }
      ],
      "foods": ["Street Seafood", "Local Thali"],
      "nearby_attractions": ["Baga Beach", "Anjuna Flea Market"],
      "transport_options": ["Overnight Train", "Budget Bus"]
    }
  ]
}`;

            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
            
            // DYNAMIC MODEL SELECTION: 
            // Ask Google precisely which models this specific API key is authorized to use!
            let targetModel = "gemini-1.5-flash"; // fallback default
            try {
                const rawModelData = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY.trim()}`);
                const modelJson = await rawModelData.json();
                if (modelJson.models) {
                    const validModels = modelJson.models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"));
                    if (validModels.length > 0) {
                        targetModel = validModels[0].name.replace('models/', '');
                    }
                }
            } catch(e) {
                console.log("Could not dynamically resolve models. Using default.");
            }
            
            console.log(`Auto-resolved Google Model binding to: ${targetModel}`);
            const model = genAI.getGenerativeModel({ model: targetModel });

            const fullMessage = `${systemPrompt}\n\nCHAT HISTORY:\n${history || 'No previous history.'}\n\nUSER MESSAGE:\n${message}`;
            const result = await model.generateContent(fullMessage);
            
            let rawText = result.response.text();
            
            if (rawText) {
                rawText = rawText.trim();
                // Strip markdown backticks if Gemini accidentally includes them
                if (rawText.startsWith('```json')) rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
                else if (rawText.startsWith('```')) rawText = rawText.replace(/```/g, '').trim();
                
                let aiResult = { reply: rawText, action: "NONE", destinationName: null };
                try {
                    aiResult = JSON.parse(rawText);
                    
                    if (userId && aiResult.memory_updates) {
                        const UserPreferences = require('../models/UserPreferences');
                        let prefs = await UserPreferences.findOne({ userId });
                        if (!prefs) {
                            prefs = new UserPreferences({ userId });
                        }
                        const updates = aiResult.memory_updates;
                        if (updates.favoriteDestinations && Array.isArray(updates.favoriteDestinations) && updates.favoriteDestinations.length) {
                            prefs.favoriteDestinations = [...new Set([...prefs.favoriteDestinations, ...updates.favoriteDestinations])];
                        }
                        if (updates.budgetPreference) prefs.budgetPreference = updates.budgetPreference;
                        if (updates.travelStyle && Array.isArray(updates.travelStyle) && updates.travelStyle.length) {
                            prefs.travelStyle = [...new Set([...prefs.travelStyle, ...updates.travelStyle])];
                        }
                        if (updates.dietaryPreference) prefs.dietaryPreference = updates.dietaryPreference;
                        if (updates.mood) {
                            prefs.moodHistory.push({ mood: updates.mood, date: new Date() });
                        }
                        
                        await prefs.save();
                    }
                    
                    // GUARANTEE FAST & ACCURATE IMAGES
                    if (aiResult.travel_cards && Array.isArray(aiResult.travel_cards)) {
                        aiResult.travel_cards = aiResult.travel_cards.map((card, i) => {
                            // Extract just the first word of the destination (e.g. "Paris, France" -> "paris")
                            const safeWord = card.place_name ? encodeURIComponent(card.place_name.split(/[\s,]+/)[0].toLowerCase()) : "travel";
                            
                            // Force valid fast image
                            card.image_url = `https://loremflickr.com/1000/600/${safeWord},landmark/all?lock=${i + 10}`;
                            
                            // Force valid accurate image gallery
                            card.image_gallery = [
                                `https://loremflickr.com/800/600/${safeWord},city/all?lock=${i + 1}`,
                                `https://loremflickr.com/800/600/${safeWord},architecture/all?lock=${i + 2}`,
                                `https://loremflickr.com/800/600/${safeWord},nature/all?lock=${i + 3}`
                            ];
                            return card;
                        });
                    }

                } catch (parseErr) {
                    console.log("Gemini did not return valid JSON. Falling back to raw text:", parseErr.message);
                }
                
                let destination = null;
                let liveWeatherString = "";

                if (aiResult.action === 'START_BOOKING' && aiResult.destinationName) {
                    // Try to find it in the database first
                    destination = await Destination.findOne({ name: { $regex: new RegExp(`^${aiResult.destinationName}$`, 'i') } });
                    
                    if (!destination) {
                        console.log(`Global AI generated a new location: ${aiResult.destinationName}. Creating database entry...`);
                        destination = new Destination({
                            name: aiResult.destinationName,
                            location: aiResult.destinationLocation || "Global Destination",
                            category: ["beach", "mountain", "historical"].includes(aiResult.destinationCategory) ? aiResult.destinationCategory : "historical",
                            description: aiResult.destinationDescription || "A beautiful location discovered by AI.",
                            price: aiResult.destinationPrice || 500,
                            imageUrl: "https://images.unsplash.com/photo-1488085061387-422e29b40080?q=80&w=1000&auto=format&fit=crop"
                        });
                        await destination.save();
                    }

                    // FETCH LIVE WEATHER DATA DYNAMICALLY WITHOUT API KEYS!
                    try {
                        console.log(`Fetching live weather for ${aiResult.destinationName}...`);
                        const weatherRes = await fetch(`https://wttr.in/${encodeURIComponent(aiResult.destinationName)}?format=j1`);
                        const weatherData = await weatherRes.json();
                        
                        const tempC = weatherData.current_condition[0].temp_C;
                        const condition = weatherData.current_condition[0].weatherDesc[0].value;
                        
                        liveWeatherString = `\n\n🌤️ *Live Real-Time Weather in ${aiResult.destinationName}:* ${tempC}°C and ${condition}!`;
                    } catch(e) {
                        console.log("Could not ping weather API.", e.message);
                    }
                }
                
                const finalAiReply = (aiResult.reply || rawText) + liveWeatherString;

                return res.json({
                    reply: finalAiReply,
                    action: aiResult.action,
                    travel_cards: aiResult.travel_cards || []
                });
            }
        } catch (err) {
            console.error("Gemini failed, falling back to basic...");
            if (err.status) console.error(`[Gemini Error Status]: ${err.status} - ${err.statusText}`);
            if (err.message) console.error(`[Gemini Error Message]: ${err.message}`);
            // Log any deeper underlying axios/REST errors that the SDK swallows
            console.error("FULL RAW ERROR:", JSON.stringify(err, null, 2));
        }
    }

    // --- FALLBACK LOGIC IF NO GEMINI KEY ---
    const { intent, category, text } = getKeywords(message);

    try {
        if (intent === 'greeting') {
            const places = await Destination.find().limit(2);
            let replyText = 'Hi there! 👋 I am your friendly AI Tourist Assistant. I can help you plan your perfect trip! ';
            if (places.length > 0) {
                const sugg = places.map(p => p.name).join(' and ');
                replyText += `Did you know we have beautiful places like ${sugg}? You can ask me to book them, or ask for recommendations by category (beach, mountain, historical)!`;
            } else {
                replyText += `You can ask me to recommend beach, mountain, or historical destinations!`;
            }
            return res.json({ reply: replyText });
        }

        if (intent === 'thanks') {
            return res.json({ reply: 'You are very welcome! 😊 Let me know if you need anything else or want to explore another destination.' });
        }

        if (intent === 'trips') {
            return res.json({ 
                reply: 'Sure! Here are some of our popular trip packages you can add to your cart:',
                action: 'SHOW_TRIPS' 
            });
        }

        if (intent === 'bye') {
            return res.json({ reply: 'Goodbye! Safe travels, and I hope to help you plan another trip soon! ✈️' });
        }

        if (intent === 'booking') {
            const places = await Destination.find();
            let matchedPlace = places.find(p => text.includes(p.name.toLowerCase()));

            if (matchedPlace) {
                return res.json({
                    reply: `Great! You want to book ${matchedPlace.name}. Please enter your details (name, email, travel date, number of people) in the booking form.`,
                    action: 'START_BOOKING',
                    destination: matchedPlace
                });
            } else {
                return res.json({ reply: 'Which place would you like to book? Please provide the name of the destination.' });
            }
        }

        if (intent === 'recommendation' || category) {
            let query = {};
            if (category) query.category = category;

            const places = await Destination.find(query);
            if (places.length === 0) {
                return res.json({ reply: `I couldn't find any places matching your request.` });
            }

            let replyText = `Here are some recommendations`;
            if (category) replyText += ` for ${category} lovers`;
            replyText += `:\n\n`;

            const placesList = places.map((p, i) => `${i + 1}. ${p.name} (${p.location}) - ₹${p.price.toLocaleString()}\n   ${p.description}`).join('\n\n');
            const followUp = '\n\nIf you want to book one of these, try saying "Book [place name]".';

            return res.json({ reply: replyText + placesList + followUp, data: places });
        }

        // SMART FALLBACK: Try fuzzy database search before giving up
        const words = text.split(/\s+/).filter(w => w.length > 2);
        let fuzzyResults = [];
        for (const word of words) {
            const found = await Destination.find({ 
                $or: [
                    { name: { $regex: word, $options: 'i' } },
                    { location: { $regex: word, $options: 'i' } },
                    { description: { $regex: word, $options: 'i' } },
                    { category: { $regex: word, $options: 'i' } }
                ]
            });
            fuzzyResults.push(...found);
        }
        // Deduplicate by _id
        const seen = new Set();
        fuzzyResults = fuzzyResults.filter(d => {
            if (seen.has(d._id.toString())) return false;
            seen.add(d._id.toString());
            return true;
        });

        if (fuzzyResults.length > 0) {
            let replyText = `I found ${fuzzyResults.length} destination(s) matching "${message}":\n\n`;
            const placesList = fuzzyResults.map((p, i) => `${i + 1}. ${p.name} (${p.location}) - ₹${p.price.toLocaleString()}\n   ${p.description}`).join('\n\n');
            replyText += placesList + '\n\nWant to book one? Say "Book [place name]" or ask for more details!';
            return res.json({ reply: replyText, data: fuzzyResults });
        }

        return res.json({ reply: `I don't have "${message}" in my local database yet, but I can help! Try asking:\n• "Recommend beach places"\n• "Show me mountain destinations"\n• "Book Taj Mahal"\n• "Show trips"\n\nOr ask about any tourist place and I'll find it for you!` });

    } catch (err) {
        res.status(500).json({ reply: 'Oops! Something went wrong on my end.' });
    }
});

// GET /api/chat/history - Retrieve user's persisted chat history
const auth = require('../middleware/auth');
const User = require('../models/User');

router.get('/history', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });
        res.json({ chatHistory: user.chatHistory || [] });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// POST /api/chat/history - Save user's updated chat history
router.post('/history', auth, async (req, res) => {
    try {
        const { chatHistory } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });
        
        user.chatHistory = chatHistory || [];
        await user.save();
        res.json({ msg: 'Chat history updated successfully', chatHistory: user.chatHistory });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Saved Chats endpoints
const Chat = require('../models/Chat');
const Message = require('../models/Message');

router.post('/new', auth, async (req, res) => {
    try {
        const newChat = new Chat({
            userId: req.user.id,
            title: 'New Conversation'
        });
        await newChat.save();
        res.json(newChat);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.get('/history/:userId', auth, async (req, res) => {
    try {
        const chats = await Chat.find({ userId: req.params.userId, isDeleted: { $ne: true } }).sort({ updatedAt: -1 });
        res.json(chats);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.get('/:chatId', auth, async (req, res) => {
    try {
        const chat = await Chat.findOne({ _id: req.params.chatId, isDeleted: { $ne: true } });
        if (!chat) return res.status(404).json({ msg: 'Chat not found' });
        const messages = await Message.find({ chatId: req.params.chatId }).sort({ timestamp: 1 });
        res.json({ chat, messages });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/message', auth, async (req, res) => {
    try {
        const { chatId, sender, message, data, options, step } = req.body;
        
        let chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ msg: 'Chat not found' });

        const newMessage = new Message({
            chatId,
            sender,
            message,
            data: data || [],
            options: options || [],
            step: step || ''
        });
        await newMessage.save();

        if (sender === 'user' && chat.title === 'New Conversation') {
            const words = message.split(' ');
            let title = words.slice(0, 4).join(' ');
            if (words.length > 4) title += '...';
            chat.title = title;
        }

        chat.updatedAt = new Date();
        await chat.save();

        res.json(newMessage);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.put('/rename/:chatId', auth, async (req, res) => {
    try {
        const { title } = req.body;
        const chat = await Chat.findById(req.params.chatId);
        if (!chat) return res.status(404).json({ msg: 'Chat not found' });
        
        chat.title = title;
        await chat.save();
        res.json(chat);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.delete('/:chatId', auth, async (req, res) => {
    try {
        const chat = await Chat.findById(req.params.chatId);
        if (!chat) return res.status(404).json({ msg: 'Chat not found' });

        chat.isDeleted = true;
        await chat.save();
        res.json({ msg: 'Chat deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
