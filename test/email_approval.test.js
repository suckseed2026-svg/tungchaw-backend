const assert = require('assert');
const sec = require('../security');
const db = require('../db');

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
}

describe('email verification and approval workflow', function() {
  it('verifyCaptcha returns true when CAPTCHA is disabled', async () => {
    process.env.CAPTCHA_ENABLED = 'false';
    const ok = await sec.verifyCaptcha('any-token');
    assert.strictEqual(ok, true);
  });

  it('can verify email token for a new user and auto-approve normal accounts', async () => {
    const email = uniqueEmail('verify');
    const stored = await sec.hashPassword('StrongPass!123');
    if (!db.getUserByEmail(email)) {
      db.createUser(email, stored.hash, { role: 'user', is_verified: false, is_approved: false });
    }
    const token = sec.generateSecureToken(16);
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    db.setVerificationToken(email, token, expiresAt);
    const result = db.verifyEmailToken(token);
    assert.ok(result);
    assert.strictEqual(result.email, email);
    assert.strictEqual(result.approved, true);
    const user = db.getUserByEmail(email);
    assert.strictEqual(user.is_verified, 1);
    assert.strictEqual(user.is_approved, 1);
  });

  it('can verify email for privileged role and require admin approval', async () => {
    const email = uniqueEmail('priv');
    const stored = await sec.hashPassword('StrongPass!123');
    if (!db.getUserByEmail(email)) {
      db.createUser(email, stored.hash, {
        role: 'manager',
        is_verified: false,
        is_approved: false,
        requested_role: 'manager',
        approval_requested_at: new Date().toISOString(),
      });
    }
    const token = sec.generateSecureToken(16);
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    db.setVerificationToken(email, token, expiresAt);
    const result = db.verifyEmailToken(token);
    assert.ok(result);
    assert.strictEqual(result.email, email);
    assert.strictEqual(result.approved, false);
    const user = db.getUserByEmail(email);
    assert.strictEqual(user.is_verified, 1);
    assert.strictEqual(user.is_approved, 0);
    const ok = db.approveUser(email, 'admin@example.com');
    assert.strictEqual(ok, true);
    const approvedUser = db.getUserByEmail(email);
    assert.strictEqual(approvedUser.is_approved, 1);
  });
});
