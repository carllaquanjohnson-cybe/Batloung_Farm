'use strict';
/* Public customer and staff authentication screens. The server enforces roles. */
const ROLE_LABEL = { ADMIN: 'Administrator', EMPLOYEE: 'Employee', CUSTOMER: 'Customer' };
const ROLE_HOME = { ADMIN: 'floor', EMPLOYEE: 'work', CUSTOMER: 'store' };
const authError = (target, error) => { const node = document.querySelector(target); if (node) node.innerHTML = errBox(error); };
function submitBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]');
  if (button) { button.disabled = busy; button.textContent = busy ? 'Please wait…' : (button.dataset.label || 'Continue'); }
}
function authPhoto(text, kicker = 'FRESH PRODUCE • MASERU, LESOTHO') {
  return `<aside class="identity-art"><div class="identity-art-inner"><span class="eyebrow">✦ ${kicker}</span><h2>${text}</h2><p>From South Africa's growers to Lesotho's markets. A fresher way to connect and grow.</p><div class="identity-ornament">🍎 &nbsp; 🍊 &nbsp; 🍌 &nbsp; 🥭 &nbsp; 🍇</div></div></aside>`;
}
function loginForm() {
  return {html:`<section class="identity-layout">
    ${authPhoto('Your next fresh beginning starts here.')}
    <div class="identity-panel"><a class="identity-back" href="#/store">← Back to fresh produce</a>
      <span class="eyebrow">WELCOME TO BATLOUNG FARM</span><h1>Sign in.</h1>
      <p class="identity-muted">Choose the account type that belongs to you.</p>
      <div class="identity-roles" aria-label="Account type"><button type="button" class="active" data-login-role="CUSTOMER" aria-pressed="true">Customer</button><button type="button" data-login-role="EMPLOYEE" aria-pressed="false">Employee</button><button type="button" data-login-role="ADMIN" aria-pressed="false">Administrator</button></div>
      <form id="login-form" class="identity-form"><input type="hidden" name="role" value="CUSTOMER">
        <label>Email address<input name="email" type="email" autocomplete="username" placeholder="you@example.com" maxlength="254" required></label>
        <label>Password<div class="password-row"><input id="login-password" type="password" name="password" autocomplete="current-password" placeholder="Your private password" required><button type="button" class="show-password" aria-controls="login-password">Show</button></div></label>
        <div id="login-feedback" role="alert"></div><button class="pri identity-submit" type="submit" data-label="Sign in →">Sign in →</button>
      </form>
      <div class="identity-divider"><span>NEW TO THE FARM?</span></div>
      <a class="identity-alt" href="#/register">Create your customer account <span>→</span></a>
      <a class="identity-guest" href="#/store">Continue exploring as a guest — no account needed</a>
      <p class="identity-footnote">Employee access is created by an administrator. Administrator accounts cannot be registered publicly.</p>
    </div></section>`,bind() {
    document.querySelectorAll('[data-login-role]').forEach(btn => btn.onclick = () => {
      document.querySelectorAll('[data-login-role]').forEach(x => {x.classList.toggle('active', x===btn); x.setAttribute('aria-pressed', String(x===btn));});
      document.querySelector('#login-form [name=role]').value=btn.dataset.loginRole;
    });
    bindPasswordToggles();
    document.querySelector('#login-form').onsubmit = async e => {
      e.preventDefault(); const form=e.currentTarget, data=Object.fromEntries(new FormData(form)); submitBusy(form,true);
      try {
        const result = await api('/auth/login', {method:'POST',body:data});
        await signedIn(result.data);
        toast(`Welcome back, ${result.data.full_name.split(' ')[0]}!`);
      } catch(err) { authError('#login-feedback',err); }
      finally { submitBusy(form,false); }
    };
  }};
}
function bindPasswordToggles() {
  document.querySelectorAll('.show-password').forEach(button => button.onclick = () => {
    const input=document.getElementById(button.getAttribute('aria-controls'));
    input.type=input.type==='password'?'text':'password';
    button.textContent=input.type==='password'?'Show':'Hide';
  });
}
function registerForm() {
  return {html:`<section class="identity-layout">
    ${authPhoto('Good things grow together.', 'JOIN OUR FRESH COMMUNITY')}
    <div class="identity-panel"><a class="identity-back" href="#/store">← Explore as a guest</a>
      <span class="eyebrow">CUSTOMER REGISTRATION</span><h1>Let's get growing.</h1>
      <p class="identity-muted">Create your own customer password. Your details are saved securely, so you can return and sign in.</p>
      <form id="register-form" class="identity-form">
        <label>Full name<input name="full_name" type="text" autocomplete="name" maxlength="120" placeholder="Your full name" required></label>
        <label>Email address<input name="email" type="email" autocomplete="email" maxlength="254" placeholder="you@example.com" required></label>
        <label>Phone number <small>(optional)</small><input name="phone" type="tel" autocomplete="tel" maxlength="30" placeholder="+266 …"></label>
        <label>Create password<div class="password-row"><input id="register-password" name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" placeholder="At least 12 characters" required><button type="button" class="show-password" aria-controls="register-password">Show</button></div></label>
        <p class="pass-note">Use 12 or more characters, including a letter and a number. Only a secure password hash is stored.</p>
        <label>Confirm password<input name="confirm_password" type="password" minlength="12" maxlength="128" autocomplete="new-password" placeholder="Repeat your password" required></label>
        <div id="register-feedback" role="alert"></div>
        <button type="submit" class="pri identity-submit" data-label="Create my customer account →">Create my customer account →</button>
      </form>
      <a class="identity-guest" href="#/login">Already have an account? Sign in</a>
      <p class="identity-footnote">This registration is for customers only. Staff accounts are created privately by the administrator.</p>
    </div></section>`,bind() {
    bindPasswordToggles();
    document.querySelector('#register-form').onsubmit = async e => {
      e.preventDefault();const form=e.currentTarget; const data=Object.fromEntries(new FormData(form));
      if(data.password!==data.confirm_password) return authError('#register-feedback', new Error('The passwords do not match.'));
      if(data.password.length<12 || !/[a-z]/i.test(data.password) || !/[0-9]/.test(data.password)) return authError('#register-feedback',new Error('Use at least 12 characters including a letter and a number.'));
      submitBusy(form,true);
      try { delete data.confirm_password;const result=await api('/auth/register',{method:'POST',body:data}); await signedIn(result.data); toast('Customer account created successfully!'); }
      catch(err){authError('#register-feedback',err)}finally{submitBusy(form,false)}
    };
  }};
}
async function storefront() {
  let entries=[], error='';
  try {entries=(await api('/catalog')).data;}catch(err){error=err.message;}
  const groups=new Map();
  entries.forEach(item=>{ if(!groups.has(item.fruit_id)) groups.set(item.fruit_id,{name:item.fruit_name,description:item.description||'Fresh produce sourced with care',sizes:[]});groups.get(item.fruit_id).sizes.push(item); });
  const products=[...groups.values()];
  const cards=products.map((p,i)=>{
    const photo=FRUIT_IMAGE[p.name] || 'apple', available=p.sizes.some(s=>Boolean(s.available));
    return `<article class="market-card"><div class="market-photo" style="background-image:url('assets/${photo}.webp')"><span class="market-number">0${i+1}</span><span class="market-stock ${available?'':'unavailable'}">${available?'● Available':'Currently unavailable'}</span></div><div class="market-info"><span class="eyebrow">FRESH PRODUCE · PREMIUM QUALITY</span><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p>
      <div class="market-prices">${p.sizes.map(s=>`<span class="market-price ${s.available?'':'soldout'}"><small>${esc(s.packaging_size.toLowerCase())} box</small><b>${M(s.selling_price)}</b></span>`).join('')}</div>
      <button class="market-enquire" type="button" data-enquire="${esc(p.name)}" ${available?'':'disabled'}>${available?'Enquire about '+esc(p.name)+'s ↗':'Out of stock'}</button></div></article>`;
  }).join('');
  const name=getCurrentUser()?.full_name?.split(' ')[0];
  return {html:`<section class="market-hero"><div class="market-hero-content"><span class="market-pill">✦ THE FRESH SIDE OF BUSINESS</span>
    <h1>Nature's finest.<br><em>Ready for your market.</em></h1><p>Discover beautifully fresh fruit, grown with care and distributed from trusted South African suppliers to Lesotho's communities.</p>
    <div class="hero-buttons"><a href="#produce" class="pri">Explore our fruits ↗</a><button class="hero-secondary market-contact" type="button">Talk to Batloung Farm →</button></div>
    <div class="market-hero-bottom"><span>🍏 FRESH QUALITY</span><span>🚚 REGIONAL DISTRIBUTION</span><span>💚 LESOTHO BUSINESS</span></div></div></section>
    ${name?`<div class="market-welcome">✦ Welcome back, <strong>${esc(name)}</strong>. Your fresh produce collection awaits.</div>`:''}
    <div class="section-heading" id="produce"><div><span class="eyebrow">CURATED FOR YOU</span><h2>Fresh picks for your business</h2></div><span class="section-hint">Select a fruit to enquire about availability.</span></div>
    ${error?`<div class="err" role="alert">Live product information is temporarily unavailable: ${esc(error)}.</div>`:''}
    <div class="market-grid">${cards || (!error?'<div class="market-empty">Our catalogue is being updated. Please contact us for today’s availability.</div>':'')}</div>
    <section class="market-story"><div><span class="eyebrow">GROW WITH BATLOUNG FARM</span><h2>From orchard to opportunity.</h2><p>We connect local vendors, retailers and communities with quality fresh produce. Whether you are running a small stall or planning a bigger order, we would love to hear what you need.</p><button type="button" class="pri market-contact">Request a produce quote ↗</button></div><div class="market-story-photo" role="img" aria-label="Crates of freshly harvested fruit"></div></section>
    <div class="market-steps"><div><b>01</b><strong>Browse produce</strong><p>Explore our fruit range and sizes.</p></div><div><b>02</b><strong>Ask about your order</strong><p>Chat with us on WhatsApp about quantity, delivery and pricing.</p></div><div><b>03</b><strong>Grow your business</strong><p>We discuss fulfilment directly. Online checkout is not available yet.</p></div></div>
    ${!getCurrentUser()?`<div class="market-signup"><span>✦ FRESH ACCESS</span><div><h2>Love what you see?</h2><p>Create a customer account to save your profile and sign in on your next visit, or keep browsing freely.</p></div><a class="pri" href="#/register">Join as a customer →</a></div>`:''}`,bind(){
      document.querySelectorAll('[data-enquire]').forEach(b=>b.onclick=()=>openWhatsApp(`Hello Batloung Farm! I would like to enquire about ${b.dataset.enquire}, packaging sizes, pricing and delivery.`));
      document.querySelectorAll('.market-contact').forEach(b=>b.onclick=()=>openWhatsApp('Hello Batloung Farm! I would like a quote for fresh produce and delivery.'));
      document.querySelectorAll('a[href="#produce"]').forEach(a=>a.onclick=e=>{e.preventDefault();document.getElementById('produce')?.scrollIntoView({behavior:'smooth'})});
    }};
}
function accountPage() {
  const user=getCurrentUser();
  const initials=user.full_name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
  return {html:`<section class="account-header"><div class="account-initials">${esc(initials)}</div><div><span class="eyebrow">YOUR PERSONAL SPACE</span><h1>My account</h1><p>${esc(user.email)} <span class="role-pill">${ROLE_LABEL[user.role]}</span></p></div></section>
    ${user.must_change_password?'<div class="must-change">🔒 Your administrator has issued a temporary password. Change it below before accessing work pages.</div>':''}
    <div class="account-columns"><section class="panel"><span class="eyebrow">PROFILE DETAILS</span><h2>Personal information</h2><p class="identity-muted">Your details are saved to your account.</p>
       <form id="profile-form" class="identity-form"><label>Full name<input name="full_name" maxlength="120" value="${esc(user.full_name)}" required></label><label>Email address<input value="${esc(user.email)}" disabled title="Email cannot be changed here"></label><label>Phone number<input name="phone" type="tel" maxlength="30" value="${esc(user.phone||'')}"></label><div id="profile-feedback"></div><button type="submit" class="pri" data-label="Save profile">Save profile</button></form></section>
       <section class="panel"><span class="eyebrow">ACCOUNT SECURITY</span><h2>Change password</h2><p class="identity-muted">Your password belongs to you. It will never appear on this website or be stored as plain text.</p>
       <form id="password-form" class="identity-form"><label>Current password<input name="current_password" type="password" autocomplete="current-password" required></label><label>New password<input name="new_password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required placeholder="12+ characters, letter and number"></label><label>Confirm new password<input name="confirm" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><div id="password-feedback"></div><button class="pri" type="submit" data-label="Update password">Update password</button></form></section>
    </div><div class="account-logout"><button type="button" class="logout-button" id="account-signout">Sign out securely →</button></div>`,bind(){
      document.querySelector('#profile-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget; submitBusy(form,true);try{const result=await api('/auth/profile',{method:'PATCH',body:Object.fromEntries(new FormData(form))}); setCurrentUser(result.data);toast('Profile updated.');renderAuthChrome();route();}catch(err){authError('#profile-feedback',err)}finally{submitBusy(form,false)}};
      document.querySelector('#password-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,data=Object.fromEntries(new FormData(form));if(data.new_password!==data.confirm)return authError('#password-feedback',new Error('New passwords do not match.'));submitBusy(form,true);try{await api('/auth/change-password',{method:'POST',body:data});const refreshed=await api('/auth/me');setCurrentUser(refreshed.data);renderAuthChrome();toast('Password updated. Other sessions were signed out.');route();}catch(err){authError('#password-feedback',err)}finally{submitBusy(form,false)}};
      document.querySelector('#account-signout').onclick=signOut;
    }};
}
function workPage(){
  const user=getCurrentUser();
  const first=esc(user.full_name.split(' ')[0]);
  const shortcuts=[['sell','Record a sale','Capture vendor orders and receive payments','🧾'],['receive','Receive stock','Record fresh deliveries from growers','🚚'],['vendors','Manage vendors','Check contact details and payments','🏪'],['suppliers','Find suppliers','View supplier addresses and maps','📍'],['records','Transaction records','Review saved purchases and sales','📚']];
  return {html:`<section class="work-hero"><span class="eyebrow">✦ THE DAILY WORKSPACE</span><h1>Good day, ${first}.</h1><p>Welcome to your Batloung Farm employee workspace. Keep the supply moving, help our vendors, and make every box count.</p><span class="work-status">● EMPLOYEE ACCESS · OPERATIONS</span></section>
    <div class="section-heading"><div><span class="eyebrow">QUICK ACTIONS</span><h2>What would you like to do today?</h2></div></div>
    <div class="work-grid">${shortcuts.map(([key,title,desc,emoji])=>`<a href="#/${key}" class="work-card"><span>${emoji}</span><h3>${title}</h3><p>${desc}</p><strong>Open section ↗</strong></a>`).join('')}</div>
    <div class="work-note">🔒 Some controls, including pricing, financial reports and employee accounts, are reserved for the administrator.</div>`,bind(){}};
}
async function teamPage(){
  const entries=(await api('/auth/staff')).data;
  return {html:`<section class="page-banner" style="--page-image:url('assets/vendors.webp')"><div class="page-banner-content"><span class="eyebrow">✦ PEOPLE BEHIND THE PRODUCE</span><h1>Manage the team.</h1><p>Only administrators can issue and manage private employee accounts.</p><div class="page-banner-accent">ADMINISTRATOR ONLY</div></div></section>
    <div class="section-heading"><div><span class="eyebrow">STAFF DIRECTORY</span><h2>People and permissions</h2></div></div>
    <div class="panel wrap"><table><thead><tr><th>Name</th><th>Account</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>${entries.map(s=>`<tr><td>${esc(s.full_name)}</td><td>${esc(s.email)}</td><td>${ROLE_LABEL[s.role]||esc(s.role)}</td><td><span class="tag ${s.is_active?'ok':'bad'}">${s.is_active?(s.must_change_password?'Needs new password':'Active'):'Inactive'}</span></td><td>${s.role==='EMPLOYEE'?`<button class="link" data-toggle-staff="${s.user_id}" data-active="${s.is_active?'0':'1'}">${s.is_active?'Deactivate':'Reactivate'}</button> <button class="link" data-reset-staff="${s.user_id}">Reset password</button>`:'Account owner'}</td></tr>`).join('')}</tbody></table></div>
    <details class="panel team-add" open><summary>Create a private employee account</summary><p class="identity-muted">Share a temporary password privately with the employee. They must set their own new password after first sign-in. Never publish staff credentials in source code or on GitHub.</p>
      <form id="staff-create" class="identity-form"><div class="row"><label>Employee full name<input name="full_name" maxlength="120" required></label><label>Employee email<input name="email" type="email" maxlength="254" required></label></div><div class="row"><label>Phone (optional)<input name="phone" type="tel" maxlength="30"></label><label>Temporary password<input name="temporary_password" type="password" minlength="12" maxlength="128" required placeholder="12+ characters, letter and number"></label></div><div id="staff-feedback"></div><button type="submit" class="pri" data-label="Create employee →">Create employee →</button></form></details>`,bind(){
      document.querySelector('#staff-create').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;submitBusy(f,true);try{await api('/auth/staff',{method:'POST',body:Object.fromEntries(new FormData(f))});toast('Employee account created.');route()}catch(err){authError('#staff-feedback',err)}finally{submitBusy(f,false)}};
      document.querySelectorAll('[data-toggle-staff]').forEach(b=>b.onclick=async()=>{const activate=b.dataset.active==='1';if(!confirm(`${activate?'Reactivate':'Deactivate'} this employee account?`))return;try{await api(`/auth/staff/${b.dataset.toggleStaff}/status`,{method:'PATCH',body:{is_active:activate}});toast('Employee status updated');route()}catch(err){toast(err.message,true)}});
      document.querySelectorAll('[data-reset-staff]').forEach(b=>b.onclick=()=>{
        dialog('Reset employee password',`<p>Set a new private temporary password (12+ characters, a letter and a number). The employee must change it at their next sign-in.</p><form class="reset-form identity-form"><label>New temporary password<input name="temporary_password" type="password" minlength="12" maxlength="128" required></label><div class="reset-error"></div><button class="pri" type="submit" data-label="Reset password">Reset password</button></form>`,d=>{
          d.querySelector('.reset-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;submitBusy(form,true);try{await api(`/auth/staff/${b.dataset.resetStaff}/reset-password`,{method:'PATCH',body:Object.fromEntries(new FormData(form))});d.close();toast('Temporary password reset');route()}catch(err){d.querySelector('.reset-error').innerHTML=errBox(err)}finally{submitBusy(form,false)}};
        });
      });
    }};
}
window.AuthPages={store:storefront,login:loginForm,register:registerForm,account:accountPage,work:workPage,team:teamPage};
