import React from 'react';

const TranslationToggle = ({ value, onChange, style = {} }) => {
  const options = [
    { id: 'both', label: 'Show Both' },
    { id: 'translated', label: 'Translation Only' },
    { id: 'original', label: 'Original Only' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', ...style }}>
      <label style={{ fontSize: '0.85rem', color: '#9CA3AF', fontWeight: 600 }}>Translation Display</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              padding: '8px 4px',
              background: value === opt.id ? 'var(--primary-light)' : 'transparent',
              color: value === opt.id ? 'var(--primary)' : 'var(--text)',
              border: `1px solid ${value === opt.id ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'center'
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TranslationToggle;
