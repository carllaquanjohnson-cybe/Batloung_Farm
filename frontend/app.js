'use strict';
const $ = (s, e = document) => e.querySelector(s), $$ = (s, e = document) => [...e.querySelectorAll(s)];
const M = n => 'M' + Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SIZES = ['SMALL', 'MEDIUM', 'LARGE'], CODE = { SMALL: 'S', MEDIUM: 'M', LARGE: 'L' };
const PROV = ['Gauteng', 'Free State', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West'];
const COL = { Apple: '#d6283a', Banana: '#f2b705', Orange: '#f26b1d', Mango: '#5fa33a', Grapes: '#6b3fa0', Pear: '#a3b522' };
const col = n => COL[n] || `hsl(${[...n].reduce((a, c) => a + c.charCodeAt(0), 0) * 37 % 360} 55% 45%)`;
const FRUIT_EMOJI = { Apple:'🍎', Banana:'🍌', Orange:'🍊', Mango:'🥭', Grapes:'🍇', Pear:'🍐' };
const STATUS = { PAID: ['Paid', 'ok'], PARTIALLY_PAID: ['Part paid', 'mid'], UNPAID: ['Unpaid', 'bad'] };
const PUBLIC_CONFIG = window.BATLOUNG_CONFIG || {};
const FRUIT_IMAGE = {Apple:'apple',Banana:'banana',Orange:'orange',Mango:'mango',Grapes:'grapes'};
const tag = s => `<span class="tag ${STATUS[s][1]}">${STATUS[s][0]}</span>`;

async function api(path, opt = {}) {
  let r;
  try { r = await fetch('/api' + path, { method: opt.method || 'GET', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: opt.body ? JSON.stringify(opt.body) : undefined }); }
  catch { throw Object.assign(new Error('Can’t reach the server. Start the backend with npm start, then retry.')); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.message || 'Request failed'), { details: d.details });
  return d;
}
let tt;
function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(() => t.className = '', 3200); }
const errBox = e => `<div class="err" role="alert"><b>${esc(e.message)}</b>${Array.isArray(e.details) ? `<ul>${e.details.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
const opts = (arr, v, l, ph) => (ph ? `<option value="">${ph}</option>` : '') + arr.map(x => `<option value="${esc(x[v] ?? x)}">${esc(typeof l === 'function' ? l(x) : x[l] ?? x)}</option>`).join('');

function dialog(title, body, bind) {
  const d = document.createElement('dialog');
  d.innerHTML = `<h2 style="margin-top:0">${title}</h2>${body}<p><button type="button" class="cx">Close</button></p>`;
  document.body.append(d); $('.cx', d).onclick = () => d.close(); d.onclose = () => d.remove(); d.showModal(); if (bind) bind(d);
}
function editForm(title, fields, vals, save) {
  dialog(title, `<form class="ef" style="display:grid;gap:12px">${fields.map(f => `<label>${f.l}${f.o ? `<select name="${f.k}">${opts(f.o)}</select>` : `<input name="${f.k}" ${f.r === false ? '' : 'required'}>`}</label>`).join('')}<div class="ee"></div><button class="pri">Save changes</button></form>`, d => {
    const fm = $('.ef', d); fields.forEach(f => fm.elements[f.k].value = vals[f.k] ?? '');
    fm.onsubmit = async e => { e.preventDefault(); try { await save(Object.fromEntries(new FormData(fm))); d.close(); toast('Changes saved'); route(); } catch (x) { $('.ee', d).innerHTML = errBox(x); } };
  });
}

/* ---------- shared: multi-line item editor (sales + purchases) ---------- */
function lineEditor(root, fruits, stock, cost, onChange) {
  const map = new Map(stock.map(s => [s.fruit_id + '|' + s.packaging_size, s]));
  const add = () => {
    const d = document.createElement('div'); d.className = 'line';
    d.innerHTML = `<label>Fruit<select class="f">${opts(fruits, 'fruit_id', 'fruit_name', 'Choose fruit')}</select></label>
      <label>Box size<select class="s">${opts(SIZES, 0, x => x[0] + x.slice(1).toLowerCase())}</select></label>
      <label>Boxes<input class="q" type="number" min="1" step="1" value="1"></label>
      ${cost ? '<label>Cost per box (M)<input class="c" type="number" min="0" step="0.01" value="0"></label>' : '<div class="hint"></div>'}
      <button type="button" class="x" aria-label="Remove line">✕</button>`;
    d.addEventListener('input', onChange); d.addEventListener('change', onChange);
    $('.x', d).onclick = () => { if ($$('.line', root).length > 1) { d.remove(); onChange(); } };
    root.append(d); onChange();
  };
  const read = () => $$('.line', root).map(d => {
    const fruit_id = +$('.f', d).value, packaging_size = $('.s', d).value, quantity = +$('.q', d).value, s = map.get(fruit_id + '|' + packaging_size);
    return { d, fruit_id, packaging_size, quantity, s, unit_cost: cost ? +$('.c', d).value : undefined };
  });
  add();
  return { add, read };
}

/* ---------- pages ---------- */
const pages = {
  async floor() {
    const [sum, st, fr] = await Promise.all([api('/reports/summary'), api('/stock'), api('/fruits/all')]);
    const d = sum.data, T = sum.threshold, by = {}; pages._fr = fr.data;
    st.data.forEach(r => (by[r.fruit_name] ||= { status: r.status, id: r.fruit_id, bays: {} }).bays[r.packaging_size] = r);
    const rows = Object.entries(by).map(([name, f]) => `<div class="shelf"><div class="fruit ${f.status === 'INACTIVE' ? 'off' : ''}" style="--c:${col(name)}"><i></i>${esc(name)} <button class="link" data-ef="${f.id}">Edit</button></div>
      ${SIZES.map(sz => { const b = f.bays[sz]; if (!b) return '<div></div>'; const q = b.available_quantity, n = Math.min(Math.ceil(q / 10), 12);
        return `<div class="bay ${q <= T && f.status === 'ACTIVE' ? 'low' : ''}" style="--c:${col(name)}"><div class="stack" aria-hidden="true">${`<i class="cr ${CODE[sz]}"></i>`.repeat(n)}</div>
        <div class="n">${q} <small>${sz.toLowerCase()} boxes</small></div>
        <div><button class="link" data-price="${b.stock_id}" data-cur="${b.selling_price}" title="Change price">${M(b.selling_price)} a box</button> ${q <= T && f.status === 'ACTIVE' ? '<span class="tag bad">Low</span>' : ''}</div></div>`; }).join('')}</div>`).join('');
    const fruitTiles = Object.entries(by).map(([name,f],index) => {
      const total = Object.values(f.bays).reduce((n,r) => n + Number(r.available_quantity || 0),0);
      return `<a href="#stock-rack" class="fruit-poster poster-${index % 5}" style="--poster-color:${col(name)}" aria-label="View ${esc(name)} stock"><span class="poster-number">0${index+1}</span><span class="poster-art poster-photo" style="--fruit-image:url('assets/${FRUIT_IMAGE[name] || 'apple'}.webp')" aria-hidden="true"></span><span class="poster-content"><strong>${esc(name)}${name.endsWith('s') ? '' : 's'}</strong><small>${total.toLocaleString()} boxes available</small></span><span class="poster-arrow">↗</span></a>`;
    }).join('');
    return `<section class="hero" aria-label="Fresh produce showcase"><div class="hero-inner"><span class="hero-eyebrow"><span class="spark">✦</span> FRESH FROM THE FARM • MASERU, LESOTHO</span><h1>Freshness delivered.<br><em>Business made better.</em></h1><p>Premium fruits, trusted growers, and seamless distribution — bringing fresh opportunities to every vendor and market.</p><div class="hero-buttons"><a class="pri" href="#/sell">Record a sale <span>↗</span></a><a class="hero-secondary" href="#/receive">Receive produce <span>→</span></a></div><div class="hero-bottom"><span>● QUALITY FIRST</span><span>● FROM GROWER TO MARKET</span><span>● BUILT FOR LESOTHO</span></div></div><span class="hero-side-label">FRESH PRODUCE · BATLOUNG FARM</span></section>
      <div class="section-heading"><div><span class="eyebrow">BUSINESS AT A GLANCE</span><h2>Today's overview</h2></div><a class="text-arrow" href="#/reports">View full reports ↗</a></div>
      <div class="strip"><div><span class="stat-icon">▦</span><small>Boxes in stock</small><b>${d.boxes_in_stock}</b><span class="stat-note">Ready for distribution</span></div><div class="${d.low_stock_lines ? 'warn' : ''}"><span class="stat-icon">◉</span><small>Low stock alerts</small><b>${d.low_stock_lines}</b><span class="stat-note">Bays need attention</span></div><div><span class="stat-icon">↗</span><small>Sales revenue</small><b>${M(d.revenue)}</b><span class="stat-note">Total billed to vendors</span></div><div class="${d.outstanding ? 'warn' : ''}"><span class="stat-icon">◷</span><small>Outstanding payments</small><b>${M(d.outstanding)}</b><span class="stat-note">Awaiting collection</span></div></div>
      <div class="section-heading"><div><span class="eyebrow">OUR PRODUCE COLLECTION</span><h2>Explore fresh favourites <span class="heading-star">✳</span></h2></div><span class="section-hint">Discover what's available in the farm</span></div><div class="poster-track">${fruitTiles}</div>
      <div class="section-heading" id="stock-rack"><div><span class="eyebrow">REAL-TIME INVENTORY</span><h2>Stock by box size</h2><p class="sub">Track small, medium and large boxes. Low stock means ${T} boxes or fewer.</p></div><a class="text-arrow" href="#/receive">+ Add delivery</a></div>
      <div class="strip"><div><b>${d.boxes_in_stock}</b><small>boxes in stock</small></div><div class="${d.low_stock_lines ? 'warn' : ''}"><b>${d.low_stock_lines}</b><small>bays running low</small></div>
      <div><b>${M(d.revenue)}</b><small>sold so far</small></div><div class="${d.outstanding ? 'warn' : ''}"><b>${M(d.outstanding)}</b><small>owed by vendors</small></div></div>
      <div class="head"><span></span><span>Small</span><span>Medium</span><span>Large</span></div><div class="rack">${rows}</div>
      <details class="panel"><summary>Add a new fruit</summary><form id="ff"><div class="row"><label>Fruit name<input name="fruit_name" required></label><label>Description<input name="description"></label></div>
      <div class="row" style="margin-top:12px">${SIZES.map(s => `<label>${s[0] + s.slice(1).toLowerCase()} price (M)<input name="${s.toLowerCase()}" type="number" min="0" step="0.01" value="${{ SMALL: 8, MEDIUM: 12, LARGE: 18 }[s]}"></label>`).join('')}<button class="pri">Add fruit</button></div></form></details>`;
  },
  bindFloor() {
    $$('[data-price]').forEach(b => b.onclick = async () => {
      const v = prompt('New selling price per box (M):', b.dataset.cur); if (v === null) return;
      try { await api(`/stock/${b.dataset.price}/price`, { method: 'PUT', body: { selling_price: Number(v) } }); toast('Price updated'); route(); } catch (e) { toast(e.message, 1); }
    });
    $$('[data-ef]').forEach(b => b.onclick = () => { const f = pages._fr.find(x => x.fruit_id == b.dataset.ef);
      editForm('Edit fruit', [{ k: 'fruit_name', l: 'Fruit name' }, { k: 'description', l: 'Description', r: false }, { k: 'status', l: 'Status (INACTIVE hides it from sales)', o: ['ACTIVE', 'INACTIVE'] }], f,
        d => api('/fruits/' + f.fruit_id, { method: 'PUT', body: d })); });
    $('#ff').onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      try { await api('/fruits', { method: 'POST', body: { fruit_name: f.fruit_name, description: f.description, prices: { small: +f.small, medium: +f.medium, large: +f.large } } }); toast('Fruit added'); route(); } catch (x) { toast(x.message, 1); } };
  },
    async sell() {
    const [v, st] = await Promise.all([api('/vendors'), api('/stock')]);
    const stock = st.data.filter(s => s.status === 'ACTIVE'), fruits = [...new Map(stock.map(s => [s.fruit_id, s])).values()];
    return { html: `<h1>Sell to a vendor</h1><p class="sub">Pick the fruit, box size and number of boxes. Prices come from the rack and the total adds itself up. If any line is short on stock, the whole sale is rejected and nothing changes.</p>
      <form id="sf" class="panel"><div class="row"><label>Vendor<select name="vendor_id" required>${opts(v.data, 'vendor_id', 'vendor_name', 'Choose vendor')}</select></label>
      <label>Payment<select name="payment_method"><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile money</option><option value="CREDIT">Credit (pay later)</option></select></label>
      <label>Paid now (M)<input name="amount_paid" type="number" min="0" step="0.01" placeholder="Full amount"></label></div>
      <h2>Boxes</h2><div id="lines"></div><button type="button" id="addl">Add another fruit</button>
      <div class="total"><span>Total payable<br><small id="bal" style="color:var(--mute)"></small></span><b id="tot">M0.00</b></div>
      <div id="out"></div><p><button class="pri">Record sale</button></p></form>`,
      bind() {
        const ed = lineEditor($('#lines'), fruits, stock, false, () => {}); 
        
        const upd = () => { 
          let t = 0; 
          ed.read().forEach(l => { 
            const h = $('.hint', l.d); 
            if (l.s) { 
              t += l.quantity * l.s.selling_price; 
              h.textContent = `${M(l.s.selling_price)} a box · ${l.s.available_quantity} in stock = ${M(l.quantity * l.s.selling_price)}`; 
              h.style.color = l.quantity > l.s.available_quantity ? 'var(--bad)' : ''; 
            } else {
              h.textContent = 'Choose a fruit'; 
            } 
          });
          $('#tot').textContent = M(t); 
          const m = $('[name=payment_method]').value, p = $('[name=amount_paid]').value;
          $('#bal').textContent = (m === 'CREDIT' ? p === '' : false) ? 'Whole amount goes on credit' : (p !== '' ? `Balance after payment: ${M(Math.max(t - +p, 0))}` : ''); 
          
          $$('.line', $('#lines')).forEach(el => {
             el.oninput = upd;
             el.onchange = upd;
          });
        };
        
        $('#addl').onclick = ed.add; 
        $('#sf').addEventListener('input', upd);
        upd(); 
        
        $('#sf').onsubmit = async e => { 
          e.preventDefault(); 
          const f = Object.fromEntries(new FormData(e.target)), btn = $('.pri', e.target); 
          btn.disabled = true;
          const body = { vendor_id: +f.vendor_id, payment_method: f.payment_method, items: ed.read().map(l => ({ fruit_id: l.fruit_id, packaging_size: l.packaging_size, quantity: l.quantity })) };
          if (f.amount_paid !== '') body.amount_paid = +f.amount_paid;
          try { 
            const r = (await api('/sales', { method: 'POST', body })).data;
            $('#out').innerHTML = `<div class="okbox"><b>Sale #${r.sale_id} recorded for ${esc(r.vendor_name)}</b><br>${r.items.map(i => `${i.quantity} × ${esc(i.fruit_name)} (${i.packaging_size.toLowerCase()}) at ${M(i.unit_price)}`).join('<br>')}<br>Total ${M(r.total_amount)} · paid ${M(r.amount_paid)} · balance ${M(r.balance)} ${tag(r.payment_status)}</div>`; 
            toast('Sale recorded'); 
          } catch (x) { 
            $('#out').innerHTML = errBox(x); 
          } 
          btn.disabled = false; 
        };
      } };
  },
  

  async receive() {
    const [su, fr] = await Promise.all([api('/suppliers'), api('/fruits')]);
    return { html: `<h1>Receive a delivery</h1><p class="sub">Record boxes bought from a supplier. Stock goes up for the exact fruit and box size, and the total is worked out for you.</p>
      <form id="pf" class="panel"><div class="row"><label>Supplier<select name="supplier_id" required>${opts(su.data, 'supplier_id', s => `${s.business_name} (${s.province})`, 'Choose supplier')}</select></label>
      <label>Delivery date<input name="purchase_date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label></div>
      <h2>Boxes</h2><div id="lines"></div><button type="button" id="addl">Add another fruit</button>
      <div class="total"><span>Total cost</span><b id="tot">M0.00</b></div><div id="out"></div><p><button class="pri">Record delivery</button></p></form>`,
              bind() {
        const ed = lineEditor($('#lines'), fr.data, [], true, () => {}); 
        const upd = () => { $('#tot').textContent = M(ed.read().reduce((t, l) => t + l.quantity * l.unit_cost, 0)); };
        $('#addl').onclick = () => { ed.add(); upd(); };
        $('#pf').addEventListener('input', upd); $('#pf').addEventListener('change', upd); upd();
        $('#pf').onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
          try { const r = (await api('/purchases', { method: 'POST', body: { supplier_id: +f.supplier_id, purchase_date: f.purchase_date, items: ed.read().map(l => ({ fruit_id: l.fruit_id, packaging_size: l.packaging_size, quantity: l.quantity, unit_cost: l.unit_cost })) } })).data;
            $('#out').innerHTML = `<div class="okbox"><b>Delivery #${r.purchase_id} from ${esc(r.supplier_name)} recorded</b><br>Total cost ${M(r.total_amount)}. Stock updated.</div>`; toast('Delivery recorded'); }
          catch (x) { $('#out').innerHTML = errBox(x); } };
      } };
  },

  async vendors() {
    const q = $('#q')?.value || '', r = await api(q ? '/vendors/search?q=' + encodeURIComponent(q) : '/vendors');
    return { html: `<h1>Vendors</h1><p class="sub">Who you sell to, and who still owes you.</p>
      <div class="row"><label>Search by name or phone<input id="q" value="${esc(q)}" placeholder="e.g. Leribe or +26650"></label></div>
      <div class="panel wrap"><table><tr><th>Vendor</th><th>Phone</th><th>Place</th><th class="r">Billed</th><th class="r">Owes</th><th></th></tr>
      ${r.data.map(v => `<tr><td>${esc(v.vendor_name)}</td><td>${esc(v.phone_number)}</td><td>${esc(v.location)}</td><td class="r">${M(v.total_billed)}</td>
      <td class="r">${v.outstanding_balance > 0 ? `<span class="tag bad">${M(v.outstanding_balance)}</span>` : '<span class="tag ok">Clear</span>'}</td>
      <td><button class="link" data-edit="${v.vendor_id}">Edit</button> ${v.outstanding_balance > 0 ? `<button class="link" data-pay="${v.vendor_id}" data-owes="${v.outstanding_balance}" data-name="${esc(v.vendor_name)}">Take payment</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">No vendors match. Try a different name or number.</td></tr>'}</table></div>
      <details class="panel"><summary>Register a vendor</summary><form id="vf"><div class="row"><label>Name<input name="vendor_name" required></label><label>Phone<input name="phone_number" required placeholder="+266…"></label><label>Location<input name="location" required></label><button class="pri">Register vendor</button></div></form></details>`,
      bind() {
        let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(async () => { const pos = $('#q').value; const p = await pages.vendors(); $('#view').innerHTML = p.html; $('#q').value = pos; $('#q').focus(); p.bind(); }, 300); };
        const by = Object.fromEntries(r.data.map(x => [x.vendor_id, x]));
        $$('[data-edit]').forEach(b => b.onclick = () => editForm('Edit vendor', [{ k: 'vendor_name', l: 'Name' }, { k: 'phone_number', l: 'Phone' }, { k: 'location', l: 'Location' }],
          by[b.dataset.edit], d => api('/vendors/' + b.dataset.edit, { method: 'PUT', body: d })));
        $('#vf').onsubmit = async e => { e.preventDefault(); try { await api('/vendors', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Vendor registered'); route(); } catch (x) { toast(x.message, 1); } };
        $$('[data-pay]').forEach(b => b.onclick = async () => {
          let amt = Number(prompt(`${b.dataset.name} owes ${M(b.dataset.owes)}. Amount received (M):`, b.dataset.owes)); if (!(amt > 0)) return;
          const method = confirm('OK = Mobile money, Cancel = Cash') ? 'MOBILE_MONEY' : 'CASH';
          try { const v = (await api('/vendors/' + b.dataset.pay)).data; for (const s of v.unpaid_sales) { if (amt <= 0) break; const pay = Math.min(amt, s.balance); await api(`/sales/${s.sale_id}/payments`, { method: 'POST', body: { amount: pay, payment_method: method } }); amt = Math.round((amt - pay) * 100) / 100; }
            toast('Payment recorded, oldest sales settled first'); route(); } catch (x) { toast(x.message, 1); } });
      } };
  },

    async suppliers() {
    const r = await api('/suppliers');
    return { html: `<h1>Suppliers</h1><p class="sub">Growers across South Africa. A supplier with deliveries on record can’t be deleted.</p>
      <div class="panel wrap"><table><tr><th>Business</th><th>Contact</th><th>Phone</th><th>Province</th><th class="r">Deliveries</th><th></th></tr>
      ${r.data.map(s => `<tr><td>${esc(s.business_name)}</td><td>${esc(s.contact_person)}</td><td>${esc(s.phone)}</td><td>${esc(s.province)}</td><td class="r">${s.purchase_count}</td><td><button class="link" data-map-id="${s.supplier_id}">Map</button> <button class="link" data-edit="${s.supplier_id}">Edit</button> ${getCurrentUser()?.role==='ADMIN'?`<button class="link" data-del="${s.supplier_id}" data-name="${esc(s.business_name)}">Delete</button>`:''}</td></tr>`).join('')}</table></div>
      <details class="panel"><summary>Register a supplier</summary><form id="uf"><div class="row"><label>Business name<input name="business_name" required></label><label>Contact person<input name="contact_person" required></label><label>Phone<input name="phone" required></label></div>
      <div class="row" style="margin-top:12px"><label>Province<select name="province">${opts(PROV)}</select></label><label>Address<input name="address" required></label><button class="pri">Register supplier</button></div></form></details>`,
      bind() {
        $('#uf').onsubmit = async e => { e.preventDefault(); try { await api('/suppliers', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Supplier registered'); route(); } catch (x) { toast(x.message, 1); } };
        
        // Maps use full supplier records; no inaccurate Lesotho fallback.
        $$('[data-map-id]').forEach(b => b.onclick = () => {
          const supplier = r.data.find(s => String(s.supplier_id) === b.dataset.mapId);
          if (supplier) openSupplierMap(supplier);
        });

        const by = Object.fromEntries(r.data.map(x => [x.supplier_id, x]));
        $$('[data-edit]').forEach(b => b.onclick = () => editForm('Edit supplier', [{ k: 'business_name', l: 'Business name' }, { k: 'contact_person', l: 'Contact person' }, { k: 'phone', l: 'Phone' }, { k: 'province', l: 'Province', o: PROV }, { k: 'address', l: 'Address' }],
          by[b.dataset.edit], d => api('/suppliers/' + b.dataset.edit, { method: 'PUT', body: d })));
        $$('[data-del]').forEach(b => b.onclick = async () => { if (!confirm(`Delete ${b.dataset.name}?`)) return; try { await api('/suppliers/' + b.dataset.del, { method: 'DELETE' }); toast('Supplier deleted'); route(); } catch (x) { toast(x.message, 1); } });
      } };
  },  

  async records() {
    const [s, p] = await Promise.all([api('/sales'), api('/purchases')]);
    return { html: `<h1>Records</h1><p class="sub">Every sale and delivery on file. Open one to see its boxes.</p>
      <h2>Sales</h2><div class="panel wrap"><table><tr><th>No.</th><th>Date</th><th>Vendor</th><th class="r">Boxes</th><th class="r">Total</th><th class="r">Balance</th><th>Payment</th><th></th></tr>
      ${s.data.map(x => `<tr><td>${x.sale_id}</td><td>${x.sale_date}</td><td>${esc(x.vendor_name)}</td><td class="r">${x.boxes}</td><td class="r">${M(x.total_amount)}</td><td class="r">${M(x.balance)}</td><td>${tag(x.payment_status)}</td><td><button class="link" data-sale="${x.sale_id}">View</button></td></tr>`).join('') || '<tr><td colspan="8">No sales yet. Record one on the Sell page.</td></tr>'}</table></div>
      <h2>Deliveries</h2><div class="panel wrap"><table><tr><th>No.</th><th>Date</th><th>Supplier</th><th>Province</th><th class="r">Boxes</th><th class="r">Cost</th><th></th></tr>
      ${p.data.map(x => `<tr><td>${x.purchase_id}</td><td>${x.purchase_date}</td><td>${esc(x.supplier_name)}</td><td>${esc(x.province)}</td><td class="r">${x.boxes}</td><td class="r">${M(x.total_amount)}</td><td><button class="link" data-pur="${x.purchase_id}">View</button></td></tr>`).join('') || '<tr><td colspan="7">No deliveries yet.</td></tr>'}</table></div>`,
      bind() {
        const items = (rows, k) => `<table><tr><th>Fruit</th><th>Size</th><th class="r">Boxes</th><th class="r">${k === 'unit_price' ? 'Price' : 'Cost'}</th><th class="r">Line</th></tr>${rows.map(i => `<tr><td>${esc(i.fruit_name)}</td><td>${i.packaging_size.toLowerCase()}</td><td class="r">${i.quantity}</td><td class="r">${M(i[k])}</td><td class="r">${M(i.line_total)}</td></tr>`).join('')}</table>`;
        $$('[data-sale]').forEach(b => b.onclick = async () => { try { const r = (await api('/sales/' + b.dataset.sale)).data;
          dialog(`Sale #${r.sale_id}: ${esc(r.vendor_name)}`, `${items(r.items, 'unit_price')}<div class="total"><span>Total ${M(r.total_amount)}<br><small style="color:var(--mute)">Paid ${M(r.amount_paid)} by ${r.payment_method.replace('_', ' ').toLowerCase()}. Owes ${M(r.balance)}</small></span>${tag(r.payment_status)}</div>`); } catch (x) { toast(x.message, 1); } });
        $$('[data-pur]').forEach(b => b.onclick = async () => { try { const r = (await api('/purchases/' + b.dataset.pur)).data;
          dialog(`Delivery #${r.purchase_id}: ${esc(r.supplier_name)}`, `${items(r.items, 'unit_cost')}<div class="total"><span>Total cost</span><b>${M(r.total_amount)}</b></div>`); } catch (x) { toast(x.message, 1); } });
      } };
  },

  async reports() {
    const [top, tv, sl, lo] = await Promise.all([api('/reports/top-fruits'), api('/reports/top-vendor'), api('/reports/stock-levels'), api('/stock/low')]);
    const max = Math.max(...top.data.map(x => x.boxes_sold), 1), tvd = tv.data;
    return { html: `<h1>Reports</h1><p class="sub">Sales and stock, straight from the database.</p>
      <h2>Best-selling fruits</h2><div class="panel">${top.data.map(f => `<div style="display:grid;grid-template-columns:100px 1fr 90px;gap:12px;align-items:center;margin:8px 0;--c:${col(f.fruit_name)}"><b>${esc(f.fruit_name)}</b><div class="bar" style="width:${f.boxes_sold / max * 100}%"></div><span>${f.boxes_sold} boxes</span></div>`).join('') || 'No sales yet.'}</div>
      <h2>Biggest buyer</h2><div class="panel">${tvd ? `<b>${esc(tvd.vendor_name)}</b> in ${esc(tvd.location)} has bought ${tvd.total_boxes} boxes in total.` : 'No sales yet.'}</div>
      <h2>Running low (${lo.threshold} boxes or fewer)</h2><div class="panel">${lo.data.map(x => `<div style="margin:6px 0"><b>${esc(x.fruit_name)}</b>, ${x.packaging_size.toLowerCase()}: <span class="tag bad">${x.available_quantity} left</span></div>`).join('') || 'Every bay is well stocked.'}</div>
      <h2>Revenue for a period</h2><form id="rf" class="panel"><div class="row"><label>From<input type="date" name="from" required value="${new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)}"></label><label>To<input type="date" name="to" required value="${new Date().toISOString().slice(0, 10)}"></label><button class="pri">Show revenue</button></div><div id="rv"></div></form>
      <h2>Stock by fruit and size</h2><div class="panel wrap"><table><tr><th>Fruit</th><th>Size</th><th class="r">Boxes</th><th class="r">Price</th></tr>${sl.data.map(s => `<tr><td>${esc(s.fruit_name)}</td><td>${s.packaging_size.toLowerCase()}</td><td class="r">${s.available_quantity}</td><td class="r">${M(s.selling_price)}</td></tr>`).join('')}</table></div>`,
      bind() { $('#rf').onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
        try { const r = (await api(`/reports/revenue?from=${f.from}&to=${f.to}`)).data; $('#rv').innerHTML = `<div class="okbox"><b>${M(r.revenue)}</b> billed across ${r.sales_count} sale(s); ${M(r.collected)} collected.</div>`; } catch (x) { $('#rv').innerHTML = errBox(x); } }; } };
  }
};

/* ---------- cinematic section banners and customer contact ---------- */
const PAGE_ART = {
 sell:{label:'SELL FRESH · SELL SMART',image:'sales',note:'Serve every vendor with confidence and track every sale.',chip:'FRESH ORDERS'},
 receive:{label:'DIRECT FROM GROWERS',image:'purchases',note:'Record deliveries and keep fresh produce moving.',chip:'SUPPLY IN MOTION'},
 records:{label:'A HISTORY OF FRESHNESS',image:'records',note:'Find the full story behind every sale and purchase.',chip:'COMPLETE RECORDS'},
 vendors:{label:'BETTER PARTNERSHIPS',image:'vendors',note:'Supporting retailers and market vendors across Lesotho.',chip:'GROWING TOGETHER'},
 suppliers:{label:'FROM THE SOURCE',image:'suppliers',note:'Connect your distribution business with its South African growers.',chip:'TRUSTED SUPPLY'},
 reports:{label:'INSIGHTS THAT GROW',image:'reports',note:'Turn daily transactions into decisions for tomorrow.',chip:'BUSINESS INTELLIGENCE'}
};
function buildPageBanner(key,html) {
 const a=PAGE_ART[key]; if (!a) return html;
 const re=/^\s*<h1>([\s\S]*?)<\/h1>\s*<p class="sub">([\s\S]*?)<\/p>/;
 const match=html.match(re); if (!match) return html;
 return `<section class="page-banner page-banner-${key}" style="--page-image:url('assets/${a.image}.webp')"><div class="page-banner-content">
 <span class="eyebrow">✦ &nbsp; ${a.label}</span><h1>${match[1]}</h1><p>${match[2]}</p>
 <div class="page-banner-accent"><i class="pulse-dot"></i>${a.chip}</div></div><span class="page-banner-side">BATLOUNG FARM · FRESH PRODUCE</span></section>
 <div class="page-intro-note">${a.note}</div>${html.replace(re,'')}`;
}
function openWhatsApp(message) {
 const phone=String(PUBLIC_CONFIG.ownerWhatsApp || '').replace(/\D/g,'');
 if (!/^\d{8,15}$/.test(phone)) {
   dialog('WhatsApp contact is not configured','<p>To activate customer enquiries, add your business WhatsApp number to <code>frontend/site-config.js</code> under <code>ownerWhatsApp</code>. The number must include the country code.</p>');
   return;
 }
 window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(message || String(PUBLIC_CONFIG.whatsappMessage||'Hello Batloung Farm!')), '_blank','noopener,noreferrer');
}
function initWhatsApp() {
 const btn=$('#whatsapp-button'); if (!btn) return;
 btn.onclick=()=>openWhatsApp(String(PUBLIC_CONFIG.whatsappMessage||'Hello Batloung Farm!'));
}

/* ---------- real access control + role-aware navigation ---------- */
let currentUser = null;
let pendingTarget = null;
const getCurrentUser = () => currentUser;
function setCurrentUser(user) { currentUser = user || null; }
const STAFF_PAGES = ['sell','receive','records','vendors','suppliers'];
const ROLE_ROUTES = {
  floor: ['ADMIN'], work: ['ADMIN','EMPLOYEE'], team: ['ADMIN'], reports: ['ADMIN'],
  sell: ['ADMIN','EMPLOYEE'], receive: ['ADMIN','EMPLOYEE'], records: ['ADMIN','EMPLOYEE'],
  vendors: ['ADMIN','EMPLOYEE'], suppliers: ['ADMIN','EMPLOYEE'], account: ['ADMIN','EMPLOYEE','CUSTOMER']
};
const allowedPage = (key, user) => !ROLE_ROUTES[key] || (!!user && ROLE_ROUTES[key].includes(user.role) && (!user.must_change_password || key==='account'));
function renderAuthChrome() {
  const u = getCurrentUser();
  const nav = u?.role === 'ADMIN'
     ? [['store','Discover'],['floor','Dashboard'],['sell','Sales'],['receive','Purchases'],['records','Records'],['vendors','Vendors'],['suppliers','Suppliers'],['reports','Reports'],['team','Team']]
     : u?.role === 'EMPLOYEE'
     ? [['store','Discover'],['work','Workspace'],['sell','Sales'],['receive','Purchases'],['records','Records'],['vendors','Vendors'],['suppliers','Suppliers']]
     : [['store','Discover']];
  $('#nav').innerHTML = nav.map(([key,title]) => `<a href="#/${key}" data-k="${key}">${title}</a>`).join('');
  const initials = u ? u.full_name.split(' ').map(x => x[0]||'').slice(0,2).join('').toUpperCase() : '';
  $('#auth-chrome').innerHTML = u
      ? `<span class="${u.role==='CUSTOMER'?'customer-indicator':'live-indicator'}"><i></i>${u.role==='CUSTOMER'?' CUSTOMER':' '+u.role+' ACCESS'}</span><a class="profile-chip" href="#/account" title="My account"><span class="profile-dot">${esc(initials)}</span><span class="profile-name">${esc(u.full_name.split(' ')[0])}</span></a><button id="header-signout" class="signout-chip" type="button" title="Sign out">↪</button>`
      : `<span class="visitor-label">✦ Guest browsing</span><a class="login-chip" href="#/login">Sign in</a><a class="join-chip" href="#/register">Join free</a>`;
  const signout = $('#header-signout'); if (signout) signout.onclick = signOut;
  const staffAdd = $('#float-staff-add');
  if (staffAdd) staffAdd.style.setProperty('display',u && ['ADMIN','EMPLOYEE'].includes(u.role) && !u.must_change_password?'grid':'none','important');
}
function accessGate(key) {
  const user = getCurrentUser();
  if (!user) pendingTarget = key;
  const authenticated = Boolean(user);
  return `<section class="access-gate"><div class="access-gate-art"></div><div class="access-gate-body"><span class="eyebrow">🔒 PRIVATE BATLOUNG FARM WORKSPACE</span>
      <h1>${authenticated?'This area is not included in your access.':'Sign in to continue.'}</h1>
      <p>${authenticated?'Your '+esc(user.role.toLowerCase())+' account cannot access this section. Business records are protected by server-side permissions.':'Customers and visitors can explore our fruit catalogue freely. Staff must sign in to access internal business information.'}</p>
      <div class="hero-buttons">${authenticated?`<a class="pri" href="#/${user.role==='ADMIN'?'floor':user.role==='EMPLOYEE'?'work':'store'}">Go to my home →</a>`:'<a class="pri" href="#/login">Sign in →</a>'}<a class="hero-secondary" href="#/store">Browse as guest →</a></div>
    </div></section>`;
}
async function signedIn(user) {
  setCurrentUser(user); renderAuthChrome();
  const target = user.must_change_password ? 'account' : (pendingTarget && allowedPage(pendingTarget,user) ? pendingTarget : ({ADMIN:'floor',EMPLOYEE:'work',CUSTOMER:'store'}[user.role] || 'store'));
  pendingTarget = null;
  if (location.hash === '#/'+target) route(); else location.hash='#/'+target;
}
async function signOut() {
  try {await api('/auth/logout',{method:'POST'}); setCurrentUser(null); pendingTarget=null; renderAuthChrome(); toast('Signed out securely.'); if(location.hash==='#/store') route();else location.hash='#/store';}
  catch(err){toast(err.message,true)}
}
$('#menu-toggle').onclick = () => { const open = $('#nav').classList.toggle('menu-open'); $('#menu-toggle').setAttribute('aria-expanded', String(open)); };
$('#back-top').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
let routeVersion = 0;
async function route() {
  const version = ++routeVersion;
  const k = (location.hash.match(/#\/(\w+)/) || [, 'store'])[1], view = $('#view');
  view.dataset.page = k;
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.k === k));
  $('#nav').classList.remove('menu-open'); $('#menu-toggle').setAttribute('aria-expanded','false');
  const bar = $('#page-progress'); bar.classList.add('loading');
  view.setAttribute('aria-busy','true');
  view.innerHTML = `<div class="page-skeleton"><span class="skeleton-line large"></span><span class="skeleton-line"></span><div class="skeleton-block"></div><div class="skeleton-row"><div></div><div></div><div></div></div></div>`;
  try {
    let html, bind = () => {};
    if (!allowedPage(k,getCurrentUser())) html = accessGate(k);
    else if (k==='login' && getCurrentUser()) html = `<section class="access-gate"><div class="access-gate-body"><h1>You are already signed in.</h1><p>You're signed in as ${esc(getCurrentUser().full_name)}.</p><a class="pri" href="#/account">Go to my account →</a></div></section>`;
    else if (k==='register' && getCurrentUser()) html = `<section class="access-gate"><div class="access-gate-body"><h1>Welcome back!</h1><p>You already have an account. Continue browsing or manage your profile.</p><a class="pri" href="#/account">My account →</a></div></section>`;
    else if (k==='floor') { html = await pages.floor(); bind = () => pages.bindFloor(); }
    else if (pages[k]) { const p = await pages[k](); html = p.html; bind = p.bind; }
    else if (window.AuthPages?.[k]) { const p = await window.AuthPages[k](); html = p.html; bind = p.bind; }
    else html = `<section class="access-gate"><div class="access-gate-body"><h1>Page not found.</h1><a class="pri" href="#/store">Explore our produce →</a></div></section>`;
    if (version !== routeVersion) return;
    view.innerHTML = buildPageBanner(k, html); view.classList.remove('page-enter');void view.offsetWidth;view.classList.add('page-enter');
    bind(); if (location.hash && window.scrollY > 200) window.scrollTo({top:0,behavior:'instant'});
  } catch (e) { if (version===routeVersion) view.innerHTML = `<section class="panel"><h1>Something's not working</h1>${errBox(e)}<p><button type="button" onclick="route()">Try again</button> <a href="#/store">Browse produce</a></p></section>`; }
  finally { if (version === routeVersion) { view.setAttribute('aria-busy','false'); bar.classList.remove('loading'); } }
}
async function initializeApp() {
  initWhatsApp();
  try { const response=await api('/auth/me'); setCurrentUser(response.data); }
  catch(err){console.warn('Account status unavailable:',err.message);setCurrentUser(null);}
  renderAuthChrome();
  addEventListener('hashchange',route); route();
}
initializeApp();
