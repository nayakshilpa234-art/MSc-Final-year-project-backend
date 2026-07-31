import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';

// ─── view states: 'login' | 'signup' | 'forgot' | 'forgot-sent'
const LoginRegister = () => {
    const [view, setView] = useState('login');
    const [formError, setFormError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [socialLoading, setSocialLoading] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const googleScriptRef = useRef(null);
    const navigate = useNavigate();

    // Form fields
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [forgotEmail, setForgotEmail] = useState('');

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    // ── Password strength
    const getPasswordStrength = (pwd) => {
        if (!pwd) return { score: 0, label: '', color: '' };
        let score = 0;
        if (pwd.length >= 8) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[a-z]/.test(pwd)) score++;
        if (/\d/.test(pwd)) score++;
        if (/[^A-Za-z0-9]/.test(pwd)) score++;
        if (score <= 2) return { score, label: 'Weak', color: '#ef4444' };
        if (score === 3) return { score, label: 'Fair', color: '#f59e0b' };
        if (score === 4) return { score, label: 'Good', color: '#3b82f6' };
        return { score, label: 'Strong', color: '#10b981' };
    };
    const pwdStrength = getPasswordStrength(password);

    // ── Google OAuth
    const handleGoogleResponse = useCallback(async (response) => {
        setSocialLoading('google');
        setFormError('');
        try {
            const base64Url = response.credential.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                window.atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
            );
            const decoded = JSON.parse(jsonPayload);

            const res = await axios.post('/api/auth/social', {
                provider: 'google',
                token: response.credential,
                email: decoded.email,
                name: decoded.name,
                providerId: decoded.sub,
                profilePicture: decoded.picture,
            });

            storeAuthData(res.data);
            navigate(getRoleRedirect(res.data.role));
        } catch (err) {
            setFormError(err?.response?.data?.msg || 'Google login failed. Please try again.');
        } finally {
            setSocialLoading('');
        }
    }, [navigate]);

    useEffect(() => {
        if (!googleClientId) return;
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        googleScriptRef.current = script;
        document.head.appendChild(script);
        script.onload = () => {
            const btnHost = document.getElementById('google-signin-btn');
            if (!window.google?.accounts?.id || !btnHost) return;
            window.google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogleResponse });
            window.google.accounts.id.renderButton(btnHost, {
                theme: 'filled_black', size: 'large',
                width: Math.min(380, window.innerWidth - 80),
                text: 'continue_with', shape: 'pill', logo_alignment: 'left',
            });
        };
        return () => {
            if (googleScriptRef.current?.parentNode) {
                googleScriptRef.current.parentNode.removeChild(googleScriptRef.current);
            }
        };
    }, [googleClientId, handleGoogleResponse, view]);

    function storeAuthData(data) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role || 'user');
        localStorage.setItem('username', data.username || '');
        localStorage.setItem('email', data.email || '');
        if (data.name) localStorage.setItem('name', data.name);
        if (data.profilePicture) localStorage.setItem('profilePicture', data.profilePicture);
        localStorage.removeItem('chatHistory_guest');
        window.dispatchEvent(new Event('authChange'));
    }

    function getRoleRedirect(role) {
        return role === 'admin' ? '/admin/dashboard' : '/';
    }

    function resetForm() {
        setName(''); setEmail(''); setPassword(''); setConfirmPassword('');
        setFormError(''); setSuccessMsg(''); setShowPassword(false); setShowConfirmPassword(false);
    }

    function switchView(v) {
        resetForm();
        setView(v);
    }

    // ── Login
    const handleLogin = async (e) => {
        e.preventDefault();
        setFormError(''); setSubmitting(true);
        try {
            const guestHistoryStr = localStorage.getItem('chatHistory_guest');
            let guestHistory = [];
            if (guestHistoryStr) {
                try { guestHistory = JSON.parse(guestHistoryStr) || []; } catch (_) {}
            }
            const res = await axios.post('/api/auth/login', { email, password, guestHistory });
            storeAuthData(res.data);
            // Role-based redirect: admins go to admin dashboard, users go to chatbot
            navigate(getRoleRedirect(res.data.role));
        } catch (err) {
            setFormError(err?.response?.data?.msg || 'Login failed. Please check your credentials.');
        } finally { setSubmitting(false); }
    };

    // ── Sign Up
    const handleSignUp = async (e) => {
        e.preventDefault();
        setFormError('');
        if (password !== confirmPassword) { setFormError('Passwords do not match.'); return; }
        const strongPwd = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!strongPwd.test(password)) {
            setFormError('Password must be at least 8 characters with uppercase, lowercase and a number.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await axios.post('/api/auth/register', { name, email, password });
            storeAuthData(res.data);
            navigate('/');
        } catch (err) {
            setFormError(err?.response?.data?.msg || 'Sign up failed. Please try again.');
        } finally { setSubmitting(false); }
    };

    // ── Forgot Password
    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setFormError(''); setSubmitting(true);
        try {
            const res = await axios.post('/api/auth/forgot-password', { email: forgotEmail });
            setSuccessMsg(res.data.msg || 'Reset link sent!');
            setView('forgot-sent');
        } catch (err) {
            setFormError(err?.response?.data?.msg || 'Could not send reset email.');
        } finally { setSubmitting(false); }
    };

    // ─────────────────────────────────────────────
    // RENDER HELPERS
    // ─────────────────────────────────────────────
    const InputField = ({ id, label, type, value, onChange, placeholder, icon: Icon, showToggle, onToggle, autoComplete }) => (
        <div style={{ marginBottom: '20px' }}>
            <label htmlFor={id} style={styles.label}>{label}</label>
            <div style={{ position: 'relative' }}>
                {Icon && (
                    <div style={styles.inputIcon}>
                        <Icon size={16} color="rgba(148,163,184,0.7)" />
                    </div>
                )}
                <input
                    id={id}
                    type={type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    required
                    style={{ ...styles.input, paddingLeft: Icon ? '44px' : '16px', paddingRight: showToggle !== undefined ? '44px' : '16px' }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(0,85,255,0.8)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,85,255,0.15), 0 0 20px rgba(0,85,255,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(0,85,255,0.3)'; e.target.style.boxShadow = 'none'; }}
                />
                {showToggle !== undefined && (
                    <button type="button" onClick={onToggle} style={styles.eyeBtn} tabIndex={-1}>
                        {showToggle ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
                    </button>
                )}
            </div>
        </div>
    );

    const ErrorBox = ({ msg }) => msg ? (
        <div style={styles.errorBox} role="alert">{msg}</div>
    ) : null;

    // ─────────────────────────────────────────────
    // VIEWS
    // ─────────────────────────────────────────────

    const renderLoginView = () => (
        <form onSubmit={handleLogin} autoComplete="on">
            <div style={styles.header}>
                <div style={styles.logo}>
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                        <circle cx="18" cy="18" r="18" fill="rgba(0,85,255,0.15)" />
                        <path d="M11 18.5C11 14.91 13.91 12 17.5 12H19V15H17.5C15.57 15 14 16.57 14 18.5S15.57 22 17.5 22H19V25H17.5C13.91 25 11 22.09 11 18.5Z" fill="#0055ff"/>
                        <path d="M25 18.5C25 22.09 22.09 25 18.5 25H17V22H18.5C20.43 22 22 20.43 22 18.5S20.43 15 18.5 15H17V12H18.5C22.09 12 25 14.91 25 18.5Z" fill="#60a5fa"/>
                    </svg>
                </div>
                <h1 style={styles.title}>Welcome back</h1>
                <p style={styles.subtitle}>Sign in to your account</p>
            </div>

            <ErrorBox msg={formError} />

            {/* Google Button */}
            <div style={{ marginBottom: '16px' }}>
                {googleClientId ? (
                    <div id="google-signin-btn" style={{ display: 'flex', justifyContent: 'center', minHeight: '44px' }} />
                ) : (
                    <button type="button" disabled style={{ ...styles.socialBtn, opacity: 0.5, cursor: 'not-allowed' }}>
                        <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/><path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
                        Continue with Google (configure VITE_GOOGLE_CLIENT_ID)
                    </button>
                )}
            </div>

            <div style={styles.divider}><span style={styles.dividerText}>or continue with email</span></div>

            <InputField id="login-email" label="Email address" type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                icon={Mail} autoComplete="email" />
            <InputField id="login-password" label="Password"
                type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="Enter your password"
                icon={Lock} showToggle={showPassword} onToggle={() => setShowPassword(p => !p)}
                autoComplete="current-password" />

            <div style={{ textAlign: 'right', marginBottom: '24px', marginTop: '-12px' }}>
                <button type="button" onClick={() => switchView('forgot')} style={styles.linkBtn}>
                    Forgot password?
                </button>
            </div>

            <button type="submit" disabled={submitting} style={{ ...styles.primaryBtn, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? <><Loader2 size={18} className="spin-icon" style={styles.spinner} /> Signing in...</> : 'Continue'}
            </button>

            <p style={styles.switchText}>
                Don't have an account?{' '}
                <button type="button" onClick={() => switchView('signup')} style={styles.linkBtn}>Sign up</button>
            </p>
        </form>
    );

    const renderSignUpView = () => (
        <form onSubmit={handleSignUp} autoComplete="on">
            <div style={styles.header}>
                <div style={styles.logo}>
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                        <circle cx="18" cy="18" r="18" fill="rgba(0,85,255,0.15)" />
                        <path d="M11 18.5C11 14.91 13.91 12 17.5 12H19V15H17.5C15.57 15 14 16.57 14 18.5S15.57 22 17.5 22H19V25H17.5C13.91 25 11 22.09 11 18.5Z" fill="#0055ff"/>
                        <path d="M25 18.5C25 22.09 22.09 25 18.5 25H17V22H18.5C20.43 22 22 20.43 22 18.5S20.43 15 18.5 15H17V12H18.5C22.09 12 25 14.91 25 18.5Z" fill="#60a5fa"/>
                    </svg>
                </div>
                <h1 style={styles.title}>Create account</h1>
                <p style={styles.subtitle}>Join AI Tourist Assistant today</p>
            </div>

            <ErrorBox msg={formError} />

            {/* Google Sign-Up */}
            <div style={{ marginBottom: '16px' }}>
                {googleClientId ? (
                    <div id="google-signin-btn" style={{ display: 'flex', justifyContent: 'center', minHeight: '44px' }} />
                ) : (
                    <button type="button" disabled style={{ ...styles.socialBtn, opacity: 0.5, cursor: 'not-allowed' }}>
                        <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/><path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
                        Continue with Google (configure VITE_GOOGLE_CLIENT_ID)
                    </button>
                )}
            </div>

            <div style={styles.divider}><span style={styles.dividerText}>or sign up with email</span></div>

            <InputField id="signup-name" label="Full name" type="text" value={name}
                onChange={e => setName(e.target.value)} placeholder="Your full name"
                icon={User} autoComplete="name" />
            <InputField id="signup-email" label="Email address" type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                icon={Mail} autoComplete="email" />
            <InputField id="signup-password" label="Password"
                type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="Create a strong password"
                icon={Lock} showToggle={showPassword} onToggle={() => setShowPassword(p => !p)}
                autoComplete="new-password" />

            {/* Password strength meter */}
            {password && (
                <div style={{ marginBottom: '16px', marginTop: '-12px' }}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                        {[1,2,3,4,5].map(i => (
                            <div key={i} style={{
                                flex: 1, height: '3px', borderRadius: '4px',
                                background: i <= pwdStrength.score ? pwdStrength.color : 'rgba(255,255,255,0.1)',
                                transition: 'background 0.3s',
                            }} />
                        ))}
                    </div>
                    <span style={{ fontSize: '12px', color: pwdStrength.color }}>{pwdStrength.label}</span>
                </div>
            )}

            <InputField id="signup-confirm" label="Confirm password"
                type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm your password"
                icon={Lock} showToggle={showConfirmPassword} onToggle={() => setShowConfirmPassword(p => !p)}
                autoComplete="new-password" />

            <button type="submit" disabled={submitting} style={{ ...styles.primaryBtn, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? <><Loader2 size={18} style={styles.spinner} /> Creating account...</> : 'Create account'}
            </button>

            <p style={styles.switchText}>
                Already have an account?{' '}
                <button type="button" onClick={() => switchView('login')} style={styles.linkBtn}>Log in</button>
            </p>
        </form>
    );

    const renderForgotView = () => (
        <form onSubmit={handleForgotPassword} autoComplete="on">
            <div style={styles.header}>
                <button type="button" onClick={() => switchView('login')} style={styles.backBtn}>
                    <ArrowLeft size={18} /> Back to login
                </button>
                <h1 style={{ ...styles.title, marginTop: '20px' }}>Reset password</h1>
                <p style={styles.subtitle}>Enter your email and we'll send you a reset link</p>
            </div>

            <ErrorBox msg={formError} />

            <InputField id="forgot-email" label="Email address" type="email" value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)} placeholder="you@example.com"
                icon={Mail} autoComplete="email" />

            <button type="submit" disabled={submitting} style={{ ...styles.primaryBtn, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? <><Loader2 size={18} style={styles.spinner} /> Sending...</> : 'Send reset link'}
            </button>
        </form>
    );

    const renderForgotSentView = () => (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={styles.successIcon}>
                <CheckCircle size={48} color="#10b981" />
            </div>
            <h2 style={{ ...styles.title, marginBottom: '12px' }}>Check your email</h2>
            <p style={{ color: '#94a3b8', lineHeight: 1.6, marginBottom: '8px' }}>
                We've sent a password reset link to:
            </p>
            <p style={{ color: '#60a5fa', fontWeight: '600', marginBottom: '24px' }}>{forgotEmail}</p>
            <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.6, marginBottom: '32px' }}>
                Click the link in the email to reset your password.
                The link expires in <strong style={{ color: '#94a3b8' }}>1 hour</strong>.
            </p>
            <button type="button" onClick={() => switchView('login')} style={styles.primaryBtn}>
                Back to login
            </button>
        </div>
    );

    return (
        <div style={styles.page}>
            {/* Animated background */}
            <div style={styles.bgGlow1} />
            <div style={styles.bgGlow2} />

            <div style={styles.card} className="auth-card-anim">
                {view === 'login' && renderLoginView()}
                {view === 'signup' && renderSignUpView()}
                {view === 'forgot' && renderForgotView()}
                {view === 'forgot-sent' && renderForgotSentView()}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = {
    page: {
        minHeight: '100vh',
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
    },
    bgGlow1: {
        position: 'fixed', top: '-200px', left: '-200px',
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(0,85,255,0.08) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
    },
    bgGlow2: {
        position: 'fixed', bottom: '-200px', right: '-200px',
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
    },
    card: {
        width: '100%',
        maxWidth: '420px',
        background: 'rgba(8, 12, 24, 0.95)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(0, 85, 255, 0.25)',
        borderRadius: '20px',
        padding: '40px 36px',
        boxShadow: '0 0 0 1px rgba(0,85,255,0.1), 0 8px 40px rgba(0,0,0,0.6), 0 0 60px rgba(0,85,255,0.08)',
        position: 'relative',
        zIndex: 1,
    },
    header: { textAlign: 'center', marginBottom: '28px' },
    logo: { display: 'flex', justifyContent: 'center', marginBottom: '16px' },
    title: {
        fontSize: '26px', fontWeight: '700', color: '#f8fafc',
        marginBottom: '8px', letterSpacing: '-0.5px',
    },
    subtitle: { color: '#64748b', fontSize: '15px' },
    label: {
        display: 'block', marginBottom: '8px', fontSize: '14px',
        fontWeight: '500', color: '#94a3b8',
    },
    input: {
        width: '100%',
        padding: '13px 16px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(0,85,255,0.3)',
        borderRadius: '10px',
        color: '#f1f5f9',
        fontSize: '15px',
        fontFamily: 'Inter, sans-serif',
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxSizing: 'border-box',
    },
    inputIcon: {
        position: 'absolute', left: '14px', top: '50%',
        transform: 'translateY(-50%)', pointerEvents: 'none',
    },
    eyeBtn: {
        position: 'absolute', right: '12px', top: '50%',
        transform: 'translateY(-50%)', background: 'none', border: 'none',
        cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
    },
    primaryBtn: {
        width: '100%',
        padding: '14px',
        background: 'linear-gradient(135deg, #0055ff, #003db3)',
        color: '#fff',
        border: 'none',
        borderRadius: '10px',
        fontSize: '15px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        marginBottom: '20px',
        boxShadow: '0 4px 20px rgba(0,85,255,0.3)',
        fontFamily: 'Inter, sans-serif',
    },
    socialBtn: {
        width: '100%',
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '10px',
        color: '#e2e8f0',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        transition: 'all 0.2s',
        fontFamily: 'Inter, sans-serif',
    },
    divider: {
        display: 'flex', alignItems: 'center',
        margin: '0 0 20px 0', gap: '12px',
    },
    dividerText: {
        color: '#475569', fontSize: '13px', fontWeight: '500',
        whiteSpace: 'nowrap', position: 'relative',
        padding: '0 4px',
        '&::before': { content: '""', flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' },
    },
    linkBtn: {
        background: 'none', border: 'none',
        color: '#3b82f6', fontSize: '14px', fontWeight: '500',
        cursor: 'pointer', textDecoration: 'none',
        padding: '0', fontFamily: 'Inter, sans-serif',
        transition: 'color 0.2s',
    },
    switchText: {
        textAlign: 'center', color: '#64748b',
        fontSize: '14px', marginTop: '4px',
    },
    errorBox: {
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.35)',
        color: '#fca5a5',
        borderRadius: '10px',
        padding: '12px 14px',
        fontSize: '14px',
        lineHeight: '1.5',
        marginBottom: '18px',
    },
    backBtn: {
        background: 'none', border: 'none', color: '#64748b',
        fontSize: '14px', cursor: 'pointer', display: 'flex',
        alignItems: 'center', gap: '6px', fontFamily: 'Inter, sans-serif',
        padding: '0', margin: '0 auto',
        transition: 'color 0.2s',
    },
    successIcon: {
        display: 'flex', justifyContent: 'center', marginBottom: '24px',
        animation: 'fadeInUp 0.4s ease',
    },
    spinner: { animation: 'spin 1s linear infinite' },
};

export default LoginRegister;
