'use strict';
const crypto = require('node:crypto');
const db = require('../config/db');
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE = 'bf_session';
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
const isProduction = () => process.env.NODE_ENV === 'production';
const cookieOptions = { httpOnly: true, sameSite: 'lax', path: '/' };

function cookieValue(req) {
  const raw = req.headers.cookie || '';
  for (const pair of raw.split(';')) {
    const [name, ...value] = pair.trim().split('=');
    if (name === COOKIE) return value.join('=');
  }
  return null;
}
async function attachSession(req, res, next) {
  try {
    req.user = null;
    const token = cookieValue(req);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return next();
    const [rows] = await db.query(
      `SELECT u.user_id, u.full_name, u.email, u.phone, u.role, u.is_active, u.must_change_password
         FROM app_sessions s JOIN app_users u ON u.user_id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > NOW() LIMIT 1`, [digest(token)]);
    if (rows.length && rows[0].is_active) req.user = rows[0];
    else res.clearCookie(COOKIE, { ...cookieOptions, secure: isProduction() });
    next();
  } catch (err) { next(err); }
}
function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Please sign in to continue.' });
    if (!allowed.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Your account cannot access this feature.' });
    if (req.user.must_change_password) return res.status(403).json({ success: false, code: 'PASSWORD_CHANGE_REQUIRED', message: 'Change your temporary password in My Account before continuing.' });
    next();
  };
}
const requireStaff = requireRole('ADMIN', 'EMPLOYEE');
const requireAdmin = requireRole('ADMIN');
async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.query('INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))', [digest(token), userId]);
  res.cookie(COOKIE, token, { ...cookieOptions, secure: isProduction(), maxAge: SESSION_MS });
}
async function deleteSession(req, res) {
  const token = cookieValue(req);
  if (token && /^[a-f0-9]{64}$/.test(token)) await db.query('DELETE FROM app_sessions WHERE token_hash = ?', [digest(token)]);
  res.clearCookie(COOKIE, { ...cookieOptions, secure: isProduction() });
}
async function deleteAllSessions(userId) { await db.query('DELETE FROM app_sessions WHERE user_id = ?', [userId]); }
module.exports = { attachSession, requireRole, requireStaff, requireAdmin, createSession, deleteSession, deleteAllSessions };
