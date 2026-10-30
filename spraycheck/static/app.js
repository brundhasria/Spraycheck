/* SprayCheck frontend: UI only. OCR, banned check and dose maths run on the Python API. */
var API = window.API_BASE || '';
var banTa = 'இது தமிழ்நாட்டில் தடை செய்யப்பட்டது. இந்த மருந்தைப் பயன்படுத்த வேண்டாம்.';
var doseTa = '', cur = null, busy = false, verified = '';

// Sample packets (alternating safe / banned) for trying the app without a real packet.
var SAMPLES = [
  {n:'பேடி-ஷீல்ட்', v:'500 கிராம்', i:'டிரைசைக்ளசோல் 75% WP', d:'120 கிராம்', tk:15, ac:3},
  {n:'சேஃப்-குரோ', v:'500 மி.லி', i:'குளோர்பைரிபாஸ் 20% EC', d:'500 மி.லி', tk:10, ac:5},
  {n:'காட்டன்-கார்டு', v:'250 மி.லி', i:'இமிடாக்ளோபிரிட் 17.8% SL', d:'50 மி.லி', tk:16, ac:2},
  {n:'கில்லர்-எக்ஸ்', v:'250 மி.லி', i:'மோனோகுரோட்டோபாஸ் 36% SL', d:'600 மி.லி', tk:10, ac:1.5},
  {n:'வேம்பு-பிளஸ்', v:'1 லிட்டர்', i:'அசாடிராக்டின் 1500 ppm', d:'400 மி.லி', tk:12, ac:4},
  {n:'எண்டோ-கில்', v:'500 மி.லி', i:'எண்டோசல்பான் 35% EC', d:'400 மி.லி', tk:10, ac:2}
];
SAMPLES.forEach(function (s) {
  s.t = 'பெயர்: ' + s.n + ' ' + s.v + '. உள்ளடக்கம்: ' + s.i + '. அளவு: ' + s.d + '/ஏக்கர்';
});

function $(i) { return document.getElementById(i); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function unitTa(u) { return u === 'g' ? 'கிராம்' : 'மி.லி.'; }

/* ---------- navigation ---------- */
var IC = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>',
  hist: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  prof: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  ban: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 8v5M12 16h.01"/>'
};
var LB = {home:'முகப்பு', scan:'ஸ்கேன்', dose:'அளவு', ban:'தடை எச்சரிக்கை', hist:'வரலாறு', prof:'சுயவிவரம்'};
var SETS = {dose:['scan','dose','hist','prof'], ban:['home','ban','hist','prof']};

function nav(s) {
  var set = SETS[s] || ['home','scan','hist','prof'];
  var b = function (k) {
    return '<button class="' + (k === s ? 'on' : '') + '" onclick="go(\'' + (k === 'dose' && !(cur && cur.name) ? 'scan' : k) +
      '\')"><svg viewBox="0 0 24 24">' + (IC[k] || IC.scan) + '</svg>' + LB[k] + '</button>';
  };
  var red = s === 'ban';
  $('nav').innerHTML = b(set[0]) + b(set[1]) + '<div class="mid"><div class="logo ' + (red ? 'r' : '') +
    '" onclick="go(\'' + (red ? 'ban' : 'home') + '\')">' +
    (red ? '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" style="width:30px;height:30px">' + IC.ban + '</svg>'
         : '<svg viewBox="0 0 24 24" fill="#2a7d3f"><path d="M12 21c0-6 2-9 8-11-1 6-3 9-8 11zM12 21C12 15 10 12 4 10c1 6 3 9 8 11z"/></svg>ஸ்ப்ரே செக்') +
    '</div></div>' + b(set[2]) + b(set[3]);
}
function go(s) {
  document.querySelectorAll('.sc').forEach(function (e) { e.classList.remove('on'); });
  $('s-' + s).classList.add('on');
  $('ph').classList.toggle('red', s === 'ban');
  nav(s);
  if (s === 'hist') renderH();
}

