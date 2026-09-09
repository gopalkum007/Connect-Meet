import { useState, useEffect } from 'react';

/**
 * Custom React hook to manage real-time translation state and display preferences.
 */
export const useTranslation = () => {
  const [autoTranslate, setAutoTranslate] = useState(() => {
    return localStorage.getItem('setting_auto_translate') !== 'false';
  });

  const [displayMode, setDisplayMode] = useState(() => {
    return localStorage.getItem('setting_translation_display') || 'both'; // 'both', 'translated', 'original'
  });

  const updateAutoTranslate = (val) => {
    setAutoTranslate(val);
    localStorage.setItem('setting_auto_translate', val);
  };

  const updateDisplayMode = (val) => {
    setDisplayMode(val);
    localStorage.setItem('setting_translation_display', val);
  };

  // Sync state changes from localStorage across windows
  useEffect(() => {
    const handleStorageChange = () => {
      setAutoTranslate(localStorage.getItem('setting_auto_translate') !== 'false');
      setDisplayMode(localStorage.getItem('setting_translation_display') || 'both');
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return {
    autoTranslate,
    displayMode,
    updateAutoTranslate,
    updateDisplayMode
  };
};
