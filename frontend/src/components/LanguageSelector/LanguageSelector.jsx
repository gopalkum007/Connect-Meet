import React from 'react';

const LANGUAGES = [
  { code: 'auto', name: 'Auto Detect Language 🔍' },
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi (हिन्दी)' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'ar', name: 'Arabic (العربية)' },
  { code: 'zh', name: 'Chinese (中文)' },
  { code: 'ja', name: 'Japanese (日本語)' },
  { code: 'ko', name: 'Korean (한국어)' },
  { code: 'ru', name: 'Russian (Русский)' },
  { code: 'pt', name: 'Portuguese (Português)' },
  { code: 'it', name: 'Italian (Italiano)' },
  { code: 'ta', name: 'Tamil (தமிழ்)' },
  { code: 'te', name: 'Telugu (తెలుగు)' },
  { code: 'bn', name: 'Bengali (বাংলা)' },
  { code: 'gu', name: 'Gujarati (ગુજરાતી)' },
  { code: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'ml', name: 'Malayalam (മലയാളം)' },
  { code: 'kn', name: 'Kannada (ಕನ್ನಡ)' },
  { code: 'mr', name: 'Marathi (मराठी)' },
  { code: 'ur', name: 'Urdu (اردو)' }
];

const LanguageSelector = ({ value, onChange, style = {}, selectStyle = {}, label = 'Select Language' }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', ...style }}>
      {label && <label style={{ fontSize: '0.8rem', color: '#9CA3AF', fontWeight: 600 }}>{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: '#030712',
          border: '1px solid #374151',
          borderRadius: 'var(--radius-md)',
          color: '#F8FAFC',
          fontSize: '0.95rem',
          outline: 'none',
          cursor: 'pointer',
          ...selectStyle
        }}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>{lang.name}</option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;
export { LANGUAGES };
