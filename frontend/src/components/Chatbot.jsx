import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, MapPin, IndianRupee, Info, Mic, MicOff, Plus, Trash2, Edit3, Search, MessageSquare, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import TripTable from './TripTable';
import TransportCards from './TransportCards';
import SeatSelector from './SeatSelector';
import AddonsSelector from './AddonsSelector';
import ReviewsSection from './ReviewsSection';

const Chatbot = ({ addToCart }) => {
    const [messages, setMessages] = useState([
        { text: "Hi! I'm your AI Tourist Assistant. Looking for a beach, mountain, or historical destination? Or do you want to book a trip?", sender: 'bot' }
    ]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [bookingForm, setBookingForm] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', travelDate: '', numberOfPeople: 1, fromCity: 'Bangalore' });
    const messagesEndRef = useRef(null);
    const [topBeach, setTopBeach] = useState(null);
    const [pendingBookings, setPendingBookings] = useState([]);
    const [allDestinations, setAllDestinations] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [postBookingFlow, setPostBookingFlow] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [detailPage, setDetailPage] = useState(null);
    const [currentUser, setCurrentUser] = useState(localStorage.getItem('username') || 'guest');
    const [expandedHotel, setExpandedHotel] = useState(null);
    const [realtimeData, setRealtimeData] = useState(null);
    const [originCity, setOriginCity] = useState('');
    const [routeData, setRouteData] = useState(null);

    const exportToPDF = async (elementId, filename) => {
        const element = document.getElementById(elementId);
        if (!element) return;
        try {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${filename}.pdf`);
        } catch (error) {
            console.error('Error generating PDF', error);
        }
    };

    useEffect(() => {
        if (detailPage) {
            setRealtimeData(null);
            setRouteData(null);
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(detailPage.place_name)}&limit=1`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.length > 0) {
                        const { lat, lon } = data[0];
                        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
                            .then(res => res.json())
                            .then(weatherData => {
                                setRealtimeData({
                                    lat, lon,
                                    temp: weatherData.current_weather.temperature,
                                    wind: weatherData.current_weather.windspeed,
                                    code: weatherData.current_weather.weathercode
                                });
                            });
                    }
                }).catch(e => console.log('Realtime fetch error', e));
        }
    }, [detailPage]);

    const calculateDistance = async () => {
        if (!originCity || !realtimeData) return;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(originCity)}&limit=1`);
            const data = await res.json();
            if (data && data.length > 0) {
                const originLat = data[0].lat;
                const originLon = data[0].lon;
                const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${realtimeData.lon},${realtimeData.lat}?overview=false`);
                const osrmData = await osrmRes.json();
                if (osrmData.routes && osrmData.routes.length > 0) {
                    const distanceKm = (osrmData.routes[0].distance / 1000).toFixed(1);
                    const timeHrs = (osrmData.routes[0].duration / 3600).toFixed(1);
                    setRouteData({ distance: distanceKm, time: timeHrs });
                }
            }
        } catch(e) { console.log('Route fetch error', e); }
    };

    const [chats, setChats] = useState([]);
    const [currentChatId, setCurrentChatId] = useState(null);
    const [chatSearch, setChatSearch] = useState('');
    const [renamingChatId, setRenamingChatId] = useState(null);
    const [renameTitleInput, setRenameTitleInput] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [loadingChats, setLoadingChats] = useState(false);
    const isRestoringChat = useRef(false);
    const prevMessagesLength = useRef(1); // Starts at 1 with the initial greeting

    const currentChatIdRef = useRef(currentChatId);
    useEffect(() => {
        currentChatIdRef.current = currentChatId;
    }, [currentChatId]);

    const isSyncingRef = useRef(false);

    useEffect(() => {
        const syncMessageToDB = async () => {
            const tokenStr = localStorage.getItem('token');
            const username = localStorage.getItem('username') || 'guest';
            if (!tokenStr || username === 'guest' || isRestoringChat.current) {
                prevMessagesLength.current = messages.length;
                return;
            }

            if (messages.length > prevMessagesLength.current) {
                if (isSyncingRef.current) return;
                isSyncingRef.current = true;

                const newMessages = messages.slice(prevMessagesLength.current);
                prevMessagesLength.current = messages.length;
                let activeChatId = currentChatIdRef.current;

                if (!activeChatId) {
                    try {
                        const newChatRes = await axios.post('/api/chat/new', {}, {
                            headers: { Authorization: `Bearer ${tokenStr}` }
                        });
                        activeChatId = newChatRes.data._id;
                        currentChatIdRef.current = activeChatId;
                        setCurrentChatId(activeChatId);
                    } catch (err) {
                        console.error("Failed to auto-create chat", err);
                        isSyncingRef.current = false;
                        return;
                    }
                }

                for (const newMsg of newMessages) {
                    try {
                        await axios.post('/api/chat/message', {
                            chatId: activeChatId,
                            sender: newMsg.sender,
                            message: newMsg.text,
                            data: newMsg.data || [],
                            options: newMsg.options || [],
                            step: newMsg.step || ''
                        }, {
                            headers: { Authorization: `Bearer ${tokenStr}` }
                        });
                    } catch (err) {
                        console.error("Failed to save message to DB", err);
                    }
                }
                loadChatHistory();
                isSyncingRef.current = false;
            } else {
                prevMessagesLength.current = messages.length;
            }
        };

        syncMessageToDB();
    }, [messages]);

    const getUserIdFromToken = () => {
        const token = localStorage.getItem('token');
        if (!token) return '';
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const decoded = JSON.parse(jsonPayload);
            return decoded.user.id;
        } catch (e) {
            console.error("Token decode error", e);
            return '';
        }
    };

    const loadChatHistory = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        setLoadingChats(true);
        try {
            const userId = getUserIdFromToken();
            if (userId) {
                const res = await axios.get(`/api/chat/history/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setChats(res.data);
                // Auto load most recent chat on mount if not currently in a chat
                if (res.data.length > 0 && !currentChatId) {
                    openChat(res.data[0]._id);
                }
            }
        } catch (err) {
            console.error("Failed to load chat history", err);
        } finally {
            setLoadingChats(false);
        }
    };

    const openChat = async (chatId) => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            isRestoringChat.current = true;
            const res = await axios.get(`/api/chat/${chatId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCurrentChatId(chatId);
            const mappedMessages = res.data.messages.map(m => ({
                text: m.message,
                sender: m.sender,
                data: m.data,
                options: m.options,
                step: m.step
            }));
            const finalMsgs = mappedMessages.length > 0 ? mappedMessages : [{ text: "👋 Hello! I am your AI Tourist Companion. Ask me to plan a beach trip, recommend places, suggest transport, or book hotels!", sender: "bot" }];
            setMessages(finalMsgs);
            prevMessagesLength.current = finalMsgs.length;
            setTimeout(() => {
                isRestoringChat.current = false;
            }, 100);
        } catch (err) {
            console.error("Failed to open chat", err);
            isRestoringChat.current = false;
        }
    };

    const startNewChat = () => {
        isRestoringChat.current = true;
        setCurrentChatId(null);
        const newGreeting = [{ text: "👋 Hello! I am your AI Tourist Companion. Ask me to plan a beach trip, recommend places, suggest transport, or book hotels!", sender: "bot" }];
        setMessages(newGreeting);
        setPostBookingFlow(null);
        setBookingForm(null);
        prevMessagesLength.current = newGreeting.length;
        setTimeout(() => {
            isRestoringChat.current = false;
        }, 100);
    };

    const renameChat = async (chatId) => {
        if (!renameTitleInput.trim()) return;
        const token = localStorage.getItem('token');
        try {
            await axios.put(`/api/chat/rename/${chatId}`, { title: renameTitleInput }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRenamingChatId(null);
            setRenameTitleInput('');
            loadChatHistory();
        } catch (err) {
            console.error("Failed to rename chat", err);
        }
    };

    const deleteChat = async (chatId) => {
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`/api/chat/${chatId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (currentChatId === chatId) {
                startNewChat();
            }
            setDeleteConfirmId(null);
            loadChatHistory();
        } catch (err) {
            console.error("Failed to delete chat", err);
        }
    };

    useEffect(() => {
        loadChatHistory();
    }, [currentUser]);

    // Dynamic Auth & Persisted History synchronization
    useEffect(() => {
        const handleAuth = async () => {
            const newUser = localStorage.getItem('username') || 'guest';
            setCurrentUser(newUser);
            
            const token = localStorage.getItem('token');
            if (token && newUser !== 'guest') {
                loadChatHistory();
                return;
            }
            
            // Fallback to local storage (e.g. for guest or if offline)
            const saved = localStorage.getItem(`chatHistory_${newUser}`);
            if (saved) {
                setMessages(JSON.parse(saved));
            } else {
                setMessages([
                    { text: "Hi! I'm your AI Tourist Assistant. Looking for a beach, mountain, or historical destination? Or do you want to book a trip?", sender: 'bot' }
                ]);
            }
        };

        handleAuth();
        window.addEventListener('authChange', handleAuth);
        return () => window.removeEventListener('authChange', handleAuth);
    }, []);

    const toggleListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Your browser does not support Voice Recognition. Please try Google Chrome.");
            return;
        }

        if (isListening) {
            setIsListening(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.continuous = false; // Stop exactly when they pause

        recognition.onstart = () => setIsListening(true);
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setInput(prev => prev + " " + transcript); // Append beautifully
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
        };

        try {
            recognition.start();
        } catch(e) {
            setIsListening(false);
        }
    };

    // Keep LocalStorage synchronized on message changes for guests
    useEffect(() => {
        const username = localStorage.getItem('username') || 'guest';
        if (username === 'guest') {
            localStorage.setItem(`chatHistory_${username}`, JSON.stringify(messages));
        }
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, bookingForm]);

    useEffect(() => {
        axios.get('/api/destinations').then(res => {
            setAllDestinations(res.data);
            const beaches = res.data.filter(d => d.category === 'beach');
            if (beaches.length > 0) setTopBeach(beaches[0]);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (pendingBookings.length === 0) return;

        const interval = setInterval(async () => {
            const stillPending = [];
            let statusChanged = false;
            for (let id of pendingBookings) {
                try {
                    const res = await axios.get(`/api/bookings/${id}/status`);
                    if (res.data.status === 'Confirmed') {
                        setMessages(prev => [...prev, { text: `🎉 Great news! Your booking for ${res.data.destination.name} has just been Confirmed by the Admin!`, sender: 'bot' }]);
                        statusChanged = true;
                    } else if (res.data.status === 'Cancelled' || res.data.status === 'Rejected') {
                        setMessages(prev => [...prev, { text: `❌ We're sorry, your booking for ${res.data.destination.name} was cancelled/rejected by the admin. Please contact support.`, sender: 'bot' }]);
                        statusChanged = true;
                    } else {
                        stillPending.push(id);
                    }
                } catch {
                    stillPending.push(id);
                }
            }
            if (statusChanged) {
                setPendingBookings(stillPending);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [pendingBookings]);

    useEffect(() => {
        // DYNAMIC ENVIRONMENT THEMES
        if (detailPage && detailPage.category) {
            const cat = detailPage.category.toLowerCase();
            if (cat === 'beach') document.body.style.background = 'radial-gradient(circle at top right, #0ea5e9, #0f172a, #020617)';
            else if (cat === 'mountain') document.body.style.background = 'radial-gradient(circle at top right, #94a3b8, #1e293b, #020617)';
            else if (cat === 'historical' || cat === 'cultural') document.body.style.background = 'radial-gradient(circle at top right, #d97706, #331500, #020617)';
            else if (cat === 'wildlife' || cat === 'nature') document.body.style.background = 'radial-gradient(circle at top right, #16a34a, #064e3b, #020617)';
            else document.body.style.background = 'radial-gradient(circle at top right, #1e1b4b, #0f172a, #020617)';
        } else {
            document.body.style.background = 'radial-gradient(circle at top right, #1e1b4b, #0f172a, #020617)';
        }
    }, [detailPage]);

    const handleSend = async () => {
        if (!input.trim() || isSending) return;
        setIsSending(true);

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { text: userMsg, sender: 'user' }]);

        const tokenStr = localStorage.getItem('token');
        const config = (tokenStr && tokenStr !== 'null') ? { headers: { Authorization: `Bearer ${tokenStr}` } } : {};

        if (postBookingFlow && postBookingFlow.step === 'payment_amount') {
            // Ignore typed messages during Razorpay payment - payment is handled by the modal
            setMessages(prev => [...prev, { text: 'Please complete your payment in the Razorpay window. If the window did not open, click the Pay Now button above.', sender: 'bot' }]);
            setIsSending(false);
            return;
        }

        if (postBookingFlow && postBookingFlow.step === 'review_form') {
            setMessages(prev => [...prev, { text: 'Please complete the feedback form above to finish your booking.', sender: 'bot' }]);
            setIsSending(false);
            return;
        }

        try {
            const chatHistory = messages.slice(-8).map(m => `${m.sender.toUpperCase()}: ${m.text}`).join('\n');
            const res = await axios.post('/api/chat', { message: userMsg, history: chatHistory }, config);

            const botMsg = { 
                text: res.data.reply, 
                sender: 'bot', 
                data: res.data.data, 
                itinerary: res.data.itinerary,
                travel_cards: res.data.travel_cards,
                showTrips: res.data.action === 'SHOW_TRIPS' 
            };
            
            if (window.speechSynthesis && res.data.reply) {
                const utterance = new SpeechSynthesisUtterance(res.data.reply.replace(/[\*#]/g, ''));
                utterance.rate = 1.0;
                window.speechSynthesis.speak(utterance);
            }
            
            setMessages(prev => [...prev, botMsg]);

            if (res.data.action === 'START_BOOKING') {
                setBookingForm({ destination: res.data.destination });
            }

        } catch (err) {
            setMessages(prev => [...prev, { text: 'Sorry, I am having trouble connecting to the server.', sender: 'bot' }]);
        } finally {
            setIsSending(false);
        }
    };

    const submitBooking = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                destination: bookingForm.destination._id,
                destinationObj: bookingForm.destination._id.startsWith('dynamic_') ? bookingForm.destination : null
            };
            const token = localStorage.getItem('token');
            const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
            const response = await axios.post('/api/bookings', payload, config);
            const bookingId = response.data._id;
            
            const cat = (bookingForm.destination.category || '').toLowerCase();
            const destName = bookingForm.destination.name || 'your destination';
            let transportModes = [
                {label: '✈️ Flight  🔴 High CO₂', val: 'Flight', icon: '✈️'},
                {label: '🚌 Bus  🟡 Medium CO₂', val: 'Bus', icon: '🚌'},
                {label: '🚂 Train  🟢 Eco-Friendly', val: 'Train', icon: '🚂'}
            ];
            if (cat === 'beach' || cat === 'wildlife') {
                transportModes.push({label: '🛳️ Luxury Cruise  🟡 Medium CO₂', val: 'Cruise', icon: '🛳️'});
                transportModes.push({label: '🚤 Speedboat  🟢 Low CO₂', val: 'Speedboat', icon: '🚤'});
            }
            if (cat === 'mountain' || cat === 'adventure') {
                transportModes.push({label: '🚁 Helicopter Drop  🔴 High CO₂', val: 'Helicopter', icon: '🚁'});
            }
            transportModes.push({label: '🛩️ Private Jet (Luxury)  🔴 High CO₂', val: 'PrivateJet', icon: '🛩️'});

            setMessages(prev => [...prev, 
                { text: `Booking successfully created for ${destName}! 🎉 Let's finalize your trip details.`, sender: 'bot' },
                { 
                  text: `How would you like to travel to ${destName}? Choose your mode — each shows its environmental impact!`, 
                  sender: 'bot', 
                  options: transportModes,
                  step: 'transport'
                }
            ]);
            
            setPostBookingFlow({
                bookingId: bookingId,
                destination: bookingForm.destination,
                step: 'transport',
                fromCity: formData.fromCity || 'Bangalore',
                basePrice: bookingForm.destination.price * formData.numberOfPeople,
                selections: {},
                carbonScore: 0
            });
            setBookingForm(null);
            setFormData({ name: '', email: '', travelDate: '', numberOfPeople: 1, fromCity: 'Bangalore' });
        } catch (err) {
            alert('Failed to submit booking');
        }
    };

    const handleOptionSelect = (step, option) => {
        setMessages(prev => [...prev, { text: option.label, sender: 'user' }]);

        if (step === 'transport') {
            const dest = postBookingFlow?.destination?.name || 'destination';
            const destLocation = postBookingFlow?.destination?.location || dest;
            const userCity = postBookingFlow?.fromCity || 'Bangalore';
            const carbonMap = { Flight: 80, Bus: 30, Train: 10, Cruise: 45, Speedboat: 15, Helicopter: 90, PrivateJet: 100 };
            const carbonVal = carbonMap[option.val] || 50;
            setPostBookingFlow(prev => ({ ...prev, carbonScore: carbonVal }));

            const carbonEmoji = carbonVal >= 70 ? '🔴' : carbonVal >= 30 ? '🟡' : '🟢';
            const carbonLabel = carbonVal >= 70 ? 'High' : carbonVal >= 30 ? 'Medium' : 'Low';

            // Standard transport types show rich cards from API
            const standardTypes = ['Flight', 'Bus', 'Train'];
            if (standardTypes.includes(option.val)) {
                setMessages(prev => [...prev, 
                    { text: `${carbonEmoji} Carbon Footprint: ${carbonLabel} (${carbonVal}/100). ${carbonVal <= 20 ? '🌿 Amazing eco-choice! You earned a Green Traveler badge! 🏅' : ''}`, sender: 'bot' },
                    { text: `Here are the best ${option.val.toLowerCase()} options from ${userCity} to ${dest}:`, sender: 'bot', transportSearch: { from: userCity, to: destLocation.split(',')[0].trim(), type: option.val.toLowerCase() } }
                ]);
            } else {
                // Exotic modes use button fallback
                let transportOptions = [];
                if (option.val === 'Cruise') transportOptions = [{label: '🛳️ Cordelia Cruise - ₹15000 (2 nights)', cost: 15000, name: 'Cordelia Cruise'}, {label: '🛳️ Angriya Cruise - ₹8000 (1 night)', cost: 8000, name: 'Angriya Cruise'}];
                else if (option.val === 'Speedboat') transportOptions = [{label: '🚤 Express Boat - ₹3000 (1h)', cost: 3000, name: 'Express Speedboat'}, {label: '🚤 Premium Yacht - ₹12000 (1.5h)', cost: 12000, name: 'Premium Yacht'}];
                else if (option.val === 'Helicopter') transportOptions = [{label: '🚁 HeliTaxi - ₹18000 (30min)', cost: 18000, name: 'HeliTaxi'}, {label: '🚁 Pawan Hans - ₹12000 (45min)', cost: 12000, name: 'Pawan Hans'}];
                else if (option.val === 'PrivateJet') transportOptions = [{label: '🛩️ JetSetGo - ₹250000 (1h)', cost: 250000, name: 'JetSetGo Private Jet'}, {label: '🛩️ Club One Air - ₹180000 (1.5h)', cost: 180000, name: 'Club One Air'}];

                setMessages(prev => [...prev, 
                    { text: `${carbonEmoji} Carbon Footprint: ${carbonLabel} (${carbonVal}/100). ${carbonVal <= 20 ? '🌿 Amazing eco-choice! You earned a Green Traveler badge! 🏅' : ''}`, sender: 'bot' },
                    { text: `Select your ${option.val} option:`, sender: 'bot', options: transportOptions.map(o => ({ label: o.label, val: o })), step: 'transport_selection' }
                ]);
            }
        }

        if (step === 'transport_selection') {
            setPostBookingFlow(prev => ({ ...prev, selections: { ...prev.selections, transport: option.val } }));
            const mode = option.val.name || '';
            const isFlight = mode.toLowerCase().includes('flight') || mode.toLowerCase().includes('jet') || mode.toLowerCase().includes('spicejet') || mode.toLowerCase().includes('indigo') || mode.toLowerCase().includes('air india');
            const isTrain = mode.toLowerCase().includes('exp') || mode.toLowerCase().includes('train') || mode.toLowerCase().includes('bharat') || mode.toLowerCase().includes('shatabdi') || mode.toLowerCase().includes('rajdhani');
            const transportType = isFlight ? 'flight' : isTrain ? 'train' : 'bus';

            setMessages(prev => [...prev, {
                text: `Great choice! Now choose your class & seat:`,
                sender: 'bot',
                showSeatSelector: transportType
            }]);
        }

        // seat_selection and addons are now handled by component callbacks, not buttons
        // (kept for exotic transport fallback button flow)
        if (step === 'seat_selection') {
            const extraCost = option.extraCost || 0;
            setPostBookingFlow(prev => ({ 
                ...prev, 
                selections: { 
                    ...prev.selections, 
                    seat: option.val, 
                    seatNumber: option.seat,
                    seatExtra: extraCost 
                } 
            }));
            setMessages(prev => [...prev, {
                text: '🧳 Select your travel extras:',
                sender: 'bot',
                showAddonsSelector: true
            }]);
        }

        if (step === 'addons') {
            // Legacy fallback for exotic modes
            const addonCost = option.cost || 0;
            const addonName = option.val === 'none' ? null : option.val;
            setPostBookingFlow(prev => ({
                ...prev, 
                selections: { 
                    ...prev.selections, 
                    addons: addonName ? [...(prev.selections.addons || []), { name: addonName, cost: addonCost }] : (prev.selections.addons || [])
                }
            }));

            if (option.val !== 'none') {
                setMessages(prev => [...prev, {
                    text: 'Add another extra, or skip:',
                    sender: 'bot',
                    options: [
                        {label: '🧳 Extra Baggage (+₹1500)', val: 'baggage', cost: 1500},
                        {label: '🍽️ Meals (+₹500)', val: 'meals', cost: 500},
                        {label: '🚗 Pickup (+₹2000)', val: 'pickup', cost: 2000},
                        {label: '🛡️ Insurance (+₹800)', val: 'insurance', cost: 800},
                        {label: '⏭️ Done', val: 'none', cost: 0}
                    ],
                    step: 'addons'
                }]);
            } else {
                let hotelOptions = [
                    {label: '🏨 Basic Hotel (₹2000/night)', val: 'Hotel', cost: 2000},
                    {label: '🏡 Homestay (₹1000/night)', val: 'Homestay', cost: 1000},
                    {label: '🏰 Luxury Resort (₹8000/night)', val: 'Luxury Resort', cost: 8000}
                ];

                if (postBookingFlow.destination && postBookingFlow.destination.hotels && postBookingFlow.destination.hotels.length > 0 && typeof postBookingFlow.destination.hotels[0] === 'object') {
                    hotelOptions = postBookingFlow.destination.hotels.map(h => ({
                        label: `🏨 ${h.name} (${h.type} - ₹${h.price_per_night}/night) ⭐${h.rating}`,
                        val: h.name,
                        cost: h.price_per_night,
                        hotelObj: h
                    }));
                }

                setMessages(prev => [...prev, {
                    text: 'Select your hotel:',
                    sender: 'bot',
                    options: hotelOptions,
                    step: 'stay'
                }]);
            }
        }

        if (step === 'stay') {
            setPostBookingFlow(prev => ({ ...prev, selections: { ...prev.selections, stay: { name: option.val, cost: option.cost } } }));
            setMessages(prev => [...prev, {
                text: 'Select food preference:',
                sender: 'bot',
                options: [{label: 'Veg', val: 'Veg'}, {label: 'Non-Veg', val: 'Non-Veg'}, {label: 'Both', val: 'Both'}],
                step: 'food_pref'
            }]);
        }

        if (step === 'food_pref') {
            setPostBookingFlow(prev => ({ ...prev, selections: { ...prev.selections, foodPref: option.val } }));
            setMessages(prev => [...prev, {
                text: 'Select meal plan:',
                sender: 'bot',
                options: [{label: 'Breakfast only (₹300)', val: 'Breakfast', cost: 300}, {label: 'Breakfast + Dinner (₹800)', val: 'Breakfast+Dinner', cost: 800}, {label: 'Full package (₹1500)', val: 'Full', cost: 1500}],
                step: 'meal_plan'
            }]);
        }

        if (step === 'meal_plan') {
            setPostBookingFlow(prev => {
                const newState = { ...prev, selections: { ...prev.selections, mealPlan: { mealPlan: option.val, cost: option.cost } } };
                const seatExtra = Number(newState.selections.seatExtra) || 0;
                const addonsTotal = (newState.selections.addons || []).reduce((sum, a) => sum + Number(a.cost), 0);
                const basePrice = Number(newState.basePrice) || 0;
                const transportCost = Number(newState.selections.transport.cost) || 0;
                const stayCost = Number(newState.selections.stay.cost) || 0;
                const mealCost = Number(newState.selections.mealPlan.cost) || 0;
                
                const totalCost = basePrice + transportCost + seatExtra + addonsTotal + stayCost + mealCost;
                
                const carbonVal = newState.carbonScore || 0;
                const carbonEmoji = carbonVal >= 70 ? '🔴' : carbonVal >= 30 ? '🟡' : '🟢';
                const carbonBadge = carbonVal <= 20 ? '\n🏅 Green Traveler Badge Earned!' : '';
                
                const addonsList = (newState.selections.addons || []).map(a => `  • ${a.name} (₹${a.cost})`).join('\n');
                
                const summary = `📋 ━━━ BOOKING SUMMARY ━━━\n\n` +
                    `📍 Destination Base: ₹${basePrice}\n` +
                    `🚀 Transport: ${newState.selections.transport.name} (₹${transportCost})\n` +
                    `💺 Seat: ${newState.selections.seat}${seatExtra > 0 ? ` (+₹${seatExtra})` : ''}\n` +
                    (addonsList ? `🧳 Add-ons:\n${addonsList}\n` : '') +
                    `🏨 Stay: ${newState.selections.stay.name} (₹${newState.selections.stay.cost})\n` +
                    `🍽️ Food: ${newState.selections.foodPref} — ${newState.selections.mealPlan.mealPlan} (₹${newState.selections.mealPlan.cost})\n` +
                    `\n${carbonEmoji} Carbon Footprint Score: ${carbonVal}/100${carbonBadge}\n` +
                    `\n💰 ━━━ Total Cost: ₹${totalCost} ━━━`;

                setMessages(m => [...m, { text: summary, sender: 'bot' }]);
                setMessages(m => [...m, {
                    text: 'Do you want to proceed with payment?',
                    sender: 'bot',
                    options: [{label: '✅ Yes, Pay Now', val: 'Yes'}, {label: '❌ No, Save for Later', val: 'No'}],
                    step: 'payment_confirm'
                }]);
                return { ...newState, totalCost };
            });
        }

        if (step === 'payment_confirm') {
            if (option.val === 'Yes') {
                setMessages(prev => [...prev, {
                    text: 'Select payment method:',
                    sender: 'bot',
                    options: [{label: 'UPI', val: 'UPI'}, {label: 'Card', val: 'Card'}],
                    step: 'payment_method'
                }]);
            } else {
                setMessages(prev => [...prev, { text: 'Booking saved as pending. You can pay later!', sender: 'bot' }]);
                finalizeBooking(postBookingFlow);
                setPostBookingFlow(null);
            }
        }

        if (step === 'payment_method') {
            const paymentMethod = option.val;
            setPostBookingFlow(prev => ({ ...prev, step: 'payment_amount', selections: { ...prev.selections, paymentMethod: paymentMethod } }));
            setMessages(prev => [...prev, { text: `Opening Razorpay for ₹${postBookingFlow.totalCost}...`, sender: 'bot' }]);

            // Load Razorpay SDK dynamically
            const loadRazorpay = () => {
                return new Promise((resolve) => {
                    if (window.Razorpay) return resolve(true);
                    const script = document.createElement('script');
                    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                    script.onload = () => resolve(true);
                    script.onerror = () => resolve(false);
                    document.body.appendChild(script);
                });
            };

            (async () => {
                try {
                    const isLoaded = await loadRazorpay();
                    if (!isLoaded) {
                        setMessages(prev => [...prev, { text: 'Failed to load payment gateway. Please check your internet connection.', sender: 'bot' }]);
                        return;
                    }

                    const keyRes = await fetch('/api/get-razorpay-key');
                    const keyData = await keyRes.json();

                    const amountInPaise = Math.round(Number(postBookingFlow.totalCost) * 100);
                    if (!Number.isFinite(amountInPaise) || amountInPaise < 100) {
                        throw new Error('Invalid payment amount. Please check your booking total.');
                    }
                    const orderRes = await fetch('/api/create-razorpay-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount: amountInPaise })
                    });
                    const order = await orderRes.json();
                    if (!orderRes.ok) throw new Error(order.error || 'Order creation failed');

                    const options = {
                        key: keyData.key,
                        amount: order.amount,
                        currency: 'INR',
                        name: 'AI Tourist Assistant',
                        description: `Booking Payment`,
                        order_id: order.id,
                        handler: async function (response) {
                            try {
                                const verifyRes = await fetch('/api/verify-payment', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        razorpay_payment_id: response.razorpay_payment_id,
                                        razorpay_order_id: response.razorpay_order_id,
                                        razorpay_signature: response.razorpay_signature,
                                        amount: order.amount,
                                        email: formData.email || 'user@example.com',
                                        method: paymentMethod
                                    })
                                });
                                const verifyData = await verifyRes.json();
                                if (verifyData.success) {
                                    const newMsgs = [
                                        { text: 'Payment successful! 🎉', sender: 'bot' },
                                        {
                                            text: 'We would love to get your feedback! Please rate and review your booking experience below to finalize your trip plan:',
                                            sender: 'bot',
                                            showFeedbackForm: true
                                        }
                                    ];
                                    setMessages(prev => [...prev, ...newMsgs]);
                                    setPostBookingFlow(prev => ({ ...prev, step: 'review_form', selections: { ...prev.selections, paymentAmount: postBookingFlow.totalCost } }));
                                } else {
                                    setMessages(prev => [...prev, { text: 'Payment verification failed. Please try again.', sender: 'bot' }]);
                                }
                            } catch (err) {
                                console.error('Verification error', err);
                                setMessages(prev => [...prev, { text: 'Payment verification error. Please contact support.', sender: 'bot' }]);
                            }
                        },
                        prefill: {
                            name: formData.name || '',
                            email: formData.email || '',
                        },
                        theme: { color: '#10b981' }
                    };

                    const rzp = new window.Razorpay(options);
                    rzp.on('payment.failed', function (response) {
                        setMessages(prev => [...prev, { text: `Payment failed: ${response.error.description}. Please try again.`, sender: 'bot' }]);
                    });
                    rzp.open();
                } catch (err) {
                    console.error('Razorpay error:', err);
                    setMessages(prev => [...prev, { text: `Payment error: ${err.message}. Please try again.`, sender: 'bot' }]);
                }
            })();
        }
    };

    const finalizeBooking = async (flowState) => {
        try {
            const payload = {
                transport: flowState.selections.transport,
                stay: flowState.selections.stay,
                food: flowState.selections.foodPref ? { preference: flowState.selections.foodPref, mealPlan: flowState.selections.mealPlan.mealPlan, cost: flowState.selections.mealPlan.cost } : null,
                totalCost: flowState.totalCost,
                payment: flowState.selections.paymentMethod ? { method: flowState.selections.paymentMethod, amount: flowState.selections.paymentAmount, status: 'Success' } : null,
                review: flowState.selections.reviewRating ? { rating: flowState.selections.reviewRating, comment: flowState.selections.reviewComment } : null
            };
            await axios.put(`/api/bookings/${flowState.bookingId}/complete`, payload);
            setPendingBookings(prev => [...prev, flowState.bookingId]);
        } catch (err) {
            console.error('Failed to finalize booking details');
        }
    };

    return (
        <div style={{ display: 'flex', gap: '20px', width: '100%', height: 'calc(100vh - 100px)' }}>
            {/* ChatGPT-style Saved Chats left sidebar */}
            <div className="admin-sidebar" style={{ 
                flex: '0 0 260px', 
                display: 'flex', 
                flexDirection: 'column', 
                background: 'rgba(15, 23, 42, 0.98)', 
                borderRight: '1px solid var(--border)', 
                borderRadius: '16px', 
                padding: '15px', 
                height: '100%',
                color: 'white',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* New Chat Button */}
                <button 
                    onClick={startNewChat}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        background: 'transparent',
                        color: 'white',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        marginBottom: '15px',
                        width: '100%'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                    <Plus size={18} /> New Chat
                </button>

                {/* Search Box */}
                <div style={{ position: 'relative', marginBottom: '15px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'rgba(255, 255, 255, 0.4)' }} />
                    <input 
                        type="text"
                        placeholder="Search chats..."
                        value={chatSearch}
                        onChange={e => setChatSearch(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 10px 10px 35px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            fontSize: '13px',
                            outline: 'none'
                        }}
                    />
                </div>

                {/* Chat History List */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '5px' }}>
                    {loadingChats ? (
                        <div style={{ color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', fontSize: '13px', marginTop: '20px' }}>Loading conversations...</div>
                    ) : chats.filter(c => c.title.toLowerCase().includes(chatSearch.toLowerCase())).length > 0 ? (
                        chats.filter(c => c.title.toLowerCase().includes(chatSearch.toLowerCase())).map((chat) => (
                            <div 
                                key={chat._id}
                                onClick={() => openChat(chat._id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    background: currentChatId === chat._id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    position: 'relative'
                                }}
                                onMouseEnter={e => {
                                    if (currentChatId !== chat._id) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                                }}
                                onMouseLeave={e => {
                                    if (currentChatId !== chat._id) e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '80%', overflow: 'hidden' }}>
                                    <MessageSquare size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                    {renamingChatId === chat._id ? (
                                        <input 
                                            type="text"
                                            value={renameTitleInput}
                                            onChange={e => setRenameTitleInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') renameChat(chat._id); }}
                                            onBlur={() => renameChat(chat._id)}
                                            autoFocus
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.1)',
                                                border: 'none',
                                                borderRadius: '4px',
                                                color: 'white',
                                                fontSize: '13px',
                                                padding: '2px 5px',
                                                width: '100%'
                                            }}
                                        />
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '500', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {chat.title}
                                            </span>
                                            <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)' }}>
                                                {new Date(chat.updatedAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '5px' }}>
                                    {renamingChatId !== chat._id && (
                                        <>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setRenamingChatId(chat._id); setRenameTitleInput(chat.title); }}
                                                style={{ background: 'transparent', border: 'none', color: 'rgba(255, 255, 255, 0.4)', cursor: 'pointer', padding: '2px' }}
                                                onMouseEnter={e => e.currentTarget.style.color = 'white'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)'}
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(chat._id); }}
                                                style={{ background: 'transparent', border: 'none', color: 'rgba(255, 255, 255, 0.4)', cursor: 'pointer', padding: '2px' }}
                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)'}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', fontSize: '13px', marginTop: '20px' }}>
                            {currentUser === 'guest' ? 'Sign in to save and sync chats!' : 'No conversations found'}
                        </div>
                    )}
                </div>

                {/* Delete Confirmation Popup */}
                {deleteConfirmId && (
                    <div style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: '15px',
                        right: '15px',
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        padding: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        zIndex: 10
                    }}>
                        <p style={{ fontSize: '12px', color: 'white', margin: '0 0 10px 0', textAlign: 'center' }}>Delete this conversation?</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                                onClick={() => deleteChat(deleteConfirmId)}
                                style={{ flex: 1, padding: '5px', borderRadius: '4px', background: 'var(--danger)', border: 'none', color: 'white', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                Delete
                            </button>
                            <button 
                                onClick={() => setDeleteConfirmId(null)}
                                style={{ flex: 1, padding: '5px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontSize: '11px', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="glass-panel chatbot-container" style={{ flex: '1', height: '100%', position: 'relative' }}>
                {detailPage ? (
                    <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
                        <button className="btn" onClick={() => setDetailPage(null)} style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                            ← Back to Chat
                        </button>
                        
                        <div style={{ position: 'relative', borderRadius: '15px', overflow: 'hidden', height: '300px', marginBottom: '20px' }}>
                            <img src={detailPage.image_url} alt={detailPage.place_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', padding: '20px' }}>
                                <h2 style={{ margin: 0, fontSize: '32px', color: 'white' }}>{detailPage.place_name}</h2>
                                <p style={{ margin: '5px 0 0 0', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--accent)' }}><MapPin size={18}/> {detailPage.location}</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                            <div className="glass-panel" style={{ padding: '15px', background: 'rgba(255,255,255,0.02)' }}>
                                <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>About</h4>
                                <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: '1.6' }}>{detailPage.description}</p>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
                                    {detailPage.tags?.map((tag, i) => <span key={i} style={{ background: 'var(--accent)', color: 'black', padding: '4px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold' }}>#{tag}</span>)}
                                </div>
                            </div>
                            <div className="glass-panel" style={{ padding: '15px', background: 'rgba(255,255,255,0.02)' }}>
                                <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>Quick Facts</h4>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
                                    <li><strong>⭐ Rating:</strong> {detailPage.rating} ({detailPage.reviews})</li>
                                    <li><strong>📅 Best Time:</strong> {detailPage.best_time}</li>
                                    <li><strong>🌤️ Weather:</strong> {detailPage.weather?.temperature}, {detailPage.weather?.condition}</li>
                                    <li><strong>🎟️ Entry Fee:</strong> {detailPage.entry_fee || 'Varies'}</li>
                                    <li><strong>🗺️ Navigation:</strong> <a href={detailPage.map_url} target="_blank" rel="noreferrer" style={{color: 'var(--accent)'}}>Open Google Maps</a></li>
                                </ul>
                            </div>
                        </div>

                        {detailPage.image_gallery && detailPage.image_gallery.length > 0 && (
                            <div style={{ marginBottom: '30px' }}>
                                <h4 style={{ marginBottom: '10px' }}>📸 Gallery</h4>
                                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
                                    {detailPage.image_gallery.map((img, i) => (
                                        <img key={i} src={img} alt={`Gallery ${i}`} style={{ width: '200px', height: '140px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }} />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="glass-panel" style={{ padding: '20px', marginBottom: '30px' }}>
                            <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>📡 Real-Time Live Data</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <h5 style={{ margin: '0 0 10px 0', color: 'var(--accent)' }}>🌤️ Live Weather</h5>
                                    {realtimeData ? (
                                        <div style={{ fontSize: '15px' }}>
                                            <p style={{ margin: '5px 0' }}><strong>Temperature:</strong> {realtimeData.temp}°C</p>
                                            <p style={{ margin: '5px 0' }}><strong>Wind Speed:</strong> {realtimeData.wind} km/h</p>
                                        </div>
                                    ) : <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Fetching live weather...</p>}
                                </div>
                                <div>
                                    <h5 style={{ margin: '0 0 10px 0', color: 'var(--accent)' }}>🚗 Distance & Time Calculator</h5>
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                        <input 
                                            type="text" 
                                            placeholder="Enter Origin City..." 
                                            value={originCity}
                                            onChange={e => setOriginCity(e.target.value)}
                                            style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                                        />
                                        <button className="btn btn-accent" onClick={calculateDistance} style={{ padding: '8px 15px' }}>Calculate</button>
                                    </div>
                                    {routeData && (
                                        <div style={{ fontSize: '15px', background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                            <p style={{ margin: '0 0 5px 0', color: 'var(--text-main)' }}><strong>Distance:</strong> {routeData.distance} km</p>
                                            <p style={{ margin: 0, color: 'var(--text-main)' }}><strong>Est. Travel Time:</strong> {routeData.time} Hours</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel" style={{ padding: '20px', marginBottom: '30px' }}>
                            <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>🗺️ Interactive Map</h4>
                            <div style={{ width: '100%', height: '350px', borderRadius: '10px', overflow: 'hidden' }}>
                                <iframe 
                                    title="destination-map"
                                    width="100%" 
                                    height="100%" 
                                    frameBorder="0" 
                                    scrolling="no" 
                                    marginHeight="0" 
                                    marginWidth="0" 
                                    src={`https://maps.google.com/maps?q=${encodeURIComponent(detailPage.place_name)}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                                ></iframe>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '30px' }}>
                            <div className="glass-panel" style={{ padding: '15px' }}>
                                <h4 style={{ margin: '0 0 10px 0', color: 'var(--accent)' }}>🗺️ Attractions</h4>
                                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                    {detailPage.nearby_attractions?.map((a, i) => <li key={i}>{a}</li>) || <li>No data</li>}
                                </ul>
                            </div>
                            <div className="glass-panel" style={{ padding: '15px' }}>
                                <h4 style={{ margin: '0 0 10px 0', color: 'var(--accent)' }}>🏨 Hotels</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {detailPage.hotels?.map((h, i) => {
                                        const hotelName = typeof h === 'string' ? h : h.name;
                                        return (
                                        <div key={i} 
                                            style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid rgba(255,255,255,0.04)', fontSize: '13px', color: 'var(--text-muted)'
                                            }}>
                                            <span style={{ fontWeight: '500', color: 'var(--text-main)' }}>{hotelName}</span>
                                            <button 
                                                onClick={() => setExpandedHotel(hotelName)}
                                                style={{
                                                    background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent)', border: 'none',
                                                    padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px',
                                                    fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={e => e.target.style.background = 'rgba(16, 185, 129, 0.2)'}
                                                onMouseLeave={e => e.target.style.background = 'rgba(16, 185, 129, 0.1)'}>
                                                💬 Reviews
                                            </button>
                                        </div>
                                    )})}
                                </div>
                            </div>
                            <div className="glass-panel" style={{ padding: '15px' }}>
                                <h4 style={{ margin: '0 0 10px 0', color: 'var(--accent)' }}>🍛 Restaurants</h4>
                                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                    {detailPage.foods?.map((f, i) => <li key={i}>{f}</li>)}
                                </ul>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                            {detailPage.transport_options && detailPage.transport_options.length > 0 && (
                                <div className="glass-panel" style={{ padding: '20px' }}>
                                    <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>🚆 Transport Suggestions</h4>
                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                        {detailPage.transport_options.map((t, i) => <li key={i} style={{ marginBottom: '8px' }}>{t}</li>)}
                                    </ul>
                                </div>
                            )}

                            {detailPage.packing_list && detailPage.packing_list.length > 0 && (
                                <div className="glass-panel" style={{ padding: '20px' }}>
                                    <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>🧳 Smart Packing List</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {detailPage.packing_list.map((item, i) => (
                                            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '15px', color: 'var(--text-main)' }}>
                                                <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} /> {item}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {detailPage.estimated_costs ? (
                                <div className="glass-panel" style={{ padding: '20px', gridColumn: 'span 3' }}>
                                    <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', fontSize: '18px', color: 'var(--text-main)' }}>💰 Real Travel Budget Calculator</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        {['low_budget', 'high_budget'].map((tier) => (
                                            <div key={tier} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '15px' }}>
                                                <h5 style={{ textTransform: 'capitalize', color: 'var(--accent)', fontSize: '16px', margin: '0 0 15px 0', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                                                    {tier.replace('_', ' ')} Estimate
                                                </h5>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                                    {Object.entries(detailPage.estimated_costs[tier]).filter(([k]) => k !== 'total').map(([item, cost]) => (
                                                        <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{ textTransform: 'capitalize' }}>{item === 'taxes' ? 'Taxes & Fees (18%)' : item}</span>
                                                            <span style={{ fontWeight: '500', color: 'var(--text-main)' }}>₹{cost}</span>
                                                        </div>
                                                    ))}
                                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '5px 0' }}></div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px', fontWeight: 'bold', color: 'var(--accent)' }}>
                                                        <span>Total Trip Budget</span>
                                                        <span>₹{detailPage.estimated_costs[tier].total}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : detailPage.budget_breakdown && (
                                <div className="glass-panel" style={{ padding: '20px' }}>
                                    <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>📊 Budget Breakdown</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        {Object.entries(detailPage.budget_breakdown).map(([category, percent]) => (
                                            <div key={category}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '14px', textTransform: 'capitalize' }}>
                                                    <span>{category}</span>
                                                    <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{percent}%</span>
                                                </div>
                                                <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${percent}%`, background: 'var(--accent)', height: '100%', borderRadius: '4px' }}></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {detailPage.itinerary && detailPage.itinerary.length > 0 && (
                            <div style={{ marginBottom: '30px', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '15px', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h3 style={{ margin: 0, color: 'var(--text-main)', borderBottom: '2px solid var(--accent)', paddingBottom: '10px', display: 'inline-block' }}>🗓️ Animated Day-wise Itinerary</h3>
                                    <button className="btn btn-accent" onClick={() => exportToPDF('detail-itinerary', `${detailPage.place_name}_Itinerary`)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 15px', fontSize: '13px' }}>
                                        <Download size={16}/> Export to PDF
                                    </button>
                                </div>
                                <div id="detail-itinerary" className="itinerary-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', paddingLeft: '30px', borderLeft: '3px dashed var(--accent)', background: 'rgba(0,0,0,0.1)', padding: '20px', borderRadius: '10px' }}>
                                    {detailPage.itinerary.map((dayPlan, i) => (
                                        <div key={i} className="glass-panel day-card" style={{ padding: '20px', position: 'relative', borderRadius: '12px', animation: `fadeInUp 0.6s ease-out ${i * 0.15}s both`, boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                                            <div style={{ position: 'absolute', left: '-42px', top: '25px', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent)', border: '4px solid var(--bg-main)', boxShadow: '0 0 10px var(--accent)' }}></div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                                                <strong style={{ color: 'var(--accent)', fontSize: '18px', textTransform: 'uppercase', letterSpacing: '1px' }}>Day {dayPlan.day}</strong>
                                                <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-main)' }}>{dayPlan.title || 'Explore & Experience'}</span>
                                            </div>
                                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '15px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                                                {dayPlan.activities?.map((act, idx) => <li key={idx} style={{ marginBottom: '8px' }}>{act}</li>)}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button className="btn btn-accent" style={{ width: '100%', padding: '15px', fontSize: '18px', fontWeight: 'bold' }} 
                            onClick={() => {
                                const rawBudgetText = detailPage.budgets?.['1_day'] || '';
                                const budgetNumbers = Array.from(rawBudgetText.matchAll(/[\d,]+/g))
                                    .map(match => parseInt(match[0].replace(/,/g, ''), 10))
                                    .filter(num => Number.isFinite(num));
                                const calculatedPrice = budgetNumbers.length === 0
                                    ? 5000
                                    : budgetNumbers.length === 1
                                        ? budgetNumbers[0]
                                        : Math.round((budgetNumbers[0] + budgetNumbers[1]) / 2);
                                setBookingForm({ destination: { ...detailPage, name: detailPage.place_name, price: calculatedPrice, _id: 'dynamic_' + Date.now() } });
                                setDetailPage(null);
                            }}>
                            💳 Proceed to Book
                        </button>
                    </div>
                ) : (
                <>
                <div className="chat-messages">
                {messages.map((msg, i) => (
                    <motion.div key={i} className={`message ${msg.sender}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                        <p style={{ whiteSpace: 'pre-line' }}>{msg.text}</p>
                        {msg.options && msg.options.length > 0 && msg.step !== 'stay' && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                                {msg.options.map((opt, idx) => (
                                    <button key={idx} className="btn btn-accent" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={() => handleOptionSelect(msg.step, opt)}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {msg.options && msg.options.length > 0 && msg.step === 'stay' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '10px' }}>
                                {msg.options.map((opt, idx) => (
                                    <div key={idx} onClick={() => handleOptionSelect(msg.step, opt)} className="glass-panel" style={{ padding: '15px', borderRadius: '12px', cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.3s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}>
                                        {opt.hotelObj && opt.hotelObj.image_url ? (
                                            <img src={opt.hotelObj.image_url} alt={opt.hotelObj.name} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '120px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px' }}>🏨</div>
                                        )}
                                        <h4 style={{ margin: '0 0 5px 0', color: 'var(--text-main)', fontSize: '15px' }}>{opt.hotelObj ? opt.hotelObj.name : opt.label.split('(')[0]}</h4>
                                        {opt.hotelObj && (
                                            <>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                                                    <span>⭐ {opt.hotelObj.rating} ({opt.hotelObj.reviews_count} reviews)</span>
                                                    <span style={{ textTransform: 'capitalize', color: 'var(--accent)' }}>{opt.hotelObj.type}</span>
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {opt.hotelObj.amenities.join(' • ')}
                                                </div>
                                            </>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent)' }}>₹{opt.cost} <span style={{ fontSize: '10px', fontWeight: 'normal', color: 'var(--text-muted)' }}>/night</span></div>
                                            <span style={{ fontSize: '12px', color: 'var(--text-main)', background: 'rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: '10px' }}>Select</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {msg.data && msg.data.length > 0 && (
                            <div className="message-data">
                                {msg.data.map((dest, idx) => (
                                    <div key={idx} className="dest-card">
                                        <img src={dest.imageUrl} alt={dest.name} />
                                        <h4>{dest.name}</h4>
                                        <p style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                            <MapPin size={14} /> {dest.location}
                                        </p>
                                        <p style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', color: 'var(--accent)', marginTop: '5px' }}>
                                            <IndianRupee size={14} /> ₹{dest.price} / person
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                        {msg.itinerary && msg.itinerary.length > 0 && (
                            <div className="itinerary-timeline" style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <button className="btn btn-accent" onClick={() => exportToPDF(`itinerary-${i}`, 'My_Itinerary')} style={{ alignSelf: 'flex-start', padding: '5px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Download size={14}/> Export to PDF
                                </button>
                                <div id={`itinerary-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px', background: 'var(--bg-main)', borderRadius: '10px' }}>
                                {msg.itinerary.map((dayPlan, idx) => (
                                    <div key={idx} className="glass-panel" style={{ padding: '15px', borderLeft: '4px solid var(--accent)', background: 'rgba(255,255,255,0.03)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <span style={{ fontWeight: 'bold', color: 'var(--accent)', fontSize: '14px', textTransform: 'uppercase' }}>Day {dayPlan.day}</span>
                                            <h4 style={{ margin: 0, fontSize: '16px' }}>{dayPlan.title}</h4>
                                        </div>
                                        <ul style={{ paddingLeft: '18px', margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
                                            {dayPlan.activities.map((act, i) => (
                                                <li key={i} style={{ marginBottom: '5px' }}>{act}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                                </div>
                            </div>
                        )}
                        {msg.travel_cards && msg.travel_cards.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '15px' }}>
                                {msg.travel_cards.map((card, idx) => (
                                    <div key={idx} className="glass-panel" style={{ padding: '20px', borderRadius: '15px', overflow: 'hidden', border: '1px solid var(--accent)' }}>
                                        <img src={card.image_url} alt={card.place_name} style={{ width: '100%', height: '250px', objectFit: 'cover', borderRadius: '10px', marginBottom: '15px' }} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <h3 style={{ margin: 0, fontSize: '22px', color: 'var(--text-main)' }}>{card.place_name}</h3>
                                            <a href={card.map_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}><MapPin size={16}/> View Map</a>
                                        </div>
                                        <p style={{ margin: '0 0 10px 0', fontSize: '15px', color: 'var(--text-muted)' }}>{card.description}</p>
                                        
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '10px' }}>
                                            <div><strong>🌍 Location:</strong> {card.location}</div>
                                            <div><strong>🏷️ Category:</strong> {card.category}</div>
                                            <div><strong>⭐ Rating:</strong> {card.rating} ({card.reviews})</div>
                                            <div><strong>📅 Best Time:</strong> {card.best_time}</div>
                                            <div><strong>🌤️ Weather:</strong> {card.weather?.temperature}, {card.weather?.condition}</div>
                                        </div>

                                        <h4 style={{ margin: '0 0 10px 0', color: 'var(--accent)' }}>💰 Estimated Budgets</h4>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                                            {card.budgets && Object.entries(card.budgets).map(([days, cost]) => (
                                                <span key={days} style={{ background: 'var(--bg-main)', padding: '5px 12px', borderRadius: '20px', fontSize: '13px', border: '1px solid var(--border)' }}>{days.replace('_', ' ')}: <strong style={{color:'var(--accent)'}}>{cost}</strong></span>
                                            ))}
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                            <div>
                                                <h4 style={{ margin: '0 0 5px 0' }}>🏨 Top Hotels</h4>
                                                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                                    {card.hotels?.map((h, i) => {
                                                        const hotelName = typeof h === 'string' ? h : h.name;
                                                        return <li key={i}>{hotelName}</li>;
                                                    })}
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 style={{ margin: '0 0 5px 0' }}>🍛 Local Food</h4>
                                                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                                    {card.foods?.map((f, i) => <li key={i}>{f}</li>)}
                                                </ul>
                                            </div>
                                        </div>

                                        {card.itinerary && card.itinerary.length > 0 && (
                                            <div>
                                                <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid var(--border)', paddingBottom: '5px' }}>🗓️ Suggested Itinerary</h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    {card.itinerary.map((dayPlan, i) => (
                                                        <div key={i} style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: '3px solid var(--accent)' }}>
                                                            <strong style={{ display: 'block', marginBottom: '5px', color: 'var(--text-main)' }}>Day {dayPlan.day}</strong>
                                                            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{dayPlan.activities?.join(' • ')}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        <button className="btn btn-accent" style={{ width: '100%', marginTop: '20px' }} onClick={() => setDetailPage(card)}>
                                            Explore Destination Details
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {msg.showTrips && (
                            <div style={{ marginTop: '15px' }}>
                                <TripTable 
                                    addToCart={addToCart} 
                                    onTripAdded={(trip) => {
                                        setMessages(prev => [...prev, { text: `Excellent choice! 🎒 I have added the ${trip.type} to ${trip.destination} seamlessly to your cart! You can view it by clicking the Cart icon up top.`, sender: 'bot' }]);
                                    }}
                                />
                            </div>
                        )}
                        {msg.transportSearch && (
                            <div style={{ marginTop: '15px', maxWidth: '100%' }}>
                                <TransportCards 
                                    from={msg.transportSearch.from} 
                                    to={msg.transportSearch.to} 
                                    type={msg.transportSearch.type}
                                    onBook={(transport) => {
                                        const t = { cost: transport.price, name: transport.name };
                                        setPostBookingFlow(prev => ({ ...prev, selections: { ...prev.selections, transport: t } }));
                                        setMessages(prev => [...prev, 
                                            { text: `✅ Booked: ${transport.name} — ₹${transport.price}`, sender: 'user' },
                                            {
                                                text: `Great choice! Now choose your class & seat:`,
                                                sender: 'bot',
                                                showSeatSelector: transport.type // 'flight', 'train', or 'bus'
                                            }
                                        ]);
                                    }}
                                />
                            </div>
                        )}
                        {msg.showSeatSelector && (
                            <div style={{ marginTop: '15px' }}>
                                <SeatSelector 
                                    transportType={msg.showSeatSelector}
                                    onSelect={(selection) => {
                                        handleOptionSelect('seat_selection', selection);
                                    }}
                                />
                            </div>
                        )}
                        {msg.showAddonsSelector && (
                            <div style={{ marginTop: '15px' }}>
                                <AddonsSelector 
                                    onConfirm={(selection) => {
                                        if (selection.type === 'none') {
                                            handleOptionSelect('addons', { val: 'none', cost: 0 });
                                        } else if (selection.type === 'bundle') {
                                            // Handle bundle - we can treat it as one big addon or map it
                                            setPostBookingFlow(prev => ({
                                                ...prev,
                                                selections: {
                                                    ...prev.selections,
                                                    addons: [{ name: selection.name, cost: selection.cost }]
                                                }
                                            }));
                                            handleOptionSelect('addons', { val: 'none', cost: 0 }); // Skip further additions
                                        } else {
                                            // Individual addons
                                            setPostBookingFlow(prev => ({
                                                ...prev,
                                                selections: {
                                                    ...prev.selections,
                                                    addons: selection.items
                                                }
                                            }));
                                            handleOptionSelect('addons', { val: 'none', cost: 0 });
                                        }
                                    }}
                                />
                            </div>
                        )}
                        {msg.showFeedbackForm && (
                            <div style={{ marginTop: '15px' }}>
                                <ReviewsSection 
                                    entityId={postBookingFlow?.destination?._id || postBookingFlow?.destination?.name || 'checkout'} 
                                    entityType="destination" 
                                    onReviewSubmitted={(review) => {
                                        setPostBookingFlow(prev => {
                                            const finalState = {
                                                ...prev,
                                                selections: {
                                                    ...prev.selections,
                                                    reviewRating: review.rating,
                                                    reviewComment: review.reviewText
                                                }
                                            };
                                            finalizeBooking(finalState);
                                            return null;
                                        });

                                        setMessages(prev => [...prev, {
                                            text: "🎉 Review saved! Thank you so much for your feedback!\n\nYour entire MERN travel booking package has been officially locked and confirmed. Safe travels! 🎒🌟 You can view your invoice and bookings on your dashboard.",
                                            sender: 'bot'
                                        }]);
                                    }}
                                />
                            </div>
                        )}
                    </motion.div>
                ))}
                {isSending && (
                    <div className="message bot typing-indicator-container">
                        <div className="typing-indicator">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                )}
                {bookingForm && (
                    <div className="message bot" style={{ padding: '25px', borderRadius: '15px', background: 'rgba(30, 30, 45, 0.95)', border: '1px solid rgba(129, 140, 248, 0.3)', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)' }}>
                        <form onSubmit={submitBooking}>
                            <h3 style={{ marginBottom: '20px', fontSize: '20px', color: 'var(--text-main)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>✈️ Boarding Ticket Booking</h3>
                            
                            <div className="form-group" style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Departure Origin</label>
                                    <input type="text" placeholder="From (e.g. Bangalore)" required value={formData.fromCity} onChange={e => setFormData({ ...formData, fromCity: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Destination</label>
                                    <input type="text" readOnly value={bookingForm.destination.name} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', cursor: 'not-allowed' }} />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Full Name</label>
                                <input type="text" placeholder="e.g. John Doe" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                            </div>

                            <div className="form-group" style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Address</label>
                                <input type="email" placeholder="e.g. john@example.com" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                            </div>

                            <div className="form-group" style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Travel Date</label>
                                    <input type="date" required value={formData.travelDate} onChange={e => setFormData({ ...formData, travelDate: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Travelers</label>
                                    <input type="number" min="1" placeholder="1" required value={formData.numberOfPeople} onChange={e => setFormData({ ...formData, numberOfPeople: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button type="submit" className="btn btn-accent" style={{ flex: 1, padding: '12px', fontWeight: 'bold' }}>Submit Booking</button>
                                <button type="button" className="btn btn-danger" onClick={() => setBookingForm(null)} style={{ flex: 1, padding: '12px', fontWeight: 'bold' }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="chat-input" style={{ display: 'flex', gap: '10px' }}>
                <button 
                    className="btn" 
                    onClick={toggleListening}
                    style={{ 
                        padding: '10px', 
                        background: isListening ? '#ef4444' : 'transparent',
                        color: isListening ? '#fff' : 'var(--accent)',
                        animation: isListening ? 'pulse 1.5s infinite' : 'none'
                    }}
                    title="Speak"
                >
                    {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <input
                    type="text"
                    placeholder={isListening ? "Listening..." : "Ask me something..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    style={{ flex: 1 }}
                />
                <button className="btn" onClick={handleSend}>
                    <Send size={20} />
                </button>
            </div>
            </>
            )}
            {expandedHotel && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
                    zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center',
                    padding: '20px'
                }}>
                    <div className="glass-panel" style={{
                        width: '100%', maxWidth: '800px', maxHeight: '90vh',
                        overflowY: 'auto', padding: '30px', position: 'relative',
                        background: 'rgba(15, 23, 42, 0.97)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                    }}>
                        <button className="btn btn-danger" 
                            style={{ position: 'absolute', top: '20px', right: '20px', padding: '8px 16px', fontSize: '14px', fontWeight: 'bold' }}
                            onClick={() => setExpandedHotel(null)}>
                            ✕ Close
                        </button>
                        
                        <div style={{ marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '24px', margin: 0, color: 'var(--text-main)' }}>🏨 {expandedHotel}</h2>
                            <p style={{ margin: '5px 0 0 0', color: 'var(--accent)', fontSize: '14px', fontWeight: '600' }}>Guest Reviews & Quality Ratings</p>
                        </div>
                        
                        <ReviewsSection 
                            entityId={expandedHotel} 
                            entityType="hotel" 
                        />
                    </div>
                </div>
            )}
          </div>
        </div>
    );
};

export default Chatbot;
