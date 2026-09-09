const translationCache = new Map();

/**
 * Retrieves a translation from the cache if it exists.
 * @param {string} text - Original message text
 * @param {string} sourceLang - Code of the source language (e.g. "en")
 * @param {string} targetLang - Code of the target language (e.g. "hi")
 * @returns {string|null} Cached translation or null
 */
export const getCachedTranslation = (text, sourceLang, targetLang) => {
  if (!text) return null;
  const key = `${text.trim()}_${sourceLang.toLowerCase()}_${targetLang.toLowerCase()}`;
  return translationCache.get(key);
};

/**
 * Adds a translation to the cache.
 * @param {string} text - Original message text
 * @param {string} sourceLang - Code of the source language
 * @param {string} targetLang - Code of the target language
 * @param {string} translation - Translated message text
 */
export const setCachedTranslation = (text, sourceLang, targetLang, translation) => {
  if (!text || !translation) return;
  const key = `${text.trim()}_${sourceLang.toLowerCase()}_${targetLang.toLowerCase()}`;
  translationCache.set(key, translation);
};
