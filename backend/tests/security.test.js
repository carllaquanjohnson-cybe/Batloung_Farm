'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, passwordProblem } = require('../auth/passwords');
const { sameOriginOnly, rateLimit } = require('../middleware/security');

test('passwords have minimum length and a letter and a number', () => {
  assert.ok(passwordProblem('a123'));
  assert.ok(passwordProblem('superlongonlyletters'));
  assert.equal(passwordProblem('a longer passphrase 27'), null);
});
test('passwords are salted, different from plaintext, and correctly verified', async () => {
  const password = 'A very secure passphrase 83';
  const a = await hashPassword(password), b = await hashPassword(password);
  assert.notEqual(a,b);
  assert.ok(a.startsWith('scrypt$'));
  assert.ok(!a.includes(password));
  assert.equal(await verifyPassword(password,a),true);
  assert.equal(await verifyPassword('Wrong password 83',a),false);
  assert.equal(await verifyPassword(password,'invalid'),false);
});
test('cross-site writes are rejected', () => {
  const result = {};
  const response = { status(n){result.status=n;return this},json(o){result.body=o;return this} };
  const req = {method:'POST',get(n){return {'origin':'https://wrong.example','host':'farm.example','sec-fetch-site':'cross-site'}[n]},ip:'1.1.1.1'};
  let nextCalled = false;
  sameOriginOnly(req,response,()=>{nextCalled=true});
  assert.equal(result.status,403);
  assert.equal(nextCalled,false);
});
test('same-origin write allowed', () => {
  const req = {method:'POST',protocol:'https',get(n){return {'origin':'https://farm.example','host':'farm.example','sec-fetch-site':'same-origin'}[n]}};
  let allowed=false;
  sameOriginOnly(req,{},()=>{allowed=true});
  assert.equal(allowed,true);
});
test('rate limiter returns HTTP 429 after threshold', () => {
  const limit=rateLimit({limit:2,windowMs:60000});let calls=0;let code;
  const response={set(){return this},status(n){code=n;return this},json(){return this}};
  for(let i=0;i<3;i++)limit({ip:'127.0.0.1'},response,()=>calls++);
  assert.equal(calls,2);assert.equal(code,429);
});
