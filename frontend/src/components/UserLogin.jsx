import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Bot, Chrome } from 'lucide-react';
import { getAuthErrorMessage } from '../utils/authError';

const UserLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState('');
    const googleScriptRef = useRef(null);
    const navigate = useNavigate();

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    useEffect(() => {
        // If already logged in as user, redirect to chatbot
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        if (token && role === 'user') navigate('/');
    }, [navigate]);

    const handleGoogleResponse = useCallback(async (response) => {
        setSocialLoading('google');
        setError('');
        try {
            const base64Url = response.credential.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const decoded = JSON.parse(jsonPayload);

            const res = await axios.post('/api/auth/social', {
                provider: 'google',
                token: response.credential,
                email: decoded.email,
                name: decoded.name,
                providerId: decoded.sub,
                profilePicture: decoded.picture
            });

            localStorage.setItem('token', res.data.token);
            localStorage.setItem('role', res.data.role || 'user');
            localStorage.setItem('username', res.data.username);
            if (res.data.profilePicture) {
                localStorage.setItem('profilePicture', res.data.profilePicture);
            }
            if (res.data.name) {
                localStorage.setItem('name', res.data.name);
            }
            if (res.data.email) {
                localStorage.setItem('email', res.data.email);
            }
            localStorage.removeItem('chatHistory_guest');
            window.dispatchEvent(new Event('authChange'));
            navigate('/');
        } catch (err) {
            setError(getAuthErrorMessage(err, 'Google login failed'));
        } finally {
            setSocialLoading('');
        }
    }, [navigate]);

    // Load Google Identity Services script
    useEffect(() => {
        if (!googleClientId) return undefined;

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        googleScriptRef.current = script;
        document.head.appendChild(script);

        script.onload = () => {
            const btnHost = document.getElementById('google-signin-btn');
            if (!window.google?.accounts?.id || !btnHost) return;
            window.google.accounts.id.initialize({
                client_id: googleClientId,
                callback: handleGoogleResponse,
            });
            window.google.accounts.id.renderButton(btnHost, {
                theme: 'filled_black',
                size: 'large',
                width: Math.min(320, window.innerWidth - 80),
                text: 'continue_with',
                shape: 'pill',
                logo_alignment: 'left',
            });
        };

        return () => {
            if (googleScriptRef.current?.parentNode) {
                googleScriptRef.current.parentNode.removeChild(googleScriptRef.current);
            }
        };
    }, [googleClientId, handleGoogleResponse]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address');
            return;
        }

        setLoading(true);

        try {
            const guestHistoryStr = localStorage.getItem('chatHistory_guest');
            let guestHistory = [];
            if (guestHistoryStr) {
                try {
                    const parsed = JSON.parse(guestHistoryStr);
                    guestHistory = (Array.isArray(parsed) ? parsed : [])
                        .filter(m => m?.text && !String(m.text).includes("Hi! I'm your AI Tourist Assistant"))
                        .slice(-40);
                } catch (parseErr) {
                    console.error('Failed to parse guest history', parseErr);
                }
            }

            const res = await axios.post('/api/auth/login', {
                email: email.trim(),
                password,
                guestHistory
            });

            localStorage.setItem('token', res.data.token);
            localStorage.setItem('role', res.data.role || 'user');
            localStorage.setItem('username', res.data.username);
            if (res.data.email) localStorage.setItem('email', res.data.email);
            if (res.data.name) localStorage.setItem('name', res.data.name);
            if (res.data.profilePicture) localStorage.setItem('profilePicture', res.data.profilePicture);
            localStorage.removeItem('chatHistory_guest');
            window.dispatchEvent(new Event('authChange'));

            if (res.data.role === 'admin') {
                navigate('/admin/dashboard');
            } else {
                navigate('/');
            }
        } catch (err) {
            setError(getAuthErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

                * { box-sizing: border-box; margin: 0; padding: 0; }

                .user-login-bg {
                    min-height: 100vh;
                    background: #000000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    font-family: 'Inter', sans-serif;
                    position: relative;
                    overflow: hidden;
                }

                .user-login-bg::before {
                    content: '';
                    position: absolute;
                    width: 600px;
                    height: 600px;
                    background: radial-gradient(circle, rgba(0, 85, 255, 0.08) 0%, transparent 70%);
                    top: -100px;
                    left: 50%;
                    transform: translateX(-50%);
                    pointer-events: none;
                }

                .user-login-bg::after {
                    content: '';
                    position: absolute;
                    width: 400px;
                    height: 400px;
                    background: radial-gradient(circle, rgba(0, 40, 160, 0.06) 0%, transparent 70%);
                    bottom: -100px;
                    right: 10%;
                    pointer-events: none;
                }

                .user-card {
                    width: 100%;
                    max-width: 420px;
                    background: rgba(8, 12, 28, 0.92);
                    border: 1px solid rgba(0, 85, 255, 0.35);
                    border-radius: 24px;
                    padding: 48px 40px;
                    backdrop-filter: blur(24px);
                    -webkit-backdrop-filter: blur(24px);
                    box-shadow:
                        0 0 0 1px rgba(0, 85, 255, 0.1),
                        0 0 40px rgba(0, 85, 255, 0.12),
                        0 0 80px rgba(0, 40, 160, 0.08),
                        0 32px 80px rgba(0, 0, 0, 0.8);
                    position: relative;
                    animation: cardIn 0.4s cubic-bezier(0.22, 1, 0.36, 1);
                }

                @keyframes cardIn {
                    from { opacity: 0; transform: translateY(32px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0)    scale(1); }
                }

                .user-card::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 50%; transform: translateX(-50%);
                    width: 60%; height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(0, 85, 255, 0.6), transparent);
                    border-radius: 50%;
                }

                .user-icon-wrap {
                    width: 64px; height: 64px;
                    background: linear-gradient(135deg, rgba(0, 85, 255, 0.15), rgba(0, 40, 160, 0.1));
                    border: 1px solid rgba(0, 85, 255, 0.4);
                    border-radius: 18px;
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto 24px;
                    box-shadow: 0 0 24px rgba(0, 85, 255, 0.2);
                }

                .user-title {
                    text-align: center;
                    color: #f1f5f9;
                    font-size: 26px;
                    font-weight: 700;
                    letter-spacing: -0.5px;
                    margin-bottom: 6px;
                }

                .user-subtitle {
                    text-align: center;
                    color: #64748b;
                    font-size: 14px;
                    margin-bottom: 36px;
                }

                .field-group {
                    margin-bottom: 18px;
                }

                .field-label {
                    display: block;
                    font-size: 13px;
                    font-weight: 500;
                    color: #94a3b8;
                    margin-bottom: 8px;
                    letter-spacing: 0.3px;
                }

                .field-wrap {
                    position: relative;
                }

                .field-icon {
                    position: absolute;
                    left: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #475569;
                    pointer-events: none;
                    transition: color 0.2s;
                }

                .user-input {
                    width: 100%;
                    padding: 13px 44px;
                    background: rgba(255, 255, 255, 0.04);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    color: #f1f5f9;
                    font-size: 15px;
                    font-family: 'Inter', sans-serif;
                    outline: none;
                    transition: all 0.2s;
                }

                .user-input:focus {
                    border-color: rgba(0, 85, 255, 0.6);
                    background: rgba(0, 85, 255, 0.05);
                    box-shadow: 0 0 0 3px rgba(0, 85, 255, 0.1), 0 0 20px rgba(0, 85, 255, 0.08);
                }

                .user-input:focus + .field-icon,
                .field-wrap:focus-within .field-icon {
                    color: #3b82f6;
                }

                .user-input::placeholder { color: #334155; }

                .pwd-toggle {
                    position: absolute;
                    right: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    color: #475569;
                    cursor: pointer;
                    padding: 4px;
                    transition: color 0.2s;
                    display: flex; align-items: center;
                }
                .pwd-toggle:hover { color: #94a3b8; }

                .user-error {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    background: rgba(239, 68, 68, 0.08);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 12px;
                    padding: 14px 16px;
                    margin-bottom: 20px;
                    color: #fca5a5;
                    font-size: 14px;
                    line-height: 1.5;
                    box-shadow: 0 0 16px rgba(239, 68, 68, 0.08);
                    animation: shakeIn 0.3s ease;
                }

                @keyframes shakeIn {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-4px); }
                    40%, 80% { transform: translateX(4px); }
                }

                .user-submit {
                    width: 100%;
                    padding: 14px;
                    background: linear-gradient(135deg, #0055ff, #003db3);
                    border: none;
                    border-radius: 12px;
                    color: #fff;
                    font-size: 15px;
                    font-weight: 600;
                    font-family: 'Inter', sans-serif;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.2s;
                    box-shadow: 0 4px 24px rgba(0, 85, 255, 0.35), 0 0 0 1px rgba(0, 85, 255, 0.2);
                    margin-top: 8px;
                    letter-spacing: 0.3px;
                }

                .user-submit:hover:not(:disabled) {
                    background: linear-gradient(135deg, #0066ff, #0047cc);
                    box-shadow: 0 6px 32px rgba(0, 85, 255, 0.5), 0 0 0 1px rgba(0, 85, 255, 0.3);
                    transform: translateY(-1px);
                }

                .user-submit:disabled {
                    opacity: 0.65;
                    cursor: not-allowed;
                    transform: none;
                }

                .divider {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    margin: 24px 0;
                }

                .divider-line {
                    flex: 1;
                    height: 1px;
                    background: rgba(255, 255, 255, 0.15);
                }

                .divider-text {
                    color: #64748b;
                    font-size: 13px;
                    font-weight: 500;
                }

                .user-footer {
                    text-align: center;
                    margin-top: 28px;
                    padding-top: 24px;
                    border-top: 1px solid rgba(0, 85, 255, 0.12);
                    font-size: 13px;
                    color: #475569;
                }

                .user-footer a {
                    color: #3b82f6;
                    text-decoration: none;
                    font-weight: 500;
                    transition: color 0.2s;
                }

                .user-footer a:hover { color: #60a5fa; text-decoration: underline; }

                .spin { animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }

                @media (max-width: 480px) {
                    .user-card { padding: 36px 24px; }
                }
            `}</style>

            <div className="user-login-bg">
                <div className="user-card">
                    {/* Icon */}
                    <div className="user-icon-wrap">
                        <Bot size={30} color="#3b82f6" strokeWidth={1.5} />
                    </div>

                    <h1 className="user-title">Welcome Back</h1>
                    <p className="user-subtitle">Sign in to access AI Tourist Assistant</p>

                    {/* Error */}
                    {error && (
                        <div className="user-error">
                            <AlertCircle size={16} style={{ marginTop: '1px', flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} noValidate>
                        {/* Email */}
                        <div className="field-group">
                            <label className="field-label" htmlFor="user-email">Email</label>
                            <div className="field-wrap">
                                <Mail size={16} className="field-icon" />
                                <input
                                    id="user-email"
                                    type="email"
                                    className="user-input"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    autoComplete="email"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="field-group">
                            <label className="field-label" htmlFor="user-password">Password</label>
                            <div className="field-wrap">
                                <Lock size={16} className="field-icon" />
                                <input
                                    id="user-password"
                                    type={showPassword ? 'text' : 'password'}
                                    className="user-input"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    required
                                />
                                <button
                                    type="button"
                                    className="pwd-toggle"
                                    onClick={() => setShowPassword(p => !p)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="user-submit"
                            disabled={loading}
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="divider">
                        <div className="divider-line"></div>
                        <span className="divider-text">or continue with</span>
                        <div className="divider-line"></div>
                    </div>

                    {/* Google Sign-In */}
                    <div id="google-signin-btn" style={{ display: 'flex', justifyContent: 'center', minHeight: '44px' }}></div>

                    <div className="user-footer">
                        <Link to="/forgot-password">Forgot password?</Link>
                        <br /><br />
                        Don't have an account? <Link to="/register">Sign up</Link>
                        <br /><br />
                        <Link to="/admin/login">Admin Login →</Link>
                    </div>
                </div>
            </div>
        </>
    );
};

export default UserLogin;
