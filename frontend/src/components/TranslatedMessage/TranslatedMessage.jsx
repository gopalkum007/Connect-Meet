import React from 'react';
import { Globe, ArrowRight } from 'lucide-react';

/**
 * Component that displays a message dynamically translating its contents 
 * based on recipient settings.
 */
const TranslatedMessage = ({ text, translation, isMe, style = {} }) => {
  if (!translation) {
    return <span style={{ fontSize: '0.92rem', ...style }}>{text}</span>;
  }

  const hasTranslation = Boolean(
    translation.translatedMessage && 
    translation.translatedMessage.trim() !== '' && 
    translation.translatedMessage.toLowerCase() !== text.toLowerCase() &&
    translation.translatedMessage !== "Translation unavailable"
  );
  const autoTranslate = localStorage.getItem('setting_auto_translate') !== 'false';
  const displayMode = localStorage.getItem('setting_translation_display') || 'both';

  const showBoth = autoTranslate && displayMode === 'both' && hasTranslation;
  const showTransOnly = autoTranslate && displayMode === 'translated' && hasTranslation;
  const showOriginalOnly = !autoTranslate || displayMode === 'original' || !hasTranslation;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', ...style }}>
      {showOriginalOnly && <span style={{ fontSize: '0.92rem', lineHeight: 1.4 }}>{text}</span>}
      {showTransOnly && (
        <span style={{ color: 'var(--secondary)', fontStyle: 'italic', fontWeight: 500, fontSize: '0.92rem', lineHeight: 1.4 }}>
          {translation.translatedMessage}
        </span>
      )}
      {showBoth && (
        <>
          <span style={{ fontSize: '0.92rem', opacity: 0.95, lineHeight: 1.4 }}>{text}</span>
          <div style={{
            fontSize: '0.88rem',
            lineHeight: 1.4,
            fontWeight: 500,
            color: 'var(--secondary)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: '6px',
            marginTop: '2px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px'
          }}>
            <Globe size={13} style={{ marginTop: '3px', flexShrink: 0, opacity: 0.7 }} />
            <span style={{ fontStyle: 'italic' }}>{translation.translatedMessage}</span>
          </div>
        </>
      )}
      
      {autoTranslate && hasTranslation && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '0.68rem',
          fontWeight: 700,
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.15)',
          color: 'var(--secondary)',
          padding: '2px 8px',
          borderRadius: '20px',
          alignSelf: 'flex-start',
          marginTop: '2px',
          textTransform: 'uppercase',
          letterSpacing: '0.02em'
        }}>
          <span>{translation.fromLang?.toUpperCase()}</span>
          <ArrowRight size={10} style={{ opacity: 0.7 }} />
          <span>{translation.toLang?.toUpperCase()}</span>
        </div>
      )}
    </div>
  );
};

export default TranslatedMessage;
