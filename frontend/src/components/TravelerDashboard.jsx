import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LogOut, Book, User, Settings, MapPin, Navigation, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TravelerDashboard = () => {
    const [bookings, setBookings] = useState([]);
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('bookings');
    const [preferences, setPreferences] = useState({});
    const [stories, setStories] = useState([]);
    const [communityPlaces, setCommunityPlaces] = useState([]);
    
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return navigate('/login');

        const ax = axios.create({ headers: { Authorization: `Bearer ${token}` } });
        
        ax.get('/api/auth/me')
            .then(res => {
                setUser(res.data);
                // Fetch preferences and stories using user ID
                ax.get(`/api/preferences/${res.data.id}`)
                  .then(pRes => setPreferences(pRes.data))
                  .catch(console.error);
                  
                ax.get(`/api/stories/user/${res.data.id}`)
                  .then(sRes => setStories(sRes.data))
                  .catch(console.error);
            })
            .catch(() => navigate('/login'));

        ax.get('/api/bookings/my')
            .then(res => setBookings(res.data))
            .catch(console.error);
            
        ax.get('/api/community/approved')
            .then(res => setCommunityPlaces(res.data))
            .catch(console.error);
            
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.dispatchEvent(new Event('authChange'));
        navigate('/');
    };
    
    const savePreferences = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.put(`/api/preferences/${user.id}`, preferences, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Preferences saved successfully!');
        } catch(err) {
            alert('Error saving preferences');
        }
    };

    if (!user) return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2>Welcome Back, {user.username}!</h2>
                <button className="btn btn-danger" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <LogOut size={16} /> Logout
                </button>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
                <button className={`btn ${activeTab === 'bookings' ? 'btn-accent' : ''}`} onClick={() => setActiveTab('bookings')} style={{ background: activeTab !== 'bookings' ? 'rgba(255,255,255,0.1)' : '' }}>
                    <Navigation size={18} /> My Bookings
                </button>
                <button className={`btn ${activeTab === 'stories' ? 'btn-accent' : ''}`} onClick={() => setActiveTab('stories')} style={{ background: activeTab !== 'stories' ? 'rgba(255,255,255,0.1)' : '' }}>
                    <BookOpen size={18} /> Travel Stories
                </button>
                <button className={`btn ${activeTab === 'preferences' ? 'btn-accent' : ''}`} onClick={() => setActiveTab('preferences')} style={{ background: activeTab !== 'preferences' ? 'rgba(255,255,255,0.1)' : '' }}>
                    <Settings size={18} /> Preferences
                </button>
                <button className={`btn ${activeTab === 'community' ? 'btn-accent' : ''}`} onClick={() => setActiveTab('community')} style={{ background: activeTab !== 'community' ? 'rgba(255,255,255,0.1)' : '' }}>
                    <MapPin size={18} /> Hidden Gems
                </button>
            </div>

            <div className="glass-panel" style={{ padding: '30px' }}>
                
                {activeTab === 'bookings' && (
                    <>
                        <h3 style={{ marginBottom: '20px' }}>My Bookings</h3>
                        {bookings.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>You have no bookings yet. Go to the Chatbot to plan your next trip!</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {bookings.map(book => (
                                    <div key={book._id} style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                            <h4 style={{ margin: 0, fontSize: '18px', color: 'var(--text-main)' }}>{book.destination?.name || 'Custom Trip'}</h4>
                                            <span style={{
                                                padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                                                background: book.status === 'Confirmed' ? 'rgba(16, 185, 129, 0.2)' : book.status === 'Cancelled' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                                color: book.status === 'Confirmed' ? '#10b981' : book.status === 'Cancelled' ? '#ef4444' : '#f59e0b'
                                            }}>
                                                STATUS: {book.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                            <div><strong>Date:</strong> {new Date(book.travelDate).toLocaleDateString()}</div>
                                            <div><strong>People:</strong> {book.numberOfPeople}</div>
                                            <div><strong>Transport:</strong> {book.transport?.name || 'Not selected'}</div>
                                            <div><strong>Stay:</strong> {book.stay?.name || 'Not selected'}</div>
                                            <div><strong>Total Cost:</strong> ₹{book.totalCost || 'Processing'}</div>
                                        </div>
                                        {book.status === 'Confirmed' && !book.tripCompleted && (
                                            <button className="btn btn-accent" style={{ marginTop: '15px', padding: '5px 10px', fontSize: '12px' }} onClick={async () => {
                                                const token = localStorage.getItem('token');
                                                await axios.post('/api/stories/generate', { bookingId: book._id, userId: user.id }, { headers: { Authorization: `Bearer ${token}` } });
                                                alert("Trip marked as complete! A travel story has been generated by AI.");
                                                window.location.reload();
                                            }}>Mark as Completed (Generate Story)</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
                
                {activeTab === 'stories' && (
                    <>
                        <h3 style={{ marginBottom: '20px' }}>My AI Travel Stories</h3>
                        {stories.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>You haven't completed any trips yet. Complete a trip to get an AI-generated travel diary!</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {stories.map(story => (
                                    <div key={story._id} className="story-card">
                                        <h4 style={{ fontSize: '20px', marginBottom: '5px' }}>{story.title}</h4>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '15px' }}>
                                            {new Date(story.startDate).toLocaleDateString()} • ₹{story.totalBudget} spent
                                        </div>
                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', marginBottom: '15px', fontStyle: 'italic', borderLeft: '3px solid var(--accent)' }}>
                                            "{story.summary}"
                                        </div>
                                        <h5>Travel Diary</h5>
                                        <p style={{ whiteSpace: 'pre-line', fontSize: '14px', lineHeight: '1.6' }}>{story.diary}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
                
                {activeTab === 'preferences' && (
                    <form onSubmit={savePreferences}>
                        <h3 style={{ marginBottom: '20px' }}>Travel Preferences (AI Memory)</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>These preferences will be remembered by the AI companion.</p>
                        
                        <div className="form-group">
                            <label>Budget Preference</label>
                            <select value={preferences.budgetPreference || 'mid-range'} onChange={(e) => setPreferences({...preferences, budgetPreference: e.target.value})}>
                                <option value="budget">Budget</option>
                                <option value="mid-range">Mid-Range</option>
                                <option value="luxury">Luxury</option>
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>Dietary Preference</label>
                            <select value={preferences.dietaryPreference || 'both'} onChange={(e) => setPreferences({...preferences, dietaryPreference: e.target.value})}>
                                <option value="veg">Vegetarian</option>
                                <option value="non-veg">Non-Vegetarian</option>
                                <option value="both">Both</option>
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>Preferred Language</label>
                            <select value={preferences.preferredLanguage || 'en'} onChange={(e) => setPreferences({...preferences, preferredLanguage: e.target.value})}>
                                <option value="en">English</option>
                                <option value="hi">Hindi (हिंदी)</option>
                                <option value="kn">Kannada (ಕನ್ನಡ)</option>
                            </select>
                        </div>
                        
                        <button type="submit" className="btn btn-accent">Save Preferences</button>
                    </form>
                )}
                
                {activeTab === 'community' && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>Community Hidden Gems</h3>
                            <button className="btn" onClick={() => alert("Submit form coming soon!")}>Submit Place</button>
                        </div>
                        {communityPlaces.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>No hidden gems discovered yet.</p>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                                {communityPlaces.map(place => (
                                    <div key={place._id} className="dest-card">
                                        <h4>{place.placeName}</h4>
                                        <p style={{ fontSize: '12px', color: 'var(--accent)', marginBottom: '10px' }}>{place.category.toUpperCase()}</p>
                                        <p style={{ fontSize: '14px', marginBottom: '10px' }}>{place.description}</p>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            📍 {place.location}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default TravelerDashboard;
