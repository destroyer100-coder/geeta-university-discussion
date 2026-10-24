/**
 * Link Safety Utility
 * Validates and sanitizes links to reject dangerous schemes and malformed destinations.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export const isValidSafeUrl = (urlString) => {
  if (!urlString || typeof urlString !== 'string') return false;

  const trimmed = urlString.trim();
  // Check for dangerous protocol prefixes before URL parsing
  const lowercase = trimmed.toLowerCase();
  if (
    lowercase.startsWith('javascript:') ||
    lowercase.startsWith('data:') ||
    lowercase.startsWith('vbscript:') ||
    lowercase.startsWith('file:') ||
    lowercase.startsWith('blob:')
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch (err) {
    return false;
  }
};

export const sanitizeUrl = (urlString) => {
  if (!urlString || typeof urlString !== 'string') return '';
  const trimmed = urlString.trim();
  return isValidSafeUrl(trimmed) ? trimmed : '';
};
