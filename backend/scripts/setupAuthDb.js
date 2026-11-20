'use strict';
const fs = require('node:fs');
const path = require('node:path');
const db = require('../config/db');
(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../database/auth.sql'), 'utf8')
    .split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
  const statements = sql.split(';').map(x => x.trim()).filter(Boolean);
  for (const statement of statements) await db.query(statement);
  console.log('Authentication tables created or already present. Existing farm tables unchanged.');
})().catch(err => { console.error('Auth setup failed:', err.message); process.exitCode = 1; })
  .finally(() => db.end());
