/*
  app.js
  Example Express application demonstrating use of security.js utilities.

  Environment variables recommended:
  - JWT_SECRET: secret used to sign JWTs (required for production)
  - ENC_KEY: hex string (64 hex chars -> 32 bytes) used for AES-GCM encryption
  - PORT: port to bind (default 3000)
  - NODE_ENV: set to 'production' in production so secure cookies are enforced

  Notes: This example uses SQLite for user persistence and includes email verification, approval workflows, and secure refresh-token cookies. For production, replace the email sending stub with a real mail provider and secure secret storage.
*/

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const sec = require('./security');
const cookieParser = require('cookie-parser');
const {
  initializeDatabase,
  createUser,
  getUserByEmail,
  setVerificationToken,
  verifyEmailToken,
  getPendingApprovals,
  approveUser,
  logAccountEvent,
  getAccountEvents,
  createRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokensForUser,
  isTokenRevoked,
} = require('./db');
const sendgridIntegration = require('./sendgrid');
const app = express();
app.use(helmet());
app.set('trust proxy', 1);

if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    if (proto === 'https' || req.secure) {
      return next();
    }
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  });
}

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
// Capture raw body for webhook signature verification (req.rawBody)
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use('/sendgrid', sendgridIntegration(logAccountEvent));

// Serve a simple registration page with client-side reCAPTCHA integration
app.get('/register-page', (req, res) => {
  const siteKey = process.env.CAPTCHA_SITE_KEY || '';
  const captchaScript = siteKey ? `<script src="https://www.google.com/recaptcha/api.js" async defer></script>` : '';
  const captchaWidget = siteKey ? `<div class="g-recaptcha" data-sitekey="${siteKey}"></div>` : '<p>reCAPTCHA not configured (set CAPTCHA_SITE_KEY)</p>';
  res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Register</title>
  ${captchaScript}
  <style>body{font-family:Arial,sans-serif;max-width:640px;margin:40px auto;padding:0 16px}label{display:block;margin-top:8px}</style>
</head>
<body>
  <h1>Register</h1>
  <form id="regForm">
    <label>Email: <input id="email" name="email" type="email" required></label>
    <label>Password: <input id="password" name="password" type="password" required minlength="8"></label>
    ${captchaWidget}
    <button type="submit">Register</button>
  </form>
  <div id="out"></div>
  <script>
    const form = document.getElementById('regForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      let captchaToken = null;
      if (typeof grecaptcha !== 'undefined') {
        captchaToken = grecaptcha.getResponse();
      }
      const resp = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, captchaToken })
      });
      const json = await resp.json();
      document.getElementById('out').textContent = JSON.stringify(json);
    });
  </script>
</body>
</html>`);
});


const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || (console.warn('Warning: using fallback JWT secret; set JWT_SECRET in production'), 'dev-secret');
const ENC_KEY = process.env.ENC_KEY || (() => { console.warn('Warning: using ephemeral encryption key; set ENC_KEY in production'); return sec.generateSecureToken(32); })(); // hex

initializeDatabase();

async function seedInitialAdmin() {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return;
  const existing = getUserByEmail(adminEmail);
  if (existing) return;
  const stored = await sec.hashPassword(adminPassword);
  createUser(adminEmail, stored.hash, {
    role: 'admin',
    is_verified: true,
    is_approved: true,
    approved_by: adminEmail,
    approved_at: new Date().toISOString(),
    verified_at: new Date().toISOString(),
  });
  console.log(`Initial admin account created: ${adminEmail}`);
}

seedInitialAdmin().catch((err) => {
  console.error('Failed to seed initial admin', err);
});

const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

// Helper: simple retry with exponential backoff for transient SendGrid errors
async function sendWithRetry(fn, args = [], attempts = 3) {
  let attempt = 0;
  let lastErr;
  while (attempt < attempts) {
    try {
      return await fn(...args);
    } catch (err) {
      lastErr = err;
      attempt += 1;
      const delay = Math.pow(2, attempt) * 100;
      console.warn(`Send attempt ${attempt} failed, retrying in ${delay}ms`, err && err.message);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// Send a templated email via SendGrid if available, falling back to SMTP/HTML body
async function sendTemplatedEmail(to, templateId, dynamicData, subjectFallback, htmlFallback) {
  const fromAddress = process.env.EMAIL_FROM || `no-reply@localhost`;
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (sendgridKey) {
    sgMail.setApiKey(sendgridKey);
    const msg = {
      to,
      from: fromAddress,
      templateId,
      dynamic_template_data: dynamicData || {},
    };
    // If no templateId (shouldn't happen here), include defaults
    if (!templateId) {
      msg.subject = subjectFallback || 'Notification';
      msg.html = htmlFallback || '<p></p>';
      msg.text = (htmlFallback || '').replace(/<[^>]*>/g, '') || '';
    }
    return await sendWithRetry(() => sgMail.send(msg));
  }

  // Fallback to SMTP
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpHost && smtpPort && smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: smtpPort == 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
    const info = await transporter.sendMail({
      to,
      from: fromAddress,
      subject: subjectFallback || 'Notification',
      html: htmlFallback || '',
      text: (htmlFallback || '').replace(/<[^>]*>/g, ''),
    });
    return info;
  }

  // Final fallback: log
  console.log(`Email to ${to}: ${htmlFallback || subjectFallback}`);
  return null;
}

// Send verification email: use a transactional template if configured, otherwise send basic HTML
async function sendVerificationEmail(email, token) {
  const baseUrl = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
  const url = `${baseUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
  const templateId = process.env.SENDGRID_VERIFICATION_TEMPLATE_ID || null;
  const subjectFallback = 'Please verify your email';
  const htmlFallback = `<p>Please verify your email by clicking the link below:</p><p><a href="${url}">${url}</a></p>`;

  try {
    if (templateId && process.env.SENDGRID_API_KEY) {
      await sendTemplatedEmail(email, templateId, { verification_url: url, email }, subjectFallback, htmlFallback);
      console.log('Verification email sent via SendGrid template');
      return true;
    }

    // Try plain SendGrid sendWithRetry when no template is configured
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      const msg = { to: email, from: process.env.EMAIL_FROM || `no-reply@${new URL(baseUrl).hostname}`, subject: subjectFallback, text: `Please verify at: ${url}`, html: htmlFallback };
      await sendWithRetry(() => sgMail.send(msg));
      console.log('Verification email sent via SendGrid');
      return true;
    }

    // Fallback to SMTP or console logging handled by sendTemplatedEmail
    await sendTemplatedEmail(email, null, null, subjectFallback, htmlFallback);
    return true;
  } catch (err) {
    console.error('Failed to send verification email:', err);
    return false;
  }
}

