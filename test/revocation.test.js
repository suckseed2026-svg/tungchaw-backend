const assert = require('assert');
const sec = require('../security');
const db = require('../db');

describe('token revocation', function() {
  it('can revoke a token and detect revocation', async () => {
    const secret = 'revocation-secret';
    const token = sec.signJWT({ sub: 'u', role: 'user' }, secret, { expiresIn: 60 });
    const payload = sec.verifyJWT(token, secret);
    assert.ok(payload.jti, 'jti should be present');
    // ensure not revoked initially
    let wasRevoked = db.isTokenRevoked(payload.jti);
    assert.strictEqual(wasRevoked, false);
    // revoke
    const ok = db.revokeToken(payload.jti, payload.exp);
    assert.strictEqual(ok, true);
    // now it should be revoked
    wasRevoked = db.isTokenRevoked(payload.jti);
    assert.strictEqual(wasRevoked, true);
    // cleanup expired (none should be removed now)
    const removed = db.cleanupExpiredRevocations();
    assert.ok(typeof removed === 'number');
  });
});
