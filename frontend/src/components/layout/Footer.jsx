import React from 'react';
import { Video } from 'lucide-react';

const Footer = () => {
  return (
    <footer style={{
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      padding: '48px 24px 24px',
      marginTop: 'auto'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="Connect Meet Logo" style={{ height: '36px', objectFit: 'contain' }} />
          <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text)' }}>Connect Meet</span>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
          A premium, secure, and modern video conferencing application designed for high quality communication.
        </p>

        {/* Developer Credits */}
        <div style={{
          marginTop: '8px',
          padding: '12px 20px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700 }}>
            Developed By
          </span>
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', textAlign: 'center', wordBreak: 'break-word' }}>
            Gopal Kumar &amp; Bhaskar Kumar
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
            Computer Science &amp; Engineering
          </span>
        </div>
      </div>

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        borderTop: '1px solid var(--border)',
        paddingTop: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
        textAlign: 'center'
      }}>
        <div style={{ margin: '0 auto' }}>
          © {new Date().getFullYear()} Connect Meet. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
