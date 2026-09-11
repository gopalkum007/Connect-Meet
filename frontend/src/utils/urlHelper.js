export const extractRoomCode = (input) => {
  if (!input) return '';
  let str = input.trim();
  try {
    if (str.startsWith('http://') || str.startsWith('https://')) {
      const urlObj = new URL(str);
      str = urlObj.pathname;
    }
  } catch (e) {}
  
  // Remove trailing slashes and split path
  const parts = str.split('/').filter(Boolean);
  
  // Filter out common route names if present in URL
  const filtered = parts.filter(p => {
    const lower = p.toLowerCase();
    return lower !== 'meet' && lower !== 'meeting' && lower !== 'join';
  });

  return filtered.length > 0 ? filtered[filtered.length - 1] : str;
};

export const generateRoomCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const randPart = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${randPart(3)}-${randPart(4)}-${randPart(3)}`;
};

export const formatMeetingUrl = (code) => {
  const cleanCode = extractRoomCode(code);
  if (!cleanCode) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/meet/${cleanCode}`;
};
