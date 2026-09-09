import { getCachedTranslation, setCachedTranslation } from '../utils/translationCache.js';

/**
 * Translates text into target language using LibreTranslate as the primary provider.
 * Logs requests, validates response structures, and handles auto-detection gracefully.
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Language code or "auto"
 * @param {string} targetLang - Target language code (e.g. "hi")
 * @returns {Promise<{ translatedText: string, detectedSourceLang: string }>} Result object
 */
export const translateText = async (text, sourceLang = 'en', targetLang = 'en') => {
  if (!text || text.trim() === '') {
    return { translatedText: text, detectedSourceLang: sourceLang };
  }
  if (sourceLang.toLowerCase() === targetLang.toLowerCase() && sourceLang.toLowerCase() !== 'auto') {
    return { translatedText: text, detectedSourceLang: sourceLang };
  }

  // Check cache first (using actual query parameters)
  const cached = getCachedTranslation(text, sourceLang, targetLang);
  if (cached) {
    return cached;
  }

  const logPayload = {
    q: text,
    source: sourceLang,
    target: targetLang,
    format: "text"
  };
  console.log("Translation API Request:", JSON.stringify(logPayload, null, 2));

  // 1. Try Microsoft Azure Translator (Primary Key provided by User)
  const azureKey = process.env.AZURE_TRANSLATOR_KEY;
  const azureRegion = process.env.AZURE_TRANSLATOR_REGION || 'centralindia';
  if (azureKey) {
    try {
      const fromParam = sourceLang && sourceLang !== 'auto' ? `&from=${sourceLang}` : '';
      const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0${fromParam}&to=${targetLang}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
          'Ocp-Apim-Subscription-Region': azureRegion,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{ Text: text }])
      });

      const responseBody = await response.text();
      console.log("Azure Translator raw response:", responseBody);

      if (response.ok) {
        const data = JSON.parse(responseBody);
        const translatedText = data[0]?.translations[0]?.text;
        const detectedSourceLang = data[0]?.detectedLanguage?.language || sourceLang;

        if (translatedText && translatedText.trim() !== '' && !translatedText.toLowerCase().includes('error')) {
          const result = { translatedText, detectedSourceLang };
          setCachedTranslation(text, sourceLang, targetLang, result);
          return result;
        }
      }
    } catch (error) {
      console.error('Azure Translator failed, trying LibreTranslate:', error.message);
    }
  }

  // 2. Try LibreTranslate (Self-hosted or Public API key)
  const libreUrl = process.env.LIBRETRANSLATE_URL; // e.g. http://localhost:5000
  const libreKey = process.env.LIBRETRANSLATE_KEY;
  if (libreUrl) {
    try {
      const response = await fetch(`${libreUrl.replace(/\/$/, '')}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: sourceLang,
          target: targetLang,
          format: 'text',
          api_key: libreKey || ''
        })
      });

      const responseBody = await response.text();
      console.log("LibreTranslate raw response:", responseBody);

      if (response.ok) {
        const data = JSON.parse(responseBody);
        const translatedText = data?.translatedText;
        const detectedSourceLang = data?.detectedLanguage?.language || sourceLang;

        if (translatedText && translatedText.trim() !== '' && !translatedText.toLowerCase().includes('error')) {
          const result = { translatedText, detectedSourceLang };
          setCachedTranslation(text, sourceLang, targetLang, result);
          return result;
        }
      }
    } catch (error) {
      console.error('LibreTranslate failed, trying fallbacks:', error.message);
    }
  }

  // 2. Fallback: Google Translate Free Client API (High-quality Google Translate mirror with built-in auto-detect)
  try {
    const sl = sourceLang === 'auto' ? 'auto' : sourceLang;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });
    const responseBody = await response.text();
    console.log("Google Free API raw response:", responseBody);

    if (response.ok) {
      const data = JSON.parse(responseBody);
      // data[0] contains array of sentence translation tuples [ [translated, original, ...], ... ]
      let translatedText = '';
      if (Array.isArray(data?.[0])) {
        translatedText = data[0].map(segment => segment?.[0]).filter(Boolean).join('');
      }
      const detectedSourceLang = data?.[2] || (sourceLang === 'auto' ? 'en' : sourceLang);

      if (translatedText && translatedText.trim() !== '' && !translatedText.toLowerCase().includes('error')) {
        const result = { translatedText, detectedSourceLang };
        setCachedTranslation(text, sourceLang, targetLang, result);
        return result;
      }
    }
  } catch (error) {
    console.error('Google Translate Free API fallback failed, trying MyMemory:', error.message);
  }

  // 3. Fallback: Try MyMemory Translation API
  try {
    const sl = (sourceLang === 'auto' || !sourceLang) ? 'en' : sourceLang;
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sl}|${targetLang}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    );
    const responseBody = await response.text();
    console.log("MyMemory raw response:", responseBody);

    if (response.ok) {
      const data = JSON.parse(responseBody);
      const translatedText = data?.responseData?.translatedText;
      const detectedSourceLang = data?.matches?.[0]?.segment?.match?.from || sl;

      if (translatedText && translatedText.trim() !== '' && 
          !translatedText.toLowerCase().includes('error') &&
          !translatedText.toLowerCase().includes('warning') &&
          !translatedText.toLowerCase().includes('limit')) {
        const result = { translatedText, detectedSourceLang };
        setCachedTranslation(text, sourceLang, targetLang, result);
        return result;
      }
    }
  } catch (error) {
    console.error('MyMemory fallback failed, trying Lingva:', error.message);
  }

  // 4. Fallback: Try Lingva Translate (Google Translate mirror)
  try {
    const sl = sourceLang === 'auto' ? 'auto' : sourceLang;
    const response = await fetch(
      `https://lingva.ml/api/v1/${sl}/${targetLang}/${encodeURIComponent(text)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    );
    const responseBody = await response.text();
    console.log("Lingva raw response:", responseBody);

    if (response.ok) {
      const data = JSON.parse(responseBody);
      const translatedText = data?.translation;
      const detectedSourceLang = sourceLang;

      if (translatedText && translatedText.trim() !== '' && !translatedText.toLowerCase().includes('error')) {
        const result = { translatedText, detectedSourceLang };
        setCachedTranslation(text, sourceLang, targetLang, result);
        return result;
      }
    }
  } catch (error) {
    console.error('Lingva Translate fallback failed:', error.message);
  }

  // Final soft fallback: return original text gracefully rather than error string
  console.warn(`Translation unavailable for text: "${text}". Returning original.`);
  return {
    translatedText: text,
    detectedSourceLang: sourceLang === 'auto' ? 'en' : sourceLang
  };
};
