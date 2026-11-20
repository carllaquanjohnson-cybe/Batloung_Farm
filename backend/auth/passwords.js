'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const N = 16384, r = 8, p = 1, KEYLEN = 64;

function passwordProblem(value) {
  if (typeof value !== 'string') return 'Enter a password.';
  if (value.length < 12 || value.length > 128) return 'Use a password of 12–128 characters.';
  if (!/[a-z]/i.test(value) || !/[0-9]/.test(value)) return 'Include at least one letter and one number.';
  return null;
}
async function hashPassword(password) {
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const salt = crypto.randomBytes(24).toString('hex');
  const hash = await scrypt(password, Buffer.from(salt, 'hex'), KEYLEN, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt}$${hash.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  try {
    if (typeof password !== 'string' || password.length > 128 || !stored) return false;
    const [alg, sn, sr, sp, salt, hex] = stored.split('$');
    if (alg !== 'scrypt' || !/^\d+$/.test(sn) || !/^\d+$/.test(sr) || !/^\d+$/.test(sp)) return false;
    if (+sn !== N || +sr !== r || +sp !== p || !/^[a-f0-9]{48}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hex)) return false;
    const actual = await scrypt(password, Buffer.from(salt, 'hex'), KEYLEN, { N, r, p, maxmem: 64 * 1024 * 1024 });
    return crypto.timingSafeEqual(actual, Buffer.from(hex, 'hex'));
  } catch { return false; }
}
module.exports = { hashPassword, verifyPassword, passwordProblem };
