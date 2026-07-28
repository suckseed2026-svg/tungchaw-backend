const assert = require('assert');
const crypto = require('crypto');
const sec = require('../security');

describe('security utilities', function() {
  this.timeout(10000);

  it('generateSecureToken returns hex of correct length', () => {
    const token = sec.generateSecureToken(16); // 16 bytes -> 32 hex chars
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(token.length, 16 * 2);
  });

  it('argon2 hashPassword and verifyPassword work', async () => {
    const password = 'TestPass!234';
    const stored = await sec.hashPassword(password);
    assert.ok(stored && stored.hash, 'hash should be returned');
    const ok = await sec.verifyPassword(password, stored);
    assert.strictEqual(ok, true);
    const bad = await sec.verifyPassword('wrongpass', stored);
    assert.strictEqual(bad, false);
  });

  it('signJWT and verifyJWT work and preserve payload', () => {
    const secret = 'unittests-secret';
    const token = sec.signJWT({ sub: 'user123', role: 'tester' }, secret, { expiresIn: 60 });
    const payload = sec.verifyJWT(token, secret);
    assert.strictEqual(payload.sub, 'user123');
    assert.strictEqual(payload.role, 'tester');
  });

  it('verifyJWT throws on expired tokens', (done) => {
    const secret = 'unittests-secret-exp';
    const token = sec.signJWT({ sub: 'u' }, secret, { expiresIn: 1 });
    // wait slightly longer to allow for timing variability
    setTimeout(() => {
      try {
        sec.verifyJWT(token, secret);
        done(new Error('Expected token to be expired'));
      } catch (e) {
        assert.ok(/expired/i.test(String(e.message)));
        done();
      }
    }, 2500);
  });

  it('encryptAESGCM and decryptAESGCM roundtrip', () => {
    const key = crypto.randomBytes(32);
    const plaintext = 'Hello, secure world!';
    const enc = sec.encryptAESGCM(plaintext, key);
    assert.ok(enc && enc.iv && enc.ciphertext && enc.authTag);
    const dec = sec.decryptAESGCM(enc, key);
    assert.strictEqual(dec, plaintext);
  });

  it('timingSafeEqual returns true for equal buffers and false otherwise', () => {
    const a = Buffer.from('abc123');
    const b = Buffer.from('abc123');
    const c = Buffer.from('xyz');
    assert.strictEqual(sec.timingSafeEqual(a, b), true);
    assert.strictEqual(sec.timingSafeEqual(a, c), false);
  });

  it('sanitizeForHTML escapes dangerous characters', () => {
    const raw = '<script>alert("x")</script>&';
    const esc = sec.sanitizeForHTML(raw);
    // escaped should not contain literal '<' or '>' and should replace & with &amp;
    assert.ok(esc.indexOf('<') === -1 && esc.indexOf('>') === -1 && esc.indexOf('&') !== -1);
  });

  it('isValidEmail returns sensible results', () => {
    assert.strictEqual(sec.isValidEmail('a@b.com'), true);
    assert.strictEqual(sec.isValidEmail('not-an-email'), false);
  });
});
