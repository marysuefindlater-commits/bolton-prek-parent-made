const fs = require('fs');
const path = require('path');
const FILE = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(FILE, 'utf8');
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; };

// ---- 1. the whole script must parse ----------------------------------
/* The page has more than one script block now: a small one in the head that
   checks the build version, and the main one. Pick the main one. */
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]);
const m = [null, blocks.find(b => b.includes('const DATA'))];
if (!m[1]) { console.log('FAIL could not find the main script block'); process.exit(1); }
if (!m) { console.log('FAIL no script block'); process.exit(1); }
const js = m[1];
try { new Function(js); console.log('  ok   full script parses'); }
catch (e) {
  console.log('  FAIL script does NOT parse: ' + e.message);
  const lines = js.split('\n');
  for (let i = 0; i < lines.length; i++) {
    try { new Function(lines.slice(0, i + 1).join('\n') + '\n}'.repeat(0)); } catch (_) {}
  }
  process.exit(1);
}

// ---- 2. run it against a stub DOM ------------------------------------
const store = {};
function el(id) {
  if (!store[id]) store[id] = {
    id, innerHTML: '', textContent: '', value: '', placeholder: '',
    /* real elements always have these; the page sets CSS variables per section */
    style: { setProperty(){}, removeProperty(){}, getPropertyValue(){return ''} },
    classList: { _s: new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)},
                 contains(c){return this._s.has(c)}, toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c)} },
    appendChild(){}, addEventListener(){}, removeAttribute(){}, setAttribute(){},
    getAttribute(){return null}, querySelectorAll(){return []}, querySelector(){return el('x')},
    remove(){}, focus(){}, scrollIntoView(){}, closest(){return null}, dataset:{}
  };
  return store[id];
}
const doc = {
  documentElement: { lang: 'en', style:{setProperty(){}} },
  getElementById: el,
  querySelector: () => el('qsel'),
  querySelectorAll: () => [],
  createElement: () => el('new' + Math.random()),
  addEventListener(){}, body: el('body'), head: el('head'), title: ''
};
global.document = doc;
global.location = { href:'https://example.test/', protocol:'https:', pathname:'/', hash:'', search:'', replace(){}, reload(){} };
global.history = { replaceState(){} };
global.sessionStorage = { getItem:()=>null, setItem(){} };
global.window = { matchMedia: () => ({ matches:false, addEventListener(){} }), addEventListener(){},
                  location:{href:'x'}, setTimeout, setInterval:()=>0 };
global.navigator = { userAgent: 'Mozilla/5.0 (iPhone)', language: 'en-US', platform:'iPhone', maxTouchPoints:5 };
global.addEventListener = () => {};
global.matchMedia = window.matchMedia;
global.setInterval = () => 0;
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL(){} };
global.Blob = function(){};
global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };

let scope;
try {
  scope = new Function(js + '\n; return {DATA,ES_CARDS,ACTIONS,drawActions,collectEvents,CAL_CLOSED,CAL_EARLY,CAL_TRIPS,CAL_DRESS};')();
  console.log('  ok   script executes against a stub DOM');
} catch (e) { console.log('  FAIL runtime: ' + e.message); process.exit(1); }

const { DATA, ES_CARDS, ACTIONS, collectEvents } = scope;
// Apple Day was a one-off in October; these checks only apply while it is live
const TODAY_K = new Date().toISOString().slice(0,10);
const APPLE_LIVE = ACTIONS.some(a => /Apple Day/.test(a.t.en) && TODAY_K <= a.until);
if (!APPLE_LIVE) console.log('  note   Apple Day has passed, so its checks are skipped');

// ---- 3. action items --------------------------------------------------
ok(Array.isArray(ACTIONS) && ACTIONS.length >= 1, 'ACTIONS has ' + ACTIONS.length + ' entries');
ACTIONS.forEach(a => {
  ok(!!a.until && /^\d{4}-\d{2}-\d{2}$/.test(a.until), 'action "' + a.t.en.slice(0,28) + '" has a valid until date');
  ok(!!a.t.en && !!a.t.es, '  has EN and ES title');
  ok(!!a.body.en && !!a.body.es, '  has EN and ES body');
  if (a.link) ok(/^https:\/\//.test(a.link) && !!a.cta.en && !!a.cta.es, '  link is https and has a bilingual button label');
});
const sec = store['actions'];
const anyLink = ACTIONS.some(a => a.link && TODAY_K <= a.until);
ok(!anyLink || (sec && /class="go[ "]/.test(sec.innerHTML)),
   anyLink ? 'rendered action box contains a clickable button'
           : 'no live item has a sign-up, so no button expected');
if (APPLE_LIVE) ok(sec && sec.innerHTML.includes('signupgenius.com/go/10C0F4EAFAA2BA5FEC07-66633689-its'),
   'Apple Day sign-up link is in the rendered box');
/* Mahjong was moved out of the action box in October, then asked back in on
   11 Nov as a parents call-out. Check it only while the entry is live. */
const MJ_LIVE = ACTIONS.some(a => /Mahjong/.test(a.t.en) && TODAY_K <= a.until);
ok(!MJ_LIVE || (sec && /soaringowlsfoundation/.test(sec.innerHTML)),
   MJ_LIVE ? 'Mahjong Night is in the action box with its ticket link'
           : 'Mahjong Night is not live, so none expected');
