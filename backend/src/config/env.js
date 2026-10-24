import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const rawCorsOrigins = process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '';
const corsOrigins = rawCorsOrigins
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const invalidCorsOrigins = [];

export const CORS_ORIGINS = corsOrigins.map((origin) => {
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin.replace(/\/$/, '')) {
      invalidCorsOrigins.push(origin);
      return '';
    }
    if (isProduction && parsed.protocol !== 'https:') {
      invalidCorsOrigins.push(origin);
      return '';
    }
    return parsed.origin;
  } catch {
    invalidCorsOrigins.push(origin);
    return '';
  }
}).filter(Boolean);

export const SMTP_HOST = process.env.SMTP_HOST || '';
export const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || '587', 10);
export const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
export const SMTP_USER = process.env.SMTP_USER || '';
export const SMTP_PASS = process.env.SMTP_PASS || '';
export const SMTP_FROM = process.env.SMTP_FROM || '';
export const EMAIL_VERIFICATION_REQUIRED = String(process.env.EMAIL_VERIFICATION_REQUIRED || 'false').toLowerCase() === 'true';
// export const EMAIL_VERIFICATION_REQUIRED = isProduction || String(process.env.EMAIL_VERIFICATION_REQUIRED || 'false').toLowerCase() === 'true';
const rawUniversityDomains = process.env.UNIVERSITY_EMAIL_DOMAINS || 'geeta.edu.in';
export const UNIVERSITY_EMAIL_DOMAINS = rawUniversityDomains.split(',').map((value) => value.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
const invalidUniversityDomains = UNIVERSITY_EMAIL_DOMAINS.filter((domain) => !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain));

const missingVars = [];
if (!process.env.MONGODB_URI) missingVars.push('MONGODB_URI');
if (!process.env.JWT_SECRET) missingVars.push('JWT_SECRET');

if (isProduction) {
  if ((process.env.JWT_SECRET || '').length < 32 || /change.?me|replace.?with|secret.?key|super.?secret/i.test(process.env.JWT_SECRET || '')) {
    missingVars.push('JWT_SECRET (production secret must be unique and at least 32 characters)');
  }
  if (CORS_ORIGINS.length === 0) missingVars.push('CORS_ORIGINS (one or more HTTPS frontend origins)');
  if (invalidCorsOrigins.length > 0) missingVars.push('CORS_ORIGINS (contains invalid or non-HTTPS origins)');
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    missingVars.push('SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM (email verification delivery)');
  }
 if (
  EMAIL_VERIFICATION_REQUIRED &&
  (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM)
) {
  missingVars.push(
    'SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM (required when email verification is enabled)'
  );
}
}

if (invalidUniversityDomains.length > 0) {
  console.error(`[FATAL] Invalid university email domains configured: ${invalidUniversityDomains.join(', ')}`);
  process.exit(1);
}

if (!Number.isInteger(SMTP_PORT) || SMTP_PORT < 1 || SMTP_PORT > 65535) {
  missingVars.push('SMTP_PORT (must be between 1 and 65535)');
}

if (missingVars.length > 0) {
  console.error(`[FATAL] Missing or invalid environment configuration: ${missingVars.join(', ')}`);
  process.exit(1);
}

export const PORT = Number.parseInt(process.env.PORT || '5000', 10);
export const MONGODB_URI = process.env.MONGODB_URI;
export const JWT_SECRET = process.env.JWT_SECRET;
export const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
