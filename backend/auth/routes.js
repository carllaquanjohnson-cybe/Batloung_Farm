'use strict';
const router = require('express').Router();
const db = require('../config/db');
const { hashPassword, verifyPassword, passwordProblem } = require('./passwords');
const { requireAdmin, createSession, deleteSession, deleteAllSessions } = require('./session');
const { rateLimit } = require('../middleware/security');
const HttpError = require('../utils/httpError');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const cleanEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validEmail = v => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const cleanName = name => typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
const cleanPhone = phone => typeof phone === 'string' ? phone.trim() : '';
const publicUser = u => u ? ({ user_id: u.user_id, full_name: u.full_name, email: u.email, phone: u.phone || '', role: u.role, must_change_password: Boolean(u.must_change_password) }) : null;

router.get('/me', (req, res) => res.json({ success: true, data: publicUser(req.user) }));

router.post('/register', rateLimit({ limit: 5, windowMs: 60 * 60 * 1000 }), wrap(async (req, res) => {
  const { full_name, email, password, phone = '' } = req.body;
  const name = cleanName(full_name), address = cleanEmail(email), number = cleanPhone(phone);
  if (name.length < 2 || name.length > 120) throw new HttpError(400, 'Enter a name between 2 and 120 characters.');
  if (!validEmail(address)) throw new HttpError(400, 'Enter a valid email address.');
  if (number.length > 30) throw new HttpError(400, 'Phone number is too long.');
  const problem = passwordProblem(password);
  if (problem) throw new HttpError(400, problem);
  const hash = await hashPassword(password);
  try {
    // Public registration ALWAYS creates CUSTOMER. Ignore any role in body.
    const [result] = await db.query(`INSERT INTO app_users (full_name, email, phone, password_hash, role)
       VALUES (?, ?, ?, ?, 'CUSTOMER')`, [name, address, number || null, hash]);
    await createSession(res, result.insertId);
    res.status(201).json({ success: true, message: 'Welcome to Batloung Farm!', data: { user_id: result.insertId, full_name: name, email: address, phone: number, role: 'CUSTOMER', must_change_password: false } });
  } catch (err) { if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'This email address is already registered.'); throw err; }
}));

router.post('/login', rateLimit({ limit: 12 }), wrap(async (req, res) => {
  const email = cleanEmail(req.body.email), password = req.body.password, role = req.body.role;
  if (!validEmail(email) || typeof password !== 'string' || password.length > 128 || !['ADMIN','EMPLOYEE','CUSTOMER'].includes(role))
    throw new HttpError(401, 'Invalid email, password, or account type.');
  const [rows] = await db.query('SELECT * FROM app_users WHERE email = ? LIMIT 1', [email]);
  const account = rows[0];
  if (!account || !(await verifyPassword(password, account.password_hash)) || !account.is_active || account.role !== role)
    throw new HttpError(401, 'Invalid email, password, or account type.');
  await createSession(res, account.user_id);
  res.json({ success: true, message: 'Signed in successfully.', data: publicUser(account) });
}));

router.post('/logout', wrap(async (req, res) => {
  await deleteSession(req, res);
  res.json({ success: true, message: 'You have signed out.' });
}));

router.patch('/profile', wrap(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Sign in first.');
  const name = cleanName(req.body.full_name), phone = cleanPhone(req.body.phone || '');
  if (name.length < 2 || name.length > 120 || phone.length > 30) throw new HttpError(400, 'Check your name and phone number.');
  await db.query('UPDATE app_users SET full_name = ?, phone = ? WHERE user_id = ?', [name, phone || null, req.user.user_id]);
  res.json({ success: true, data: { ...publicUser(req.user), full_name: name, phone } });
}));

router.post('/change-password', rateLimit({ limit: 10 }), wrap(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Sign in first.');
  const { current_password, new_password } = req.body;
  const problem = passwordProblem(new_password);
  if (problem) throw new HttpError(400, problem);
  const [[row]] = await db.query('SELECT password_hash FROM app_users WHERE user_id = ?', [req.user.user_id]);
  if (!row || !(await verifyPassword(current_password, row.password_hash))) throw new HttpError(401, 'Current password is incorrect.');
  const hash = await hashPassword(new_password);
  await db.query('UPDATE app_users SET password_hash = ?, must_change_password = 0 WHERE user_id = ?', [hash, req.user.user_id]);
  await deleteAllSessions(req.user.user_id);
  await createSession(res, req.user.user_id);
  res.json({ success: true, message: 'Password updated. Other sessions were signed out.' });
}));

router.get('/staff', requireAdmin, wrap(async (req, res) => {
  const [rows] = await db.query(`SELECT user_id, full_name, email, phone, role, is_active, must_change_password, created_at
       FROM app_users WHERE role IN ('ADMIN', 'EMPLOYEE') ORDER BY FIELD(role, 'ADMIN', 'EMPLOYEE'), user_id`);
  res.json({ success: true, data: rows });
}));

router.post('/staff', requireAdmin, rateLimit({ limit: 20, windowMs: 60 * 60 * 1000 }), wrap(async (req, res) => {
  const name = cleanName(req.body.full_name), email = cleanEmail(req.body.email), phone = cleanPhone(req.body.phone || '');
  if (name.length < 2 || name.length > 120 || !validEmail(email) || phone.length > 30) throw new HttpError(400, 'Enter valid employee details.');
  const problem = passwordProblem(req.body.temporary_password);
  if (problem) throw new HttpError(400, problem);
  const hash = await hashPassword(req.body.temporary_password);
  try {
    const [result] = await db.query(`INSERT INTO app_users
      (full_name, email, phone, password_hash, role, must_change_password)
      VALUES (?, ?, ?, ?, 'EMPLOYEE', 1)`, [name, email, phone || null, hash]);
    res.status(201).json({ success: true, message: 'Employee created. Ask them to change their temporary password after signing in.', data: { user_id: result.insertId } });
  } catch (err) { if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'This email is already registered.'); throw err; }
}));

router.patch('/staff/:id/status', requireAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id), active = req.body.is_active;
  if (!Number.isSafeInteger(id) || id < 1 || typeof active !== 'boolean') throw new HttpError(400, 'Invalid employee/status.');
  if (id === Number(req.user.user_id)) throw new HttpError(400, 'You cannot deactivate your own administrator account.');
  const [out] = await db.query(`UPDATE app_users SET is_active = ? WHERE user_id = ? AND role = 'EMPLOYEE'`, [active, id]);
  if (!out.affectedRows) throw new HttpError(404, 'Employee not found.');
  if (!active) await deleteAllSessions(id);
  res.json({ success: true, message: active ? 'Employee reactivated.' : 'Employee deactivated.' });
}));

router.patch('/staff/:id/reset-password', requireAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'Invalid employee.');
  const problem = passwordProblem(req.body.temporary_password);
  if (problem) throw new HttpError(400, problem);
  const hash = await hashPassword(req.body.temporary_password);
  const [out] = await db.query(`UPDATE app_users SET password_hash = ?, must_change_password = 1
        WHERE user_id = ? AND role = 'EMPLOYEE'`, [hash, id]);
  if (!out.affectedRows) throw new HttpError(404, 'Employee not found.');
  await deleteAllSessions(id);
  res.json({ success: true, message: 'Temporary password set. The employee must change it after login.' });
}));
module.exports = router;
