import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Lock, ArrowRight, CheckCircle2, AlertCircle, KeyRound, ShieldCheck } from 'lucide-react';
import Navbar from '../../components/layout/Navbar.jsx';
import Footer from '../../components/layout/Footer.jsx';
import Card from '../../components/common/Card.jsx';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { verifyResetToken, resetPassword } from '../../api/auth.api.js';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenStatus, setTokenStatus] = useState({ valid: null, username: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    let isMounted = true;

    const checkToken = async () => {
      if (!token) {
        if (isMounted) {
          setTokenStatus({ valid: false, username: '' });
          setErrorMsg('No password reset token provided. Please request a new link.');
          setIsVerifying(false);
        }
        return;
      }

      try {
        const data = await verifyResetToken(token);
        if (isMounted) {
          if (data.valid) {
            setTokenStatus({ valid: true, username: data.username || '' });
          } else {
            setTokenStatus({ valid: false, username: '' });
            setErrorMsg(data.message || 'This reset link is invalid or has expired.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setTokenStatus({ valid: false, username: '' });
          setErrorMsg(err.response?.data?.message || 'This password reset link is invalid or has expired.');
        }
      } finally {
        if (isMounted) setIsVerifying(false);
      }
    };

    checkToken();
    return () => { isMounted = false; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const errors = {};

    if (!newPassword) {
      errors.newPassword = 'New password is required';
    } else if (newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters long';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      addToast('Password reset successfully. Please sign in.', 'success');
      navigate('/auth', {
        state: {
          resetSuccessMessage: 'Password reset successfully. Please sign in.',
          prefillUsername: tokenStatus.username || ''
        },
        replace: true
      });
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reset password. Please try again.';
      setErrorMsg(msg);
      addToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--background)' }}>
      <Navbar />

      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(24px, 4vw, 48px) clamp(16px, 3vw, 24px)',
        background: 'radial-gradient(circle at center, rgba(14, 113, 235, 0.05), transparent 70%)'
      }}>
        <Card style={{ width: '100%', maxWidth: '440px', padding: 'clamp(24px, 4vw, 40px)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }} className="fade-in">
          
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(37, 99, 235, 0.1)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              border: '1px solid rgba(37, 99, 235, 0.2)'
            }}>
              <KeyRound size={26} />
            </div>
            <h2 style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
              Set New Password
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '6px', lineHeight: 1.5 }}>
              {tokenStatus.username ? (
                <>Resetting password for account <strong>{tokenStatus.username}</strong></>
              ) : (
                'Choose a strong password with at least 6 characters.'
              )}
            </p>
          </div>

          {isVerifying ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid rgba(99, 102, 241, 0.1)',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 12px'
              }}></div>
              <p style={{ fontSize: '0.9rem' }}>Verifying reset token security...</p>
            </div>
          ) : tokenStatus.valid === false ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--error)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.88rem',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                textAlign: 'left'
              }}>
                <AlertCircle size={22} style={{ flexShrink: 0 }} />
                <span>{errorMsg || 'This password reset link is invalid or has expired.'}</span>
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
                Reset links are only valid for 15 minutes for your security.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Link to="/auth" style={{ textDecoration: 'none' }}>
                  <Button variant="primary" width="100%" style={{ borderRadius: '30px', fontWeight: 700, padding: '12px' }}>
                    Request New Reset Link
                  </Button>
                </Link>
                <Link to="/auth" style={{ textDecoration: 'none' }}>
                  <Button variant="outline" width="100%" style={{ borderRadius: '30px', fontWeight: 600, padding: '10px' }}>
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {errorMsg && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: 'var(--error)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  marginBottom: '18px',
                  textAlign: 'center',
                  fontWeight: 500
                }}>
                  {errorMsg}
                </div>
              )}

              <Input
                label="New Password"
                id="reset-new-password"
                type="password"
                autoComplete="new-password"
                placeholder="Enter new password (min. 6 chars)"
                iconLeft={<Lock size={18} />}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (fieldErrors.newPassword) setFieldErrors(prev => ({ ...prev, newPassword: '' }));
                }}
                error={fieldErrors.newPassword}
              />

              <Input
                label="Confirm New Password"
                id="reset-confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                iconLeft={<ShieldCheck size={18} />}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) setFieldErrors(prev => ({ ...prev, confirmPassword: '' }));
                }}
                error={fieldErrors.confirmPassword}
              />

              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                width="100%"
                style={{ marginTop: '12px', padding: '12px 20px', borderRadius: '30px', fontWeight: 700 }}
              >
                Reset Password <ArrowRight size={16} style={{ marginLeft: '6px' }} />
              </Button>

              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <Link to="/auth" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 }}>
                  ← Back to Sign In
                </Link>
              </div>
            </form>
          )}

        </Card>
      </div>

      <Footer />
    </div>
  );
};

export default ResetPassword;
