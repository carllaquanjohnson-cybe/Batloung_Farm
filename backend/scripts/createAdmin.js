'use strict';
/** Run interactively: npm run auth:admin. No default admin password. */
const readline = require('node:readline');
const db = require('../config/db');
const { hashPassword, passwordProblem } = require('../auth/passwords');
const ask = (rl, question) => new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdin.setRawMode) return reject(new Error('Run this setup from an interactive terminal (CMD, PowerShell or VS Code terminal).'));
    process.stdout.write(prompt);
    let value = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    function keypress(ch) {
      if (ch === '\r' || ch === '\n') {
        process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener('data', keypress);
        process.stdout.write('\n'); resolve(value);
      } else if (ch === '\u0003') {
        process.stdin.setRawMode(false); process.stdin.removeListener('data', keypress);
        process.stdout.write('\n'); reject(new Error('Cancelled'));
      } else if (ch === '\b' || ch === '\u007f') { value = value.slice(0, -1); }
      else if (ch.length === 1 && ch >= ' ') value += ch;
    }
    process.stdin.on('data', keypress);
  });
}
(async () => {
  if (!process.stdin.isTTY) throw new Error('Use an interactive terminal for administrator setup.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const name = await ask(rl, 'Administrator full name: ');
  const email = (await ask(rl, 'Administrator email: ')).toLowerCase();
  rl.close();
  if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid name and email.');
  const password = await readSecret('Choose an administrator password (hidden, 12+ characters): ');
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const confirm = await readSecret('Repeat the password (hidden): ');
  if (password !== confirm) throw new Error('Passwords do not match.');
  const [[existingAdmin]] = await db.query(`SELECT user_id FROM app_users WHERE role='ADMIN' LIMIT 1`);
  if (existingAdmin) throw new Error('An administrator already exists. This script will not create another administrator or overwrite credentials.');
  const hash = await hashPassword(password);
  await db.query(`INSERT INTO app_users(full_name, email, password_hash, role) VALUES(?, ?, ?, 'ADMIN')`, [name, email, hash]);
  console.log('Administrator created. Only this account can create and manage employees.');
})().catch(err => { console.error(err.message); process.exitCode = 1; }).finally(() => db.end());
