const express = require('express');
const crypto = require('crypto');

// Simple SendGrid webhook router factory. Expects a logAccountEvent(email, ip, details) function to be provided.
module.exports = function (logAccountEvent) {
  const router = express.Router();

  // Helper: verify SendGrid signed webhook using Ed25519 public key (PEM or raw)
  function verifySendGridSignature(req) {
    const publicKey = process.env.SENDGRID_PUBLIC_KEY;
    if (!publicKey) {
      // No public key configured -> treat as unverified (caller can decide to allow or reject)
      return false;
    }
    // Headers per SendGrid docs
    const signatureHeader = req.headers['x-twilio-email-event-webhook-signature'] || req.headers['x-sendgrid-signature'] || req.headers['x-sg-signature'];
    const timestampHeader = req.headers['x-twilio-email-event-webhook-timestamp'] || req.headers['x-sendgrid-timestamp'] || req.headers['x-sg-timestamp'];
    if (!signatureHeader || !timestampHeader) return false;

    try {
      // Build payload: timestamp + raw body (as UTF-8 string)
      const timestamp = String(timestampHeader);
      const raw = req.rawBody || (req.body ? Buffer.from(JSON.stringify(req.body)) : Buffer.from(''));
      const payload = Buffer.concat([Buffer.from(timestamp, 'utf8'), raw]);

      const signature = Buffer.from(signatureHeader, 'base64');

      // Use Node's crypto.verify. For Ed25519, pass null as algorithm and provide PEM public key.
      // The public key can be provided as PEM (preferred). If user provides raw base64 key, try to use it too.
      let pubKey = publicKey;
      // If provided key looks like base64 without PEM headers, attempt to convert to PEM for ed25519.
      if (!pubKey.includes('BEGIN')) {
        // Wrap in SPKI PEM header for Ed25519 if possible
        // Many SendGrid public keys are provided in PEM; if user pasted raw base64 of SPKI, wrap it.
        const b64 = pubKey.replace(/\s+/g, '');
        pubKey = `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`;
      }

      const verified = crypto.verify(null, payload, pubKey, signature);
      return !!verified;
    } catch (err) {
      console.error('Error verifying SendGrid signature', err && err.message);
      return false;
    }
  }

  // POST /sendgrid/webhook
  router.post('/webhook', (req, res) => {
    // First, prefer verifying with SENDGRID_PUBLIC_KEY
    const pubKey = process.env.SENDGRID_PUBLIC_KEY;
    if (pubKey) {
      const ok = verifySendGridSignature(req);
      if (!ok) {
        console.warn('SendGrid signature verification failed');
        return res.status(401).send('invalid signature');
      }
    } else {
      // If no public key, optionally accept a simple shared secret header
      const secret = process.env.SENDGRID_WEBHOOK_SECRET;
      const header = req.headers['x-sg-webhook-secret'] || req.headers['x-sendgrid-webhook-secret'] || req.headers['x-sg-secret'];
      if (secret && header !== secret) {
        console.warn('SendGrid webhook secret mismatch');
        return res.status(401).send('invalid signature');
      }
      if (!secret) console.warn('No SENDGRID_PUBLIC_KEY or SENDGRID_WEBHOOK_SECRET set; accepting webhook without verification');
    }

    const events = Array.isArray(req.body) ? req.body : [req.body];
    try {
      for (const ev of events) {
        const evType = ev && ev.event;
        const email = ev && (ev.email || ev.recipient || (ev.to && ev.to[0]));
        if (!email) continue;
        if (['bounce', 'dropped', 'deferred'].includes(evType)) {
          logAccountEvent('email_bounce', email, req.ip, JSON.stringify(ev));
        } else if (['unsubscribe', 'spamreport'].includes(evType)) {
          logAccountEvent('email_unsubscribe', email, req.ip, JSON.stringify(ev));
        } else {
          logAccountEvent('sendgrid_event', email, req.ip, JSON.stringify(ev));
        }
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error('SendGrid webhook processing error', err);
      return res.status(500).send('error');
    }
  });

  return router;
};