const registerLimiter = sec.rateLimit({ windowMs: 60 * 1000, max: 5 });

// Simple auth middleware using verifyJWT and revocation check
function requireAuth(req, res, next) {
  try {
    const auth = req.headers['authorization'];
    if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid Authorization header' });
    const token = parts[1];
    const payload = sec.verifyJWT(token, JWT_SECRET);
    // check revocation
    const revoked = isTokenRevoked(payload.jti);
    if (revoked) return res.status(401).json({ error: 'token revoked' });
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: String(err.message || err) });
  }
}

// Example: register
app.post('/register', registerLimiter, async (req, res) => {
  try {
    const { email, password, role, captchaToken } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    if (process.env.CAPTCHA_ENABLED === 'true') {
      const captchaOk = await sec.verifyCaptcha(captchaToken);
      if (!captchaOk) {
        logAccountEvent('captcha_failed', email, ip, 'Captcha validation failed during registration');
        return res.status(400).json({ error: 'captcha validation failed' });
      }
    }
    if (!sec.isValidEmail(email)) {
      logAccountEvent('invalid_email', email, ip, 'Invalid email during registration');
      return res.status(400).json({ error: 'invalid email' });
    }
    if (password.length < 8) {
      logAccountEvent('weak_password', email, ip, 'Password too short during registration');
      return res.status(400).json({ error: 'password too short (min 8 chars)' });
    }
    const existing = getUserByEmail(email);
    if (existing) {
      logAccountEvent('duplicate_registration', email, ip, 'Registration attempt for existing email');
      return res.status(409).json({ error: 'user exists' });
    }
    const allowedRoles = ['user', 'manager', 'admin'];
    const requestedRole = allowedRoles.includes(role) ? role : 'user';
    const isPrivileged = requestedRole !== 'user';
    if (isPrivileged) {
      logAccountEvent('privileged_role_requested', email, ip, `Requested role: ${requestedRole}`);
    }
    const stored = await sec.hashPassword(password);
    const created = createUser(email, stored.hash, {
      role: requestedRole,
      is_verified: false,
      is_approved: false,
      requested_role: requestedRole,
      approval_requested_at: isPrivileged ? new Date().toISOString() : null,
    });

    const token = sec.generateSecureToken(24);
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 3600;
    setVerificationToken(email, token, expiresAt);
    sendVerificationEmail(email, token);
    logAccountEvent('registration_started', email, ip, `Created user pending verification and approval: ${requestedRole}`);

    return res.status(201).json({ ok: true, message: 'verification email sent' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
});

// Example: login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    if (!user.is_verified) return res.status(403).json({ error: 'email not verified' });
    if (!user.is_approved) return res.status(403).json({ error: 'account pending approval' });
    const ok = await sec.verifyPassword(password, { hash: user.password_hash });
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    const token = sec.signJWT({ sub: email, role: user.role }, JWT_SECRET, { expiresIn: 3600 });
    const refreshToken = sec.generateSecureToken(32);
    const refreshExpires = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    createRefreshToken(refreshToken, email, refreshExpires);
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(refreshExpires * 1000),
    });
    return res.json({ token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
});

// Email verification endpoint
app.get('/verify-email', (req, res) => {
  try {
    const token = req.query.token || req.body && req.body.token;
    if (!token) return res.status(400).json({ error: 'verification token required' });
    const result = verifyEmailToken(token);
    if (!result) return res.status(400).json({ error: 'invalid or expired token' });
    const message = result.approved ? 'Email verified and account approved' : 'Email verified. Account pending approval';
    return res.json({ ok: true, message, role: result.role });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
});

// Protected route
app.get('/secure', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user, message: 'You accessed a protected resource' });
});

