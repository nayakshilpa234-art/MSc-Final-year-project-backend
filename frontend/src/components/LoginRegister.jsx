import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { getAuthErrorMessage } from '../utils/authError';

const LoginRegister = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [socialLoading, setSocialLoading] = useState('');
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const googleScriptRef = useRef(null);
    const navigate = useNavigate();

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    const handleGoogleResponse = useCallback(async (response) => {
        setSocialLoading('google');
        setFormError('');
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
                providerId: decoded.sub
            });

            localStorage.setItem('token', res.data.token);
            localStorage.setItem('username', res.data.username);
            localStorage.removeItem('chatHistory_guest');
            window.dispatchEvent(new Event('authChange'));
            navigate('/');
        } catch (err) {
            setFormError(getAuthErrorMessage(err, 'Google login failed'));
        } finally {
            setSocialLoading('');
        }
    }, [navigate]);

    // Load Google Identity Services script (optional — email/password still works without it)
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
            });
        };

        return () => {
            if (googleScriptRef.current?.parentNode) {
                googleScriptRef.current.parentNode.removeChild(googleScriptRef.current);
            }
        };
    }, [googleClientId, handleGoogleResponse]);

    const handleAppleLogin = async () => {
        setSocialLoading('apple');
        try {
            // Check if Apple JS SDK is available
            if (window.AppleID) {
                const data = await window.AppleID.auth.signIn();
                const res = await axios.post('/api/auth/social', {
                    provider: 'apple',
                    token: data.authorization.id_token,
                    email: data.user?.email || `apple_${data.authorization.code.substring(0, 8)}@privaterelay.apple.com`,
                    name: data.user?.name ? `${data.user.name.firstName} ${data.user.name.lastName}` : null,
                    providerId: data.authorization.code
                });

                localStorage.setItem('token', res.data.token);
                localStorage.setItem('username', res.data.username);
                localStorage.removeItem('chatHistory_guest');
                window.dispatchEvent(new Event('authChange'));
                navigate('/');
            } else {
                alert('Apple Sign-In is not available. Please use a supported browser (Safari) or try Google login.');
            }
        } catch (err) {
            if (err.error !== 'popup_closed_by_user') {
                setFormError(getAuthErrorMessage(err, 'Apple login failed'));
            }
        } finally {
            setSocialLoading('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        setSubmitting(true);

        const trimmedUsername = username.trim();
        const trimmedEmail = email.trim();
        const trimmedPassword = password;

        if (!trimmedUsername || !trimmedPassword) {
            setFormError('Username and password are required.');
            setSubmitting(false);
            return;
        }
        if (!isLogin && !trimmedEmail) {
            setFormError('Email is required to register.');
            setSubmitting(false);
            return;
        }

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

            const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
            const payload = isLogin
                ? { username: trimmedUsername, password: trimmedPassword, guestHistory }
                : { username: trimmedUsername, email: trimmedEmail, password: trimmedPassword, guestHistory };

            const res = await axios.post(endpoint, payload);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('username', res.data.username);
            localStorage.removeItem('chatHistory_guest');
            window.dispatchEvent(new Event('authChange'));

            if (res.data.role === 'admin') {
                navigate('/admin/dashboard/destinations');
            } else {
                navigate('/');
            }
        } catch (err) {
            setFormError(getAuthErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="glass-panel" style={{ maxWidth: '420px', margin: '60px auto', padding: '40px' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '10px', fontSize: '24px' }}>
                {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p style={{ textAlign: 'center', marginBottom: '30px', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => { setIsLogin(!isLogin); setFormError(''); }}>
                {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
            </p>

            {formError && (
                <div role="alert" style={{
                    marginBottom: '16px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#fecaca',
                    fontSize: '14px',
                    lineHeight: 1.4,
                }}>
                    {formError}
                </div>
            )}

            {/* Social Login Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '25px' }}>
                {/* Google Sign-In Button Container */}
                <div id="google-signin-btn" style={{ display: 'flex', justifyContent: 'center', minHeight: '44px' }}></div>

                {/* Apple Sign-In Button */}
                <button
                    onClick={handleAppleLogin}
                    disabled={socialLoading === 'apple'}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '24px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        background: '#000',
                        color: '#fff',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: socialLoading === 'apple' ? 'wait' : 'pointer',
                        transition: 'all 0.3s',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        opacity: socialLoading === 'apple' ? 0.7 : 1,
                    }}
                    onMouseEnter={e => { if (socialLoading !== 'apple') e.currentTarget.style.background = '#333'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#000'; }}
                >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M14.94 4.92c-.09.07-1.67.96-1.67 2.95 0 2.3 2.01 3.11 2.07 3.13-.01.06-.32 1.1-1.06 2.18-.65.95-1.33 1.89-2.39 1.89s-1.32-.62-2.53-.62c-1.18 0-1.6.64-2.58.64s-1.63-.88-2.4-1.95C3.21 11.45 2.4 9.2 2.4 7.08c0-3.39 2.2-5.19 4.37-5.19 1.15 0 2.11.76 2.83.76.69 0 1.77-.8 3.08-.8.5 0 2.28.05 3.26 1.07zm-3.85-1.96c.48-.57.82-1.36.82-2.16 0-.11-.01-.22-.03-.31-.78.03-1.71.52-2.27 1.17-.44.5-.85 1.29-.85 2.09 0 .12.02.24.03.28.05.01.14.02.22.02.7 0 1.59-.47 2.08-1.09z" fill="white"/>
                    </svg>
                    {socialLoading === 'apple' ? 'Signing in...' : 'Continue with Apple'}
                </button>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.15)' }}></div>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.15)' }}></div>
            </div>

            {/* Traditional Login Form */}
            <form onSubmit={handleSubmit} autoComplete="on">
                <div className="form-group">
                    <label htmlFor="auth-username">Username</label>
                    <input
                        id="auth-username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        required
                    />
                </div>
                {!isLogin && (
                    <div className="form-group">
                        <label htmlFor="auth-email">Email Address</label>
                        <input
                            id="auth-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            inputMode="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                )}
                <div className="form-group">
                    <label htmlFor="auth-password">Password</label>
                    <input
                        id="auth-password"
                        name="password"
                        type="password"
                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-accent"
                    style={{ width: '100%', borderRadius: '24px', padding: '12px', fontSize: '15px', fontWeight: '600', opacity: submitting ? 0.7 : 1 }}
                >
                    {submitting ? 'Please wait...' : (isLogin ? 'Login' : 'Register')}
                </button>
            </form>
        </div>
    );
};

export default LoginRegister;
