import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Star, MapPin, Clock, Calendar, Heart, Shield, Award, Trash2 } from 'lucide-react';

const CompareModal = ({ visible, onClose, compareList, onRemove, onClear, onBook, onWishlist }) => {
    const [aiScores, setAiScores] = useState(null);
    const [loadingAi, setLoadingAi] = useState(false);

    useEffect(() => {
        if (visible && compareList.length >= 2) {
            fetchAiScores();
        }
    }, [visible, compareList.length]);

    const fetchAiScores = async () => {
        setLoadingAi(true);
        setAiScores(null);
        try {
            const res = await axios.post('/api/tripplans/compare-ai', {
                packageIds: compareList.map(t => t._id)
            });
            setAiScores(res.data);
        } catch (err) {
            console.error('AI Compare Error', err);
        } finally {
            setLoadingAi(false);
        }
    };

    if (!visible) return null;

    // Helper to render AI badges
    const renderAiBadges = (tripId) => {
        if (!aiScores) return null;
        const badges = [];
        if (aiScores.bestValue === tripId) badges.push({ label: 'Best Value', color: '#10b981', icon: '💰' });
        if (aiScores.bestFamily === tripId) badges.push({ label: 'Best for Families', color: '#3b82f6', icon: '👨‍👩‍👧' });
        if (aiScores.bestCouple === tripId) badges.push({ label: 'Best for Couples', color: '#ec4899', icon: '❤️' });
        if (aiScores.bestAdventure === tripId) badges.push({ label: 'Best Adventure', color: '#f59e0b', icon: '⛰️' });
        if (aiScores.bestLuxury === tripId) badges.push({ label: 'Best Luxury', color: '#8b5cf6', icon: '💎' });
        if (aiScores.mostBudgetFriendly === tripId) badges.push({ label: 'Most Budget Friendly', color: '#14b8a6', icon: '🏷️' });
        if (aiScores.mostPopular === tripId) badges.push({ label: 'Most Popular', color: '#ef4444', icon: '🔥' });

        return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '10px' }}>
                {badges.map((b, i) => (
                    <div key={i} style={{ background: `${b.color}22`, color: b.color, border: `1px solid ${b.color}44`, padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{b.icon}</span> {b.label}
                    </div>
                ))}
            </div>
        );
    };

    const renderCell = (title, renderFn) => (
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '16px 0' }}>
            <div style={{ width: '140px', flexShrink: 0, fontWeight: 'bold', color: '#94a3b8', fontSize: '14px', display: 'flex', alignItems: 'center' }}>
                {title}
            </div>
            <div style={{ display: 'flex', flex: 1, gap: '20px', overflowX: 'auto' }}>
                {compareList.map(trip => (
                    <div key={trip._id} style={{ flex: 1, minWidth: '220px', color: 'white', fontSize: '14px' }}>
                        {renderFn(trip)}
                    </div>
                ))}
            </div>
        </div>
    );

    return ReactDOM.createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 10050, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}>
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose} 
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }} 
            />

            <motion.div 
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                style={{ position: 'relative', width: '100%', maxWidth: '1200px', background: '#0f172a', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
                {/* Header */}
                <div style={{ padding: '20px 30px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                    <h2 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        Compare Packages <span style={{ background: '#3b82f6', color: 'white', fontSize: '12px', padding: '4px 10px', borderRadius: '12px' }}>{compareList.length}/3</span>
                    </h2>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={onClear} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#ef4444', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 'bold' }}>
                            <Trash2 size={16} /> Clear All
                        </button>
                        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '0 30px 30px 30px', overflowX: 'auto' }}>
                    
                    {/* Heroes */}
                    <div style={{ display: 'flex', padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ width: '140px', flexShrink: 0 }}></div>
                        <div style={{ display: 'flex', flex: 1, gap: '20px' }}>
                            {compareList.map(trip => (
                                <div key={trip._id} style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                                    <button onClick={() => onRemove(trip._id)} style={{ position: 'absolute', top: -10, right: -10, background: '#ef4444', color: 'white', border: 'none', width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <X size={14} />
                                    </button>
                                    <div style={{ height: '140px', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
                                        <img src={trip.heroImage || trip.image} alt={trip.destination} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '18px' }}>{trip.destination}</h3>
                                    <div style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '20px', marginBottom: '10px' }}>
                                        ₹{trip.price?.toLocaleString()}
                                    </div>
                                    
                                    {/* AI Badges Section */}
                                    {loadingAi ? (
                                        <div style={{ color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> 
                                            AI Analyzing...
                                        </div>
                                    ) : (
                                        renderAiBadges(trip._id)
                                    )}

                                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                        <button onClick={() => onBook(trip)} style={{ flex: 1, background: '#3b82f6', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                                            Book Now
                                        </button>
                                        <button onClick={(e) => onWishlist(e, trip._id)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>
                                            <Heart size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Specs */}
                    {renderCell('Category', t => <span style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>{t.category}</span>)}
                    {renderCell('State/Region', t => <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={14} color="#94a3b8"/> {t.state}</div>)}
                    {renderCell('Duration', t => <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} color="#94a3b8"/> {t.duration}</div>)}
                    {renderCell('Rating', t => <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Star size={14} color="#f59e0b" fill="#f59e0b"/> {t.rating} ({t.reviewCount || 42} reviews)</div>)}
                    {renderCell('Weather', t => t.weather || 'Check local forecast')}
                    
                    {renderCell('Highlights', t => (
                        <ul style={{ margin: 0, paddingLeft: '16px', color: '#cbd5e1' }}>
                            {(t.highlights || []).map((h, i) => <li key={i} style={{ marginBottom: '4px' }}>{h}</li>)}
                        </ul>
                    ))}
                    
                    {renderCell('Activities', t => (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {(t.activities || []).map((act, i) => (
                                <span key={i} style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>{act}</span>
                            ))}
                        </div>
                    ))}
                    
                    {renderCell('Attractions', t => (
                        <div style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: '1.6' }}>
                            {(t.attractions || []).join(', ')}
                        </div>
                    ))}

                </div>
            </motion.div>
            
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}} />
        </div>,
        document.body
    );
};

export default CompareModal;
