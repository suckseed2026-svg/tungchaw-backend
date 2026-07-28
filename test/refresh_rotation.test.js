const assert = require('assert');
const sec = require('../security');
const db = require('../db');

describe('refresh token rotation (db helpers)', function() {
  it('can create and rotate a refresh token', function() {
    const email = 'refresh@example.com';
    // ensure user exists
    const user = db.getUserByEmail(email) || db.createUser(email, 'dummy-hash');
    const old = sec.generateSecureToken(16);
    const now = Math.floor(Date.now()/1000);
    const oldExp = now + 3600;
    const created = db.createRefreshToken(old, email, oldExp);
    assert.strictEqual(created, true);
    const got = db.getRefreshToken(old);
    assert.ok(got && got.token === old);

    const newTok = sec.generateSecureToken(16);
    const newExp = now + 7*24*3600;
    const res = db.rotateRefreshToken(old, newTok, newExp);
    assert.strictEqual(res.created, true);
    assert.strictEqual(res.updated, true);

    const oldRow = db.getRefreshToken(old);
    assert.strictEqual(oldRow.revoked, 1);
    assert.strictEqual(oldRow.replaced_by, newTok);
    const newRow = db.getRefreshToken(newTok);
    assert.ok(newRow && newRow.revoked === 0);
    // cleanup cookie behavior not tested here; cookie behavior is in app flow tests

  });

  it('revokeAllRefreshTokensForUser revokes tokens', function() {
    const email = 'revokeall@example.com';
    if (!db.getUserByEmail(email)) db.createUser(email, 'dummy');
    const t1 = sec.generateSecureToken(8);
    const t2 = sec.generateSecureToken(8);
    const now = Math.floor(Date.now()/1000);
    db.createRefreshToken(t1, email, now + 1000);
    db.createRefreshToken(t2, email, now + 1000);
    const changed = db.revokeAllRefreshTokensForUser(email);
    assert.ok(changed >= 2);
    const r1 = db.getRefreshToken(t1);
    const r2 = db.getRefreshToken(t2);
    assert.strictEqual(r1.revoked, 1);
    assert.strictEqual(r2.revoked, 1);
  });
});