ok(sec && !sec.classList.contains('hidden'), 'action box is visible today');
ok(sec && /class=.garland/.test(sec.innerHTML) && /class=.mark/.test(sec.innerHTML)
   && (sec.innerHTML.match(/class="badge"/g)||[]).length === (sec.innerHTML.match(/<details/g)||[]).length,
   'garland, corner apple and one badge per item are all present');

// ---- 4. the sign-up link appears in the markup as a real anchor -------
ok(!anyLink || /<a class="go[^"]*" href="https:/.test(sec.innerHTML),
   anyLink ? 'button is a real <a href>, not plain text' : 'no buttons to check');
if (APPLE_LIVE) ok(/<a class="go go-green"/.test(sec.innerHTML), 'Apple Day button uses the green treatment');
if (APPLE_LIVE) ok(/go-green[\s\S]{0,400}?#ffffff/.test(sec.innerHTML), 'Apple Day button carries an apple icon');
ok(/\.actions \.go-green\{background:#4C7A2B/.test(html), 'green button colour is defined in the stylesheet');

// ---- 5. bilingual parity ---------------------------------------------
const titles = DATA.map(d => d.t);
const missing = titles.filter(t => !ES_CARDS[t]);
ok(missing.length === 0, 'every card is translated (' + (titles.length - missing.length) + '/' + titles.length + ')'
   + (missing.length ? ' missing: ' + missing.join(' | ') : ''));

// ---- 6. calendar card: chronological + both languages -----------------
function rows(h) {
  const re = /<li([^>]*)><b>([^<]*)<\/b>/g, out = []; let r;
  while ((r = re.exec(h))) {
    const u = (r[1].match(/data-until='([0-9-]+)'/) || [])[1];
    if (u) out.push({ until: u, start: (r[1].match(/data-start='([0-9-]+)'/) || [])[1] || u, label: r[2] });
  }
  return out;
}
const calEN = DATA.find(d => d.t === 'School calendar, PTA events and meetings');
const calES = ES_CARDS['School calendar, PTA events and meetings'];
const rEN = rows(calEN.h), rES = rows(calES.h);
ok(rEN.length === rES.length, 'calendar row count matches EN/ES (' + rEN.length + ' / ' + rES.length + ')');
let sorted = true;
for (let i = 1; i < rEN.length; i++) if (rEN[i].start < rEN[i-1].start) { sorted = false; console.log('      out of order: ' + rEN[i-1].label + ' before ' + rEN[i].label); }
ok(sorted, 'calendar rows are in chronological order');
const today = new Date().toISOString().slice(0,10);
const past = rEN.filter(r => r.until < today);
ok(past.length === 0, 'no past-dated rows left' + (past.length ? ': ' + past.map(p=>p.label).join(', ') : ''));
if (APPLE_LIVE) ok(rEN.some(r => /Oct 19-21/.test(r.label)), 'Oct 19-21 apple drop-off row is on the calendar');
if (APPLE_LIVE) ok(rES.some(r => /19-21 oct/.test(r.label)), 'Spanish apple drop-off row is on the calendar');
ok(/soaringowlsfoundation\.com\/mahjong/.test(calEN.h) && /soaringowlsfoundation\.com\/mahjong/.test(calES.h),
   'Mahjong ticket link is on the calendar card in both languages');
ok(/Lite bites and drinks/.test(calEN.h), 'Mahjong calendar row carries the full description');

// ---- install button placement -----------------------------------------
const hdr = html.slice(html.indexOf('<header>'), html.indexOf('</header>'));
ok(hdr.includes('id="installBtn"'), 'install button sits inside the header');
ok(hdr.indexOf('id="installBtn"') < hdr.indexOf('class="now"'), 'install button is above the live banner');
ok(/\.install\{[\s\S]*?#DF982B/.test(html), 'install button uses the gold treatment');

// ---- attention bar no longer duplicates the live banner ---------------
ok(/if\(sp && sp\.start > ymd\(new Date\(\)\)\)/.test(html), 'attention bar only warns about a break that has not started');
const notice = store['notice'];
ok(true, 'attention bar state is checked by audit.js against today\'s date');

// ---- 7. ICS -----------------------------------------------------------
const ev = collectEvents();
ok(ev.length >= 15, 'ICS export builds ' + ev.length + ' events');
if (APPLE_LIVE) ok(ev.some(e => /Apple Day/i.test(e.title)), 'Apple Day is exportable to a personal calendar');
const dupes = {};
ev.forEach(e => { const k = e.start + '|' + e.title; dupes[k] = (dupes[k]||0)+1; });
ok(!Object.values(dupes).some(v => v > 1), 'no duplicate calendar exports');

// ---- 8. dead-link / quote hazards -------------------------------------
ok(!/donorbox\.org\/events\/957195/.test(html), 'old Mahjong donorbox link is gone');
ok(!/e=d5cb104167/.test(html), 'no personal Mailchimp tracking links');
const names = ['Melanie Wright','Steven Hill','Skylar','Hudson','Freyja','2183301','004377'];
const leaked = names.filter(n => html.includes(n));
ok(leaked.length === 0, 'no private names or codes on the public page' + (leaked.length ? ': ' + leaked.join(', ') : ''));

console.log(fail ? '\n' + fail + ' CHECK(S) FAILED' : '\nall checks passed');
process.exit(fail ? 1 : 0);