// Role-based middleware: accepts a single role string or array of allowed roles
function requireRole(required) {
  const allowed = Array.isArray(required) ? required : [required];
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
    const role = req.user.role;
    if (!role) return res.status(403).json({ error: 'forbidden' });
    if (!allowed.includes(role)) return res.status(403).json({ error: 'forbidden' });
    return next();
  };
}

// Logout (revoke token and optionally provided refresh token)
app.post('/logout', requireAuth, (req, res) => {
  try {
    const payload = req.user;
    const jti = payload.jti;
    const exp = payload.exp || Math.floor(Date.now() / 1000) + 3600; // fallback
    const { revokeToken } = require('./db');
    revokeToken(jti, exp);
    // if client provided a refresh token to revoke it explicitly
    const { refreshToken } = req.body || {};
    if (refreshToken) {
      revokeRefreshToken(refreshToken);
    }
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    // also revoke all refresh tokens for this user to be safe
    revokeAllRefreshTokensForUser(payload.sub);
    return res.json({ ok: true, message: 'token revoked' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
});

// Example of a role-protected route
app.get('/admin-only', requireAuth, requireRole('admin'), (req, res) => {
  res.json({ ok: true, message: 'admin access granted' });
});

// Admin interface: list pending approval requests
app.get('/admin/pending-approvals', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const pending = getPendingApprovals();
    return res.json({ ok: true, pending });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
});

app.post('/admin/approve', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const user = getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'user not found' });
    if (!user.is_verified) return res.status(400).json({ error: 'user email not verified' });
    const ok = approveUser(email, req.user.sub);
    if (!ok) return res.status(400).json({ error: 'approval failed' });
    logAccountEvent('account_approved', email, req.ip, `Approved by ${req.user.sub}`);
    return res.json({ ok: true, message: 'user approved' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
});

app.get('/admin/registration-events', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const events = getAccountEvents(100);
    return res.json({ ok: true, events });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
});

// Refresh token endpoint (rotation)
app.post('/token/refresh', async (req, res) => {
  try {
    // read refresh token from HttpOnly cookie
    const refreshToken = req.cookies && req.cookies.refreshToken;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken cookie required' });
    const rt = getRefreshToken(refreshToken);
    if (!rt) return res.status(401).json({ error: 'invalid refresh token' });
    const now = Math.floor(Date.now() / 1000);
    if (rt.revoked) {
      // token reuse detected; revoke all refresh tokens for this user
      revokeAllRefreshTokensForUser(rt.email);
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'refresh token revoked' });
    }
    if (rt.expires_at <= now) {
      revokeRefreshToken(refreshToken);
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'refresh token expired' });
    }
    // rotate: create a new refresh token and revoke the old one with replaced_by
    const newRefresh = sec.generateSecureToken(32);
    const newExp = now + 7 * 24 * 3600;
    rotateRefreshToken(refreshToken, newRefresh, newExp);
    // set cookie
    res.cookie('refreshToken', newRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(newExp * 1000),
    });
    // issue new access token
    const user = getUserByEmail(rt.email);
    const role = user && user.role ? user.role : 'user';
    const newAccess = sec.signJWT({ sub: rt.email, role }, JWT_SECRET, { expiresIn: 3600 });
    return res.json({ token: newAccess });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
});

// Encryption demo (GET encrypt?text=...)
app.get('/encrypt', (req, res) => {
  const text = req.query.text;
  if (!text) return res.status(400).json({ error: 'text query param required' });
  try {
    // ENC_KEY may be hex or generated token; ensure Buffer
    const keyBuf = Buffer.from(ENC_KEY, 'hex');
    const out = sec.encryptAESGCM(text, keyBuf);
    return res.json({ encrypted: out });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'encryption failed (check ENC_KEY format)' });
  }
});

// Decrypt demo (POST body { iv, authTag, ciphertext })
app.post('/decrypt', (req, res) => {
  const payload = req.body;
  if (!payload || !payload.iv) return res.status(400).json({ error: 'invalid payload' });
  try {
    const keyBuf = Buffer.from(ENC_KEY, 'hex');
    const pt = sec.decryptAESGCM(payload, keyBuf);
    return res.json({ plaintext: pt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'decryption failed (check payload and ENC_KEY)' });
  }
});

// Sanitize demo
app.get('/sanitize', (req, res) => {
  const input = req.query.input || '';
  const escaped = sec.sanitizeForHTML(input);
  const filename = sec.sanitizeFilename(input);
  res.json({ original: input, escaped, filename });
});

// Rate-limited route
const limiter = sec.rateLimit({ windowMs: 60 * 1000, max: 10 });
app.get('/rate', limiter, (req, res) => {
  res.json({ ok: true, remaining: res.getHeader('X-RateLimit-Remaining') });
});

// Basic index
app.get('/', (req, res) => {
  res.send('Security utilities demo: POST /register, POST /login, GET /secure (Bearer token)');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Example routes: POST /register, POST /login, GET /secure (Bearer token)');
});
