const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbDir = path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'users.sqlite3');
fs.mkdirSync(dbDir, { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    is_verified INTEGER NOT NULL DEFAULT 0,
    is_approved INTEGER NOT NULL DEFAULT 0,
    requested_role TEXT,
    approval_requested_at TEXT,
    approved_by TEXT,
    approved_at TEXT,
    verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    revoked_at INTEGER,
    replaced_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS account_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    email TEXT,
    ip TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function hasColumn(tableName, columnName) {
  const stmt = db.prepare(`PRAGMA table_info(${tableName})`);
  return stmt.all().some((col) => col.name === columnName);
}

function addColumnIfMissing(tableName, columnDefinition, columnName) {
  if (!hasColumn(tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
  }
}

addColumnIfMissing('users', "role TEXT NOT NULL DEFAULT 'user'", 'role');
addColumnIfMissing('users', 'is_verified INTEGER NOT NULL DEFAULT 0', 'is_verified');
addColumnIfMissing('users', 'is_approved INTEGER NOT NULL DEFAULT 0', 'is_approved');
addColumnIfMissing('users', 'requested_role TEXT', 'requested_role');
addColumnIfMissing('users', 'approval_requested_at TEXT', 'approval_requested_at');
addColumnIfMissing('users', 'approved_by TEXT', 'approved_by');
addColumnIfMissing('users', 'approved_at TEXT', 'approved_at');
addColumnIfMissing('users', 'verified_at TEXT', 'verified_at');

function createUser(email, passwordHash, opts = {}) {
  const role = opts.role || 'user';
  const is_verified = opts.is_verified ? 1 : 0;
  const is_approved = opts.is_approved ? 1 : 0;
  const requested_role = opts.requested_role || (role !== 'user' ? role : null);
  const approval_requested_at = opts.approval_requested_at || (requested_role ? new Date().toISOString() : null);
  const approved_by = opts.approved_by || null;
  const approved_at = opts.approved_at || null;
  const verified_at = opts.verified_at || null;
  const stmt = db.prepare(`INSERT INTO users (email, password_hash, role, is_verified, is_approved, requested_role, approval_requested_at, approved_by, approved_at, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const result = stmt.run(email, passwordHash, role, is_verified, is_approved, requested_role, approval_requested_at, approved_by, approved_at, verified_at);
  return {
    id: result.lastInsertRowid,
    email,
    role,
    is_verified: !!is_verified,
    is_approved: !!is_approved,
    requested_role,
    approval_requested_at,
    approved_by,
    approved_at,
    verified_at,
  };
}

function getUserByEmail(email) {
  const stmt = db.prepare('SELECT id, email, password_hash, role, is_verified, is_approved, requested_role, approval_requested_at, approved_by, approved_at, verified_at, created_at FROM users WHERE email = ?');
  return stmt.get(email) || null;
}

function setVerificationToken(email, token, expiresAt) {
  const stmt = db.prepare('INSERT INTO email_verification_tokens (token, email, expires_at) VALUES (?, ?, ?)');
  const result = stmt.run(token, email, expiresAt);
  return result.changes > 0;
}

function verifyEmailToken(token) {
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare('SELECT token, email, expires_at, used FROM email_verification_tokens WHERE token = ?');
  const row = stmt.get(token);
  if (!row || row.used || row.expires_at <= now) return null;
  db.prepare('UPDATE email_verification_tokens SET used = 1 WHERE token = ?').run(token);
  const user = getUserByEmail(row.email);
  if (!user) return null;
  const approved = user.role === 'user' ? 1 : user.is_approved;
  db.prepare('UPDATE users SET is_verified = 1, verified_at = ?, is_approved = ? WHERE email = ?').run(new Date().toISOString(), approved, row.email);
  return { email: row.email, role: user.role, approved: !!approved };
}

function getPendingApprovals() {
  const stmt = db.prepare('SELECT email, role, requested_role, approval_requested_at, verified_at, created_at FROM users WHERE is_verified = 1 AND is_approved = 0');
  return stmt.all();
}

function approveUser(email, approverEmail) {
  const now = new Date().toISOString();
  const stmt = db.prepare('UPDATE users SET is_approved = 1, approved_by = ?, approved_at = ? WHERE email = ?');
  const result = stmt.run(approverEmail, now, email);
  return result.changes > 0;
}

function logAccountEvent(type, email, ip, details) {
  const stmt = db.prepare('INSERT INTO account_events (type, email, ip, details) VALUES (?, ?, ?, ?)');
  const result = stmt.run(type, email || null, ip || null, details || null);
  return result.lastInsertRowid;
}

function getAccountEvents(limit = 50) {
  const stmt = db.prepare('SELECT id, type, email, ip, details, created_at FROM account_events ORDER BY id DESC LIMIT ?');
  return stmt.all(limit);
}

function revokeToken(jti, expiresAt) {
  const stmt = db.prepare('INSERT OR REPLACE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)');
  const result = stmt.run(jti, expiresAt);
  return result.changes > 0;
}

function isTokenRevoked(jti) {
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare('SELECT 1 FROM revoked_tokens WHERE jti = ? AND expires_at > ? LIMIT 1');
  const row = stmt.get(jti, now);
  return !!row;
}

function cleanupExpiredRevocations() {
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare('DELETE FROM revoked_tokens WHERE expires_at <= ?');
  const result = stmt.run(now);
  return result.changes;
}

function createRefreshToken(token, email, expiresAt) {
  const stmt = db.prepare('INSERT INTO refresh_tokens (token, email, expires_at, revoked, created_at) VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)');
  const result = stmt.run(token, email, expiresAt);
  return result.changes > 0;
}

function getRefreshToken(token) {
  const stmt = db.prepare('SELECT token, email, expires_at, revoked, revoked_at, replaced_by FROM refresh_tokens WHERE token = ?');
  return stmt.get(token) || null;
}

function revokeRefreshToken(token, revokedAt = Math.floor(Date.now() / 1000), replacedBy = null) {
  const stmt = db.prepare('UPDATE refresh_tokens SET revoked = 1, revoked_at = ?, replaced_by = ? WHERE token = ?');
  const result = stmt.run(revokedAt, replacedBy, token);
  return result.changes > 0;
}

function revokeAllRefreshTokensForUser(email) {
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare('UPDATE refresh_tokens SET revoked = 1, revoked_at = ? WHERE email = ? AND revoked = 0');
  const result = stmt.run(now, email);
  return result.changes;
}

function rotateRefreshToken(oldToken, newToken, newExpiresAt) {
  const now = Math.floor(Date.now() / 1000);
  const old = getRefreshToken(oldToken);
  if (!old) return { created: false, updated: false, reason: 'old-not-found' };
  const inserted = createRefreshToken(newToken, old.email, newExpiresAt);
  const stmt = db.prepare('UPDATE refresh_tokens SET revoked = 1, revoked_at = ?, replaced_by = ? WHERE token = ?');
  const result = stmt.run(now, newToken, oldToken);
  return { created: inserted, updated: result.changes > 0 };
}

function initializeDatabase() {
  return db;
}

module.exports = {
  initializeDatabase,
  createUser,
  getUserByEmail,
  setVerificationToken,
  verifyEmailToken,
  getPendingApprovals,
  approveUser,
  logAccountEvent,
  getAccountEvents,
  revokeToken,
  isTokenRevoked,
  cleanupExpiredRevocations,
  createRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
  rotateRefreshToken,
};
