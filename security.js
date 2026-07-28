/*
  security.js
  Self-contained security helpers for Node.js projects (no external deps required).

  Implemented features:
  - hashPassword(password): returns {salt, iterations, keylen, digest, hash}
  - verifyPassword(password, stored): verifies a stored hash object
  - generateSecureToken(bytes): cryptographically secure random token (hex)
  - signJWT(payload, secret, options): HMAC-SHA256 JWT implementation
  - verifyJWT(token, secret): verifies and returns payload or throws
  - encryptAESGCM(plaintext, key): returns { iv, authTag, ciphertext } (base64)
  - decryptAESGCM({iv, authTag, ciphertext}, key): returns plaintext
  - timingSafeEqual(a, b): safe comparison to mitigate timing attacks
  - sanitizeForHTML(input): basic HTML escape to reduce XSS risk
  - sanitizeFilename(name): remove path traversal and illegal chars
  - isValidEmail(email): simple RFC-like email validation
  - rateLimit(options): simple in-memory Express middleware (for dev/small deployments)

  Notes / production recommendations:
  - For password hashing in production, consider using bcrypt/argon2 with tuned parameters.
  - For JWT, consider using a battle-tested library (jsonwebtoken) and rotate secrets.
  - Use a shared store (Redis) for rate-limiting in distributed deployments.
  - Store encryption keys and secrets in a secure secret manager (not in repo).
*/

const crypto = require('crypto');
const argon2 = require('argon2');

// Password hashing using argon2 (recommended)
// Note: argon2.hash produces an encoded string that contains params and salt.
async function hashPassword(password, opts = {}) {
  const options = {
    type: argon2.argon2id,
    memoryCost: opts.memoryCost || 2 ** 16, // 64 MiB
    timeCost: opts.timeCost || 3,
    parallelism: opts.parallelism || 1,
  };
  const encoded = await argon2.hash(password, options);
  // Store the encoded hash string. It contains salt and parameters.
  return { hash: encoded };
}

async function verifyPassword(password, stored) {
  if (!stored) throw new Error('Invalid stored password object');
  const storedHash = stored.hash || stored;
  try {
    return await argon2.verify(storedHash, password);
  } catch (e) {
    return false;
  }
}

// Secure random token
function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

// Minimal JWT (HMAC SHA256) implementation. Use a real library in production.
function base64UrlEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  // pad
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function signJWT(payload, secret, options = {}) {
  const header = { alg: 'HS256', typ: 'JWT' };
  if (options.kid) header.kid = options.kid;
  const now = Math.floor(Date.now() / 1000);
  const claims = Object.assign({}, payload);
  // add jti (JWT ID) for revocation tracking
  claims.jti = options.jti || generateSecureToken(16);
  if (options.expiresIn) claims.exp = now + options.expiresIn;
  if (options.issuedAt !== false) claims.iat = now;

  const headerB = base64UrlEncode(JSON.stringify(header));
  const payloadB = base64UrlEncode(JSON.stringify(claims));
  const toSign = headerB + '.' + payloadB;
  const sig = crypto.createHmac('sha256', secret).update(toSign).digest();
  const sigB = base64UrlEncode(sig);
  return toSign + '.' + sigB;
}

function verifyJWT(token, secret) {
  if (!token || typeof token !== 'string') throw new Error('Invalid token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const [headerB, payloadB, sigB] = parts;
  const toSign = headerB + '.' + payloadB;
  const expectedSig = crypto.createHmac('sha256', secret).update(toSign).digest();
  const sig = base64UrlDecode(sigB);
  if (!timingSafeEqual(sig, expectedSig)) throw new Error('Invalid signature');
  const payloadJson = base64UrlDecode(payloadB).toString('utf8');
  const payload = JSON.parse(payloadJson);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) throw new Error('Token expired');
  return payload;
}

