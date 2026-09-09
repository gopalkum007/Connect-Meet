import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button.jsx';
import { HelpCircle } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      textAlign: 'center',
      background: 'var(--background)'
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '48px 36px',
        maxWidth: '460px',
        width: '100%',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }} className="scale-up">
        <div style={{
          color: 'var(--primary)',
          marginBottom: '28px',
          display: 'inline-flex',
          padding: '24px',
          background: 'rgba(99, 102, 241, 0.08)',
          borderRadius: '50%',
          boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)'
        }}>
          <HelpCircle size={64} style={{ color: 'var(--primary)' }} />
        </div>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em', color: 'var(--text)' }}>404</h1>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text)' }}>Page Not Found</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 32px 0' }}>
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
        <Button variant="primary" style={{ padding: '12px 30px', borderRadius: '30px', fontWeight: 700 }} onClick={() => navigate('/home')}>Return to Safety</Button>
      </div>
    </div>
  );
};

export default NotFound;
