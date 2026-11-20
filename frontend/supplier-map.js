'use strict';
// Geographic reference cities in South African provinces, NOT supplier locations.
const SA_PROVINCE_REFERENCE = {
  'Gauteng': [-26.2041,28.0473], 'Free State': [-29.1195,26.2249],
  'KwaZulu-Natal': [-29.8587,31.0218], 'Western Cape': [-33.9249,18.4241],
  'Eastern Cape': [-33.9608,25.6022], 'Limpopo': [-23.9045,29.4689],
  'Mpumalanga': [-25.4753,30.9694], 'North West': [-25.8652,25.6442]
};
function supplierAddress(s) {
  const raw = String(s.address || '').trim();
  return [raw, ...(!raw.toLowerCase().includes(String(s.province).toLowerCase()) ? [s.province] : []),
    ...(!/south africa/i.test(raw) ? ['South Africa'] : [])].filter(Boolean).join(', ');
}
function southAfricaCoords(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -35 && lat <= -22 && lon >= 16 && lon <= 33;
}
function ownerPin(s) {
  const pin = (window.BATLOUNG_CONFIG?.supplierPins || {})[s.business_name];
  const lat = Number(pin?.lat), lng = Number(pin?.lng);
  return pin?.verified === true && southAfricaCoords(lat,lng) ? {lat,lng} : null;
}
function provinceMatches(place, province) {
  const a = place.address || {};
  const state = [a.state,a.province,a.region].filter(Boolean).join(' ').toLowerCase();
  const norm = s => String(s).toLowerCase().replace(/[^a-z]/g,'');
  return Boolean(state) && norm(state).includes(norm(province));
}
function candidateFor(s, results) {
  const valid = (Array.isArray(results) ? results : []).filter(x =>
    x.address?.country_code === 'za' && provinceMatches(x, s.province) &&
    southAfricaCoords(Number(x.lat),Number(x.lon)));
  if (!valid.length) return null;
  const street = String(s.address || '').split(',')[0].replace(/^\s*\d+\s+/,'').trim();
  const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const streetResult = valid.find(x => street.length >= 5 &&
    norm(x.address?.road || x.address?.pedestrian || x.address?.residential).includes(norm(street)));
  if (!streetResult) return {type:'area', place:valid[0]};
  const number = String(s.address || '').match(/^\s*(\d+)/)?.[1];
  const exactHouse = Boolean(number && String(streetResult.address?.house_number || '') === number);
  return {type:exactHouse ? 'address' : 'road', place:streetResult};
}
function openSupplierMap(s) {
  const address = supplierAddress(s);
  const exact = ownerPin(s);
  const region = SA_PROVINCE_REFERENCE[s.province] || [-30.5595,22.9375];
  const search = exact ? `${exact.lat},${exact.lng}` : address;
  const googleUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(search);
  dialog('Supplier location · ' + esc(s.business_name), `
    <div class="map-dialog-caption"><span class="eyebrow">SUPPLIER MAP · SOUTH AFRICA</span>
    <p><strong>${esc(address)}</strong></p></div>
    <div class="map-status" role="status" aria-live="polite">${exact ? 'Using a supplier-confirmed pin configured by the website owner.' : 'Checking the supplier address in South Africa…'}</div>
    <div id="supplier-map" class="supplier-map" aria-label="Supplier map"></div>
    <div class="map-actions"><a class="pri" href="${esc(googleUrl)}" target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a>
    <small>Google Maps searches for the written address unless confirmed GPS coordinates are configured.</small></div>
    <details class="map-help"><summary>How do I show the exact supplier location?</summary>
    <p>Get the location directly from the supplier, copy its latitude and longitude, and add it in <code>frontend/site-config.js</code> under <code>supplierPins</code> using the exact business name with <code>verified: true</code>. Deploy the update to share the correct location with every customer. No SQL changes needed.</p></details>
  `, d => {
    const status = $('.map-status',d), host = $('#supplier-map',d);
    if (!window.L) {
      status.textContent = 'Map library unavailable. Use the Google Maps search link.';
      host.innerHTML = '<p class="err">Could not load the map library.</p>';
      return;
    }
    const map = L.map(host,{scrollWheelZoom:false}).setView(region,7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,attribution:'© OpenStreetMap contributors'
    }).addTo(map);
    d.addEventListener('close',()=>map.remove(),{once:true});
    setTimeout(()=>map.invalidateSize(),70);
    const mark=(lat,lng,note)=>{
      map.setView([lat,lng],16);
      L.marker([lat,lng]).addTo(map).bindPopup(`<b>${esc(s.business_name)}</b><br>${esc(note)}`).openPopup();
    };
    if (exact) {mark(exact.lat,exact.lng,'Coordinates confirmed by website owner');status.classList.add('verified');return;}
    const abort = new AbortController();
    d.addEventListener('close',()=>abort.abort(),{once:true});
    (async()=>{
      try {
        const qs=new URLSearchParams({format:'jsonv2',q:address, countrycodes:'za',addressdetails:'1',limit:'5'});
        // Cache successful lookups on this browser to reduce requests to the public map service.
        const cacheKey = 'bf-geocode:' + address.toLowerCase();
        let results = null;
        try {
          const item = JSON.parse(localStorage.getItem(cacheKey) || 'null');
          if (item && Date.now() - item.time < 7 * 86400000) results = item.results;
        } catch (_) { /* private browsing or blocked storage: search normally */ }
        if (!results) {
          const resp=await fetch('https://nominatim.openstreetmap.org/search?'+qs,{signal:abort.signal,headers:{Accept:'application/json'}});
          if (!resp.ok) throw new Error('Search failed');
          results=await resp.json();
          try { localStorage.setItem(cacheKey,JSON.stringify({time:Date.now(),results})); } catch (_) {}
        }
        const match=candidateFor(s,results);
        if (abort.signal.aborted) return;
        if (match?.type==='address') {
          mark(Number(match.place.lat),Number(match.place.lon),'Possible street-address match; supplier premises not independently verified');
          status.textContent='Possible street-number match in '+s.province+'. Confirm with the supplier before relying on this pin.';
        } else if (match?.type==='road') {
          const loc=[Number(match.place.lat),Number(match.place.lon)];
          map.setView(loc,13);L.circle(loc,{radius:1000,color:'#ffc46d',fillOpacity:.12}).addTo(map);
          status.textContent='The street was found in '+s.province+', but not the exact premises. The shaded area is approximate; no supplier pin is shown.';
        } else if (match?.type==='area') {
          map.setView([Number(match.place.lat),Number(match.place.lon)],9);
          status.textContent='Only the general area was found in '+s.province+'. No supplier pin is shown. Add supplier-confirmed GPS coordinates.';
        } else {
          status.textContent='Exact address not found. Showing a '+s.province+' reference map — NOT a supplier location. Add confirmed GPS coordinates for a pin.';
        }
        status.classList.add('caution');
      } catch (e) {
        if (abort.signal.aborted) return;
        status.textContent='Address search unavailable. The map shows a '+s.province+' reference area only, not a supplier pin.';
        status.classList.add('caution');
      }
    })();
  });
}