async function verifyCaptcha(token) {
  if (process.env.CAPTCHA_ENABLED !== 'true') return true;
  if (!token) return false;
  const secret = process.env.CAPTCHA_SECRET;
  const verifyUrl = process.env.CAPTCHA_VERIFY_URL || 'https://www.google.com/recaptcha/api/siteverify';
  if (!secret) return false;
  try {
    const form = new URLSearchParams({ secret, response: token });
    const response = await fetch(verifyUrl, { method: 'POST', body: form, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const json = await response.json();
    // Google returns success and score (for v3). Accept success boolean and score >= threshold if provided.
    if (!json) return false;
    if (json.success !== true) return false;
    const minScore = parseFloat(process.env.CAPTCHA_MIN_SCORE || '0.5');
    if (typeof json.score === 'number') {
      return json.score >= minScore;
    }
    return true;
  } catch (err) {
    console.error('verifyCaptcha error', err);
    return false;
  }
}

// AES-GCM encryption/decryption (authenticated)
function encryptAESGCM(plaintext, key) {
  // key: Buffer or hex string of length 32 bytes (256 bits)
  const keyBuf = typeof key === 'string' ? Buffer.from(key, 'hex') : key;
  if (!Buffer.isBuffer(keyBuf) || keyBuf.length < 16) throw new Error('Invalid key');
  const iv = crypto.randomBytes(12); // 96-bit recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf.slice(0,32), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ct.toString('base64')
  };
}

function decryptAESGCM({ iv, authTag, ciphertext }, key) {
  const keyBuf = typeof key === 'string' ? Buffer.from(key, 'hex') : key;
  const ivBuf = Buffer.from(iv, 'base64');
  const tagBuf = Buffer.from(authTag, 'base64');
  const ctBuf = Buffer.from(ciphertext, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf.slice(0,32), ivBuf);
  decipher.setAuthTag(tagBuf);
  const out = Buffer.concat([decipher.update(ctBuf), decipher.final()]);
  return out.toString('utf8');
}

// Timing-safe compare
function timingSafeEqual(a, b) {
  try {
    const A = Buffer.isBuffer(a) ? a : Buffer.from(a);
    const B = Buffer.isBuffer(b) ? b : Buffer.from(b);
    if (A.length !== B.length) return false;
    return crypto.timingSafeEqual(A, B);
  } catch (e) {
    return false;
  }
}

// Basic sanitizers
function sanitizeForHTML(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeFilename(name) {
  if (!name) return '';
  // remove path separators and limit chars
  return name.replace(/\\|\//g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // simple RFC-like check (not exhaustive)
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

// Simple in-memory rate limiter middleware for Express
function rateLimit(options = {}) {
  // options: windowMs (ms), max (number of requests)
  const windowMs = options.windowMs || 60 * 1000; // 1 minute default
  const max = options.max || 60; // 60 requests per window per key
  const getKey = options.keyGenerator || ((req) => req.ip || req.headers['x-forwarded-for'] || 'unknown');
  const store = new Map();

  // periodic cleanup to avoid memory growth
  setInterval(() => {
    const now = Date.now();
    for (const [k, entry] of store.entries()) {
      if (entry.expires <= now) store.delete(k);
    }
  }, Math.max(60000, windowMs));

  return function (req, res, next) {
    try {
      const key = getKey(req);
      const now = Date.now();
      const entry = store.get(key) || { count: 0, expires: now + windowMs };
      if (now > entry.expires) {
        entry.count = 0;
        entry.expires = now + windowMs;
      }
      entry.count += 1;
      store.set(key, entry);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
      res.setHeader('X-RateLimit-Reset', Math.floor(entry.expires / 1000));
      if (entry.count > max) {
        res.statusCode = 429;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Too many requests' }));
      }
      return next();
    } catch (err) {
      // on error, don't block service. Log and continue
      console.error('rateLimit middleware error', err);
      return next();
    }
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  signJWT,
  verifyJWT,
  encryptAESGCM,
  decryptAESGCM,
  timingSafeEqual,
  sanitizeForHTML,
  sanitizeFilename,
  isValidEmail,
  verifyCaptcha,
  rateLimit,
};
