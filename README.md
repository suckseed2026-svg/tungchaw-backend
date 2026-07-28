Security utilities and Express example

Files added
- security.js (</e:/Tungchaw-Integrated-Phase new/security.js>)
- app.js (</e:/Tungchaw-Integrated-Phase new/app.js>)
- package.json (</e:/Tungchaw-Integrated-Phase new/package.json>)

Implemented security functions (summary)
- Password hashing: argon2-based hashPassword and verifyPassword (async)
- Secure random token generation: generateSecureToken
- Minimal JWT signed with HMAC-SHA256: signJWT / verifyJWT
- Authenticated encryption: AES-256-GCM encrypt/decrypt helpers
- Timing-safe comparison: timingSafeEqual
- Input sanitizers: sanitizeForHTML, sanitizeFilename, isValidEmail
- Rate-limiting middleware for Express: rateLimit

How to run the example
1. Install dependencies: npm install
2. Set environment variables (recommended):
   - JWT_SECRET: secret to sign JWTs
   - ENC_KEY: 32-byte key in hex (64 hex chars) for AES-GCM operations
   - PORT: optional port (default 3000)
   - NODE_ENV=production: enables secure cookies and HTTPS redirect behavior
   - CAPTCHA_ENABLED=true: require CAPTCHA validation on registration when configured
   - CAPTCHA_SECRET: secret key for CAPTCHA verification (for Google reCAPTCHA, this is the secret key)
   - CAPTCHA_SITE_KEY: (client-side) reCAPTCHA site key to render widget
   - CAPTCHA_MIN_SCORE: optional float 0-1 to treat v3 scores below this as failure (default 0.5)
   - APP_BASE_URL: base URL for email verification link generation
   - SENDGRID_API_KEY: optional SendGrid API key. When provided, emails are sent via SendGrid API.
   - SENDGRID_VERIFICATION_TEMPLATE_ID: optional SendGrid dynamic template ID for verification emails. When set, the template will be used and provided dynamic_template_data (verification_url, email).
   - SENDGRID_PUBLIC_KEY: optional SendGrid public key used to verify signed webhooks. Provide the PEM-formatted public key or the base64 body (the code will attempt to wrap base64 into PEM). If set, POST /sendgrid/webhook will require a valid SendGrid signature (recommended).
   - SENDGRID_WEBHOOK_SECRET: optional shared secret to validate incoming SendGrid webhook requests as a fallback. If SENDGRID_PUBLIC_KEY is not set but SENDGRID_WEBHOOK_SECRET is, the server will expect header 'x-sg-webhook-secret' to match this value for POST /sendgrid/webhook.
   - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS: SMTP settings for sending emails (used when SendGrid key is not present). If neither SendGrid nor SMTP are configured, verification URLs are logged.
   - EMAIL_FROM: optional from address for outgoing emails (defaults to no-reply@APP_HOST)
   - INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD: optional credentials for seeding the first admin account
3. Start the server: npm start

Example flows
- Register: POST /register { "email": "a@b.com", "password": "secret123" }
- After registration, verify the email token by visiting /verify-email?token=<token> (the token is logged in the app console for this example)
- Login: POST /login { "email": "a@b.com", "password": "secret123" } -> returns token
- Protected: GET /secure with header Authorization: Bearer <token>

Production recommendations
- Use bcrypt/argon2 for password hashing and tune cost parameters
- Use a vetted JWT library (jsonwebtoken) and rotate keys
- Store secrets (JWT secret, encryption keys) in a secret manager
- Use TLS (HTTPS), secure cookies, and security headers (helmet). The example app redirects HTTP to HTTPS in production and will set secure HttpOnly refresh-token cookies when NODE_ENV=production.
- CORS is enabled in the example app for convenience; in production restrict allowed origins explicitly.
- User credentials are now persisted in an SQLite database file under the data/ folder.
- Registration now requires email verification and supports admin approval for privileged roles.
- An example client registration page with client-side reCAPTCHA is available at GET /register-page (set CAPTCHA_SITE_KEY to enable the widget).
- Refresh tokens are now stored in secure HttpOnly cookies and rotated on refresh.
- Separate registration rate limiting and fraud detection event logging are in place.
- Use Redis or another shared store for rate-limiting in multi-instance deployments
- Replace in-memory user store with a persistent database and ORM
- Add logging/monitoring and regular security scans

Paths
- security utilities: </e:/Tungchaw-Integrated-Phase new/security.js>
- Express example: </e:/Tungchaw-Integrated-Phase new/app.js>