/* ---------- API ---------- */
function api(path, opts) {
  return fetch(API + path, opts).then(function (r) {
    if (r.ok) return r.json();
    return r.json().catch(function () { return {}; }).then(function (e) {
      throw new Error(typeof e.detail === 'string' ? e.detail : 'தவறான உள்ளீடு அல்லது சர்வர் பிழை');
    });
  });
}
function postJson(path, body) {
  return api(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
}
function fail(e) {
  $('err').textContent = (e && e.message && e.message !== 'Failed to fetch') ? e.message
    : 'சர்வருடன் இணைக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';
}
function startScan() {
  busy = true; $('err').textContent = '';
  $('cam').classList.add('scanning'); $('chip').classList.add('on');
}
function endScan() {
  busy = false;
  $('cam').classList.remove('scanning'); $('chip').classList.remove('on');
}

/* ---------- scanning ---------- */
function photo(input) {
  var f = input.files[0];
  if (!f || busy) return;
  var r = new FileReader();
  r.onload = function () {
    $('cam').style.backgroundImage = 'url(' + r.result + ')';
    $('pk').style.display = 'none';
    $('cam').querySelector('.hand').style.display = 'none';
  };
  r.readAsDataURL(f);
  var fd = new FormData();
  fd.append('file', f);
  input.value = '';
  startScan();
  api('/api/scan', {method: 'POST', body: fd}).then(handle).catch(fail).then(endScan);
}

var si = -1;
function sample() {
  if (busy) return;
  si = (si + 1) % SAMPLES.length;
  var s = SAMPLES[si];
  $('pnm').textContent = s.n; $('pvl').textContent = s.v;
  $('pl').textContent = 'அடங்கியது: ' + s.i;
  $('tank').value = s.tk; $('ac').value = s.ac;
  $('dl').textContent = (si + 1) + '/' + SAMPLES.length + ' ' + s.n;
  $('pk').style.display = ''; $('cam').style.backgroundImage = '';
  $('cam').querySelector('.hand').style.display = '';
  $('ocr').value = s.t;
  runText(s.t);
}
function checkText() {
  var t = $('ocr').value.trim();
  if (t && !busy) runText(t);
}
function runText(t) {
  startScan();
  postJson('/api/check-text', {text: t}).then(handle).catch(fail).then(endScan);
}

function handle(r) {
  cur = {name: r.name, ing: r.ingredient, dose: r.dose, unit: r.unit};
  if (r.ocr_text) $('ocr').value = r.ocr_text;
  if (r.banned_list_verified) verified = r.banned_list_verified;
  $('t2').value = $('tank').value || 10;
  if (r.status === 'banned') {
    hist(cur, 'தடை செய்யப்பட்டது');
    $('bx').innerHTML = '<b>பூச்சிக்கொல்லி:</b> ' + esc(r.name) + (r.ingredient ? ' (' + esc(r.ingredient) + ')' : '') +
      '<br><b>மூலம்:</b> பாக்கெட் புகைப்படத்திலிருந்து OCR மூலம் கண்டறியப்பட்டது' +
      '<br><b>நிலை:</b> தமிழ்நாடு அரசால் <b>தடை செய்யப்பட்டது</b><hr>' +
      'தற்போதைய விதிமுறைகளின்படி வைத்திருப்பதும் பயன்படுத்துவதும் கண்டிப்பாகத் தடைசெய்யப்பட்டுள்ளது. ' +
      '(ஆதாரம்: தமிழ்நாடு அரசிதழ், கடைசியாகச் சரிபார்க்கப்பட்டது: ' + esc(verified) + ')<hr>' +
      '<div class="dn"><svg width="38" height="44" viewBox="0 0 38 44"><rect x="8" y="14" width="18" height="28" rx="3" fill="#ddd"/><rect x="12" y="6" width="10" height="9" fill="#bbb"/><circle cx="17" cy="28" r="6" fill="#a01212"/><path d="M26 4l10 10M36 4L26 14" stroke="#ff5a5a" stroke-width="3"/></svg>' +
      '<div>⚠️ இந்த பூச்சிக்கொல்லியைப் பயன்படுத்த வேண்டாம்!<br>தெளிக்க வேண்டாம்!' +
      '<div style="font-weight:400">உள்ளூர் வேளாண் அதிகாரிகளைத் தொடர்பு கொள்ளுங்கள்.</div></div></div>';
    go('ban'); say(banTa); return;
  }
  $('pn').value = r.name;
  $('ld').textContent = r.dose ? 'லேபிளில் படித்த அளவு: ' + r.dose + ' ' + unitTa(r.unit) + '/ஏக்கர்'
                               : 'லேபிளில் அளவு தெரியவில்லை. வேளாண் அலுவலரிடம் கேளுங்கள்.';
  $('res').style.display = 'none'; $('ex').textContent = '';
  go('dose');
}

/* ---------- dose ---------- */
function calc() {
  if (!cur || !cur.dose) { $('ex').textContent = 'லேபிளில் அளவு இல்லை. வேளாண் அலுவலரிடம் கேளுங்கள்.'; return; }
  var t = +$('t2').value, a = +$('ac').value, w = +$('wa').value || 200;
  postJson('/api/dose', {dose_per_acre: cur.dose, unit: cur.unit, acres: a, tank_litres: t, water_per_acre: w})
    .then(function (d) {
      var u = unitTa(d.unit), total = Math.round(d.total);
      $('rb').textContent = total + ' ' + u;
      doseTa = 'தேவையான மருந்து அளவு: ' + total + ' ' + u;
      $('rt').textContent = doseTa; $('res').style.display = 'block';
      $('ex').textContent = t + 'லி டாங்கிற்கு, ' + a + ' ஏக்கரில் ' + cur.dose + ' ' + u +
        '/ஏக்கர் என்ற விகிதத்தில் கணக்கிடப்பட்டுள்ளது. ஒரு டாங்கிற்கு ' + d.per_tank + ' ' + u;
      hist(cur, total + ' ' + u);
      say(doseTa + ' ஒரு டாங்கிற்கு ' + d.per_tank + ' ' + u);
    })
    .catch(function (e) { $('ex').textContent = e.message; });
}

/* ---------- voice + history ---------- */
function say(t) {
  try {
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(t); u.lang = 'ta-IN';
    var v = speechSynthesis.getVoices().find(function (x) { return x.lang && x.lang.indexOf('ta') === 0; });
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) {}
}
function hist(p, r) {
  try {
    var h = JSON.parse(localStorage.getItem('sc') || '[]');
    h.unshift({n: p.name, r: r, d: new Date().toLocaleString('ta-IN')});
    localStorage.setItem('sc', JSON.stringify(h.slice(0, 20)));
  } catch (e) {}
}
function renderH() {
  var h = [];
  try { h = JSON.parse(localStorage.getItem('sc') || '[]'); } catch (e) {}
  $('hl').innerHTML = h.length ? h.map(function (x) {
    return '<div class="hi"><b>' + esc(x.n) + '</b> · ' + esc(x.r) + '<br><span style="color:var(--mu)">' + esc(x.d) + '</span></div>';
  }).join('') : '<p class="sm">இன்னும் ஸ்கேன் எதுவும் இல்லை.</p>';
}

/* ---------- init ---------- */
api('/api/health').then(function (h) { verified = h.banned_list_verified; $('lv').textContent = verified; })
  .catch(function () { $('lv').textContent = '—'; });
nav('scan');
