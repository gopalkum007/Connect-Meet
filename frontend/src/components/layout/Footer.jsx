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
      </div>

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        borderTop: '1px solid var(--border)',
        paddingTop: '24px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.85rem'
      }}>
        © {new Date().getFullYear()} Connect Meet. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
