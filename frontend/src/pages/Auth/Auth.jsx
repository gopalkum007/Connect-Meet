import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Navbar from '../../components/layout/Navbar.jsx';
import Footer from '../../components/layout/Footer.jsx';
import Card from '../../components/common/Card.jsx';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import { Video, User, Mail, Lock, ArrowRight, ShieldCheck, Cpu, CheckCircle2 } from 'lucide-react';
import { forgotPassword } from '../../api/auth.api.js';

const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const { handleLogin, handleRegister } = useAuth();
  const { addToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Forgot Password modal states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const {
    register: loginRegister,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors, isSubmitting: loginSubmitting },
    reset: resetLoginForm
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const {
    register: registerRegister,
    handleSubmit: handleRegisterSubmit,
    formState: { errors: registerErrors, isSubmitting: registerSubmitting },
    reset: resetRegisterForm
  } = useForm({
    resolver: zodResolver(registerSchema),
  });

  // Consume signup / password reset state passed via React Router state
  useEffect(() => {
    if (location.state?.prefillUsername || location.state?.prefillPassword || location.state?.signupSuccessMessage) {
      setIsLogin(true);
      setApiError('');
      if (location.state.prefillUsername) {
        resetLoginForm({
          username: location.state.prefillUsername,
          password: location.state.prefillPassword || ''
        });
      }
      if (location.state.signupSuccessMessage) {
        setSuccessMessage(location.state.signupSuccessMessage);
        addToast(location.state.signupSuccessMessage, 'success');
      }
      // Immediately clear state from window history so refresh will NOT retain temporary credentials
      window.history.replaceState({}, document.title);
    } else if (location.state?.resetSuccessMessage) {
      setIsLogin(true);
      setApiError('');
      setSuccessMessage(location.state.resetSuccessMessage);
      addToast(location.state.resetSuccessMessage, 'success');
      if (location.state.prefillUsername) {
        resetLoginForm({
          username: location.state.prefillUsername,
          password: ''
        });
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state, resetLoginForm, addToast]);

  const onLoginSubmit = async (data) => {
    setApiError('');
    try {
      await handleLogin(data.username, data.password);
      addToast('Welcome back!', 'success');
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid username or password';
      setApiError(msg);
      addToast(msg, 'error');
    }
  };

  const onRegisterSubmit = async (data) => {
    setApiError('');
    setSuccessMessage('');
    try {
      await handleRegister(data.name, data.username, data.password);
      resetRegisterForm();
      // Redirect to login using React Router state with credentials pre-filled
      // Does NOT store in localStorage/sessionStorage
      navigate('/auth', {
        state: {
          prefillUsername: data.username,
          prefillPassword: data.password,
          signupSuccessMessage: 'Account created successfully. Please sign in.'
        },
        replace: true
      });
    } catch (err) {
      console.error('Registration API Error:', err);
      const msg = err.response?.data?.message || 'User registration failed';
      setApiError(msg);
      addToast(msg, 'error');
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) {
      setForgotError('Please enter your email or username');
      return;
    }
    setForgotError('');
    setForgotLoading(true);
    try {
      await forgotPassword(forgotIdentifier.trim());
      setForgotSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to request password reset. Please try again.';
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--background)' }}>
      <Navbar />

      <div style={{
        flex: 1,
        display: 'flex',
        background: 'var(--background)',
      }}>
        {/* Inline style for split screen layout responsiveness */}
        <style>{`
          .auth-container {
            display: flex;
            width: 100%;
            min-height: 100%;
          }
          .auth-sidebar {
            display: none;
            flex: 1.1;
            background: linear-gradient(135deg, #090D1A 0%, #111827 100%);
            padding: 60px;
            color: #ffffff;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            overflow: hidden;
            border-right: 1px solid rgba(255,255,255,0.05);
          }
          .auth-form-side {
            flex: 0.9;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: clamp(24px, 4vw, 40px) clamp(12px, 3vw, 24px);
            background: radial-gradient(circle at center, rgba(14, 113, 235, 0.04), transparent 75%);
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }
          @media (min-width: 900px) {
            .auth-sidebar {
              display: flex;
            }
          }
          .auth-mesh {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle at 80% 20%, rgba(14, 113, 235, 0.15), transparent 50%),
                        radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.12), transparent 50%);
            z-index: 1;
          }
          .auth-sidebar-content {
            position: relative;
            z-index: 2;
            display: flex;
            flex-direction: column;
            gap: 28px;
            max-width: 480px;
            margin: auto 0;
          }
          .auth-sidebar-footer {
            position: relative;
            z-index: 2;
            color: #6B7280;
            font-size: 0.85rem;
          }
        `}</style>

        <div className="auth-container">
          {/* Left Side: Premium Brand Showcase */}
          <div className="auth-sidebar">
            <div className="auth-mesh"></div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ffffff', position: 'relative', zIndex: 2 }}>
              <img src="/logo.png" alt="Connect Meet Logo" style={{ height: '42px', objectFit: 'contain' }} />
              <span style={{ fontWeight: 800, fontSize: '1.35rem', color: '#ffffff' }}>Connect Meet</span>
            </div>


            <div className="auth-sidebar-content">
              <h1 style={{ fontSize: '2.8rem', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em' }}>
                Collaborate without <br />
                <span style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>language barriers.</span>
              </h1>
              <p style={{ color: '#9CA3AF', fontSize: '1.1rem', lineHeight: 1.6, margin: 0 }}>
                Secure, enterprise-grade WebRTC conferences powered by high-performance neural translation services.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ color: 'var(--primary)' }}><ShieldCheck size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Secure Signaling Engine</div>
                    <div style={{ color: '#9CA3AF', fontSize: '0.8rem', marginTop: '2px' }}>Real-time cryptographic handshakes via Socket.io tunnels.</div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ color: 'var(--secondary)' }}><Cpu size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Real-Time Neural Translation</div>
                    <div style={{ color: '#9CA3AF', fontSize: '0.8rem', marginTop: '2px' }}>High-fidelity translation arrays detecting languages on-the-fly.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="auth-sidebar-footer">
              © {new Date().getFullYear()} Connect Meet. All rights reserved.
            </div>
          </div>

          {/* Right Side: Form */}
          <div className="auth-form-side">
            <Card style={{ width: '100%', maxWidth: '420px', padding: 'clamp(20px, 4vw, 36px)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', boxSizing: 'border-box' }} className="fade-in">
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                  {isLogin ? 'Sign in to Connect Meet' : 'Create an Account'}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px' }}>
                  {isLogin ? 'Welcome back! Enter your workspace details.' : 'Start high fidelity meetings today.'}
                </p>
              </div>

              {/* Toggle Tabs */}
              <div style={{
                display: 'flex',
                background: 'var(--background)',
                padding: '4px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '28px',
                border: '1px solid var(--border)'
              }}>
                <button
                  type="button"
                  onClick={() => { setIsLogin(true); setApiError(''); setSuccessMessage(''); }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: 'none',
                    background: isLogin ? 'var(--surface)' : 'transparent',
                    color: isLogin ? 'var(--text)' : 'var(--text-muted)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    boxShadow: isLogin ? 'var(--shadow)' : 'none',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setIsLogin(false); setApiError(''); setSuccessMessage(''); }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: 'none',
                    background: !isLogin ? 'var(--surface)' : 'transparent',
                    color: !isLogin ? 'var(--text)' : 'var(--text-muted)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    boxShadow: !isLogin ? 'var(--shadow)' : 'none',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  Sign Up
                </button>
              </div>

              {/* Success Message Banner (e.g. Account created successfully / Password reset) */}
              {successMessage && (
                <div style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#22c55e',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.86rem',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontWeight: 600,
                  lineHeight: 1.4
                }}>
                  <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                  <span>{successMessage}</span>
                </div>
              )}

              {apiError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: 'var(--error)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  marginBottom: '20px',
                  textAlign: 'center',
                  fontWeight: 500
                }}>
                  {apiError}
                </div>
              )}

              {/* Form rendering */}
              {isLogin ? (
                <form onSubmit={handleLoginSubmit(onLoginSubmit)} noValidate>
                  <Input
                    label="Username"
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    placeholder="Enter your username"
                    iconLeft={<User size={18} />}
                    error={loginErrors.username?.message}
                    {...loginRegister('username')}
                  />
                  <Input
                    label="Password"
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    iconLeft={<Lock size={18} />}
                    error={loginErrors.password?.message}
                    {...loginRegister('password')}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" style={{ accentColor: 'var(--primary)', width: '15px', height: '15px' }} /> Remember me
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotError('');
                        setForgotSuccess(false);
                        setShowForgotModal(true);
                      }}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <Button type="submit" variant="primary" loading={loginSubmitting} width="100%" style={{ padding: '12px 20px', borderRadius: '30px', fontWeight: 700 }}>
                    Sign In <ArrowRight size={16} style={{ marginLeft: '6px' }} />
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit(onRegisterSubmit)} noValidate>
                  <Input
                    label="Full Name"
                    id="register-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Enter full name"
                    iconLeft={<User size={18} />}
                    error={registerErrors.name?.message}
                    {...registerRegister('name')}
                  />
                  <Input
                    label="Username"
                    id="register-username"
                    type="text"
                    autoComplete="username"
                    placeholder="Choose a username"
                    iconLeft={<Mail size={18} />}
                    error={registerErrors.username?.message}
                    {...registerRegister('username')}
                  />
                  <Input
                    label="Password"
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Create your password (min. 6 characters)"
                    iconLeft={<Lock size={18} />}
                    error={registerErrors.password?.message}
                    {...registerRegister('password')}
                  />
                  <Button type="submit" variant="primary" loading={registerSubmitting} width="100%" style={{ marginTop: '16px', padding: '12px 20px', borderRadius: '30px', fontWeight: 700 }}>
                    Register Account <ArrowRight size={16} style={{ marginLeft: '6px' }} />
                  </Button>
                </form>
              )}

              <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                Connect Meet is an independent video conferencing platform.
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={showForgotModal}
        onClose={() => {
          setShowForgotModal(false);
          setForgotIdentifier('');
          setForgotError('');
          setForgotSuccess(false);
        }}
        title="Reset Password"
      >
        {forgotSuccess ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              border: '1px solid rgba(34, 197, 94, 0.3)'
            }}>
              <CheckCircle2 size={26} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 10px', color: 'var(--text)' }}>
              Check Your Inbox
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '24px' }}>
              If an account exists for <strong>{forgotIdentifier}</strong>, a password reset link has been sent. Please check your email inbox and spam folder. The link is valid for 15 minutes.
            </p>
            <Button
              variant="primary"
              width="100%"
              onClick={() => {
                setShowForgotModal(false);
                setForgotIdentifier('');
                setForgotSuccess(false);
              }}
              style={{ borderRadius: '30px', fontWeight: 700, padding: '12px' }}
            >
              Back to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleForgotSubmit}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '20px', marginTop: 0 }}>
              Enter your registered email address or username. We will send you a secure password reset link.
            </p>

            {forgotError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--error)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                marginBottom: '16px'
              }}>
                {forgotError}
              </div>
            )}

            <Input
              label="Email or Username"
              id="forgot-identifier"
              type="text"
              autoComplete="username"
              placeholder="Enter your email or username"
              iconLeft={<Mail size={18} />}
              value={forgotIdentifier}
              onChange={(e) => {
                setForgotIdentifier(e.target.value);
                if (forgotError) setForgotError('');
              }}
            />

            <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotIdentifier('');
                  setForgotError('');
                }}
                style={{ flex: 1, borderRadius: '30px', fontWeight: 600, padding: '10px' }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={forgotLoading}
                style={{ flex: 1.3, borderRadius: '30px', fontWeight: 700, padding: '10px' }}
              >
                Send Reset Link
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Footer />
    </div>
  );
};

export default Auth;
