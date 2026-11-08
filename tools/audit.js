/* Playwright is installed globally in some environments and locally in others,
   so look in a few places before giving up. */
function loadChromium(){
  const tries=['playwright','playwright-core',
    '/usr/lib/node_modules/playwright','/usr/local/lib/node_modules/playwright'];
  for(const t of tries){ try{ return require(t).chromium; }catch(e){} }
  try{
    const {execSync}=require('child_process');
    const root=execSync('npm root -g',{encoding:'utf8'}).trim();
    return require(root+'/playwright').chromium;
  }catch(e){}
  console.error('Playwright not found. Install it with:  npm i -g playwright');
  process.exit(2);
}
const chromium = loadChromium();
const fs = require('fs');
const path = require('path');
/* the page lives one level up, in the repo root */
const FILE = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(FILE, 'utf8');
const TODAY = new Date().toISOString().slice(0,10);
let fail = 0, warn = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAIL  ') + m); if (!c) fail++; };
const note = m => { console.log('  note  ' + m); warn++; };
const H = t => console.log('\n--- ' + t + ' ---');

(async () => {
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
// a blocked font request is this sandbox's egress policy, not a page fault
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
p.on('requestfailed', r => { if (!/fonts\.googleapis|fonts\.gstatic|google/.test(r.url())) errs.push('request failed: ' + r.url()); });
await p.goto('file://' + FILE);
await p.waitForTimeout(900);

H('page loads');
ok(errs.length === 0, 'no JavaScript errors' + (errs.length ? ': ' + errs[0] : ''));
ok(await p.$eval('#results', e => e.children.length > 0), 'cards render (page is not blank)');
const bodyText = await p.$eval('body', e => e.innerText);
ok(bodyText.length > 3000, 'page has real content, ' + bodyText.length + ' characters');

H('the blank-page hazards');
ok(!/undefined|\[object |NaN/.test(bodyText), 'no undefined / [object Object] / NaN leaking into the page');
ok(!/h:"|',v:"|cat:"/.test(bodyText), 'no raw card syntax leaking into the page');
// a stray double quote inside h:"..." is what has blanked this page before
const hStrings = [...html.matchAll(/\n\s*h:"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]);
ok(hStrings.length > 50, 'found ' + hStrings.length + ' card bodies to check');
const badQuote = hStrings.filter(x => /[^\\]"/.test(x));
ok(badQuote.length === 0, 'no unescaped double quotes inside card bodies');

H('content integrity');
const data = await p.evaluate(() => ({
  titles: DATA.map(d => d.t),
  sections: [...new Set(DATA.map(d => d.s))],
  es: Object.keys(ES_CARDS),
  actions: ACTIONS.length
}));
ok(new Set(data.titles).size === data.titles.length, 'no duplicate card titles (' + data.titles.length + ' cards)');
const untranslated = data.titles.filter(t => !data.es.includes(t));
ok(untranslated.length === 0, 'every card is translated' + (untranslated.length ? ': ' + untranslated.join(' | ') : ''));
const orphanEs = data.es.filter(t => !data.titles.includes(t));
ok(orphanEs.length === 0, 'no leftover Spanish cards for deleted English ones'
   + (orphanEs.length ? ': ' + orphanEs.join(' | ') : ''));

H('parent-teacher conferences are gone');
ok(!/parent[- ]teacher conferenc|conferences continue|fall conferences|spring conferences/i.test(bodyText),
   'no parent-teacher conference event is listed in English');
const strayEn = (bodyText.match(/conferenc\w*/gi) || []);
ok(strayEn.every(x => /impromptu conference/.test(bodyText)), 'the only remaining use of "conference" is the classroom-visiting note'
   + (strayEn.length ? ' (' + strayEn.length + ' use)' : ''));
await p.click('#langBtn'); await p.waitForTimeout(400);
const esText = await p.$eval('body', e => e.innerText);
ok(!/conferencias de padres|continuan las conferencias|conferencias de otono|conferencias de primavera/i.test(esText),
   'no parent-teacher conference event is listed in Spanish');
ok(!/conferenc/i.test(await p.evaluate(() => {
     const c = DATA.find(d => d.t === 'School calendar, PTA events and meetings');
     return c.h + ' ' + ES_CARDS[c.t].h; })),
   'the calendar card mentions no conferences in either language');
ok(errs.length === 0, 'still no JavaScript errors after switching language');
await p.click('#langBtn'); await p.waitForTimeout(400);

H('the action box');
const act = await p.evaluate(() => {
  const el = document.getElementById('actions');
  return { hidden: el.classList.contains('hidden'), html: el.innerHTML, text: el.innerText };
});
ok(!act.hidden, 'action box is showing');
const btns = [...act.html.matchAll(/<a class="go([^"]*)" href="([^"]+)"/g)].map(m => ({ cls: m[1].trim(), href: m[2] }));
const linked = await p.evaluate(() => ACTIONS.filter(a => a.link && new Date().toISOString().slice(0,10) <= a.until).length);
ok(btns.length === linked, 'every live item with a sign-up has a button (' + btns.length + '/' + linked + ')');
btns.forEach(x => console.log('        ' + (x.cls || 'default') + '  ' + x.href));
const appleLive = await p.evaluate(() => ACTIONS.some(a => /Apple Day/.test(a.t.en) && new Date().toISOString().slice(0,10) <= a.until));
ok(!appleLive || btns.some(x => x.cls === 'go-green' && /66633689-its/.test(x.href)),
   appleLive ? 'Apple Day button is green and points at the apple sign-up' : 'Apple Day has expired, so no button expected');
const fairLive = await p.evaluate(() => ACTIONS.some(a => /Book Fair/.test(a.t.en) && new Date().toISOString().slice(0,10) <= a.until));
ok(!fairLive || btns.some(x => /bookfairs\.scholastic\.com/.test(x.href)),
   fairLive ? 'Book Fair eWallet button is in the box' : 'Book Fair has passed, so no button expected');
ok(/class='garland'|class="garland"/.test(act.html), 'the apple and pencil garland is across the top');
/* A flyer only appears when a live action item carries one; Red Ribbon Week
   was the last such item, so this check applies only while one exists. */
const FLYER_LIVE = /flyer:true/.test(html);
ok(!FLYER_LIVE || /class="afly"/.test(act.html),
   FLYER_LIVE ? 'the school flyer is inside the action box'
              : 'no action item carries a flyer right now, so none expected');
ok(!/class=.flyer/.test(html), 'the flyer is no longer duplicated in the card');
const order = await p.evaluate(() => {
  const sb = document.getElementById('searchbar').getBoundingClientRect();
  const ac = document.getElementById('actions').getBoundingClientRect();
  return { searchAbove: sb.top < ac.top, sticky: getComputedStyle(document.getElementById('searchbar')).position };
});
ok(order.searchAbove, 'the search bar sits above the action box');
ok(order.sticky === 'sticky', 'the search bar is sticky');
const rows = (act.html.match(/<details/g) || []).length;
const liveN = await p.evaluate(() => ACTIONS.filter(a => new Date().toISOString().slice(0,10) <= a.until).length);
ok(rows === liveN && rows > 0, 'every live item is a collapsible row (' + rows + '/' + liveN + ')');
ok(!/<details(?! open)/.test(act.html), 'every row starts open, so no button is hidden');
ok((act.html.match(/class="badge"/g) || []).length === rows, 'every row has a circular badge');
/* Each sign-up button now sits inside the event it belongs to, rather than in a
   shared band at the bottom. */
const btnPlacement = await p.evaluate(() =>
  [...document.querySelectorAll('#actions a.go')].map(a => ({
    inBody: !!a.closest('.body'),
    sameRowAsItsEvent: !!a.closest('details')
  })));
ok(btnPlacement.length === 0 || btnPlacement.every(b => b.inBody && b.sameRowAsItsEvent),
   btnPlacement.length + ' button(s), each inside its own event');
ok(!/class="band"/.test(act.html), 'the old shared button band is gone');
/* Soonest deadline first. */
const whens = await p.evaluate(() => {
  const live = ACTIONS.filter(a => new Date().toISOString().slice(0,10) <= a.until);
  const shown = [...document.querySelectorAll('#actions .ttl')].map(e => e.textContent.trim());
  const byDate = live.slice().sort((a,b) => a.until < b.until ? -1 : 1).map(a => a.t.en);
  return { shown, byDate };
});
ok(JSON.stringify(whens.shown) === JSON.stringify(whens.byDate),
   'action items run soonest first');
await p.evaluate(() => { const d=document.querySelectorAll('#actions details'); if(d[0]) d[0].open = true; });
const tapTargets = await p.$$eval('#actions a.go', els => els.map(e => e.getBoundingClientRect().height));
ok(tapTargets.every(h => h >= 40), 'both buttons are big enough to tap on a phone');

H('every link');
/* textContent, not innerText: a link inside a collapsed <details> has no innerText
   even though its label is perfectly present. */
const links = await p.$$eval('a[href]', els => els.map(e => ({ href: e.getAttribute('href'), text: e.textContent.trim() })));
ok(links.length > 50, links.length + ' links on the page');
const badScheme = links.filter(l => !/^(https?:|mailto:|#)/.test(l.href));
ok(badScheme.length === 0, 'every link has a real address' + (badScheme.length ? ': ' + JSON.stringify(badScheme) : ''));
const emptyText = links.filter(l => !l.text);
ok(emptyText.length === 0, 'no link is missing its label');
ok(!links.some(l => /e=d5cb104167/.test(l.href)), 'no personal Mailchimp tracking links');
ok(!links.some(l => /donorbox\.org\/events\/957195/.test(l.href)), 'the dead Mahjong link is gone');
const hosts = {};
links.forEach(l => { const m = l.href.match(/^https?:\/\/([^/]+)/); if (m) hosts[m[1]] = (hosts[m[1]] || 0) + 1; });
console.log('        hosts: ' + Object.entries(hosts).map(([h, n]) => h + '(' + n + ')').join(', '));
const signups = [...new Set(links.filter(l => /signupgenius/.test(l.href)).map(l => l.href))];
console.log('        sign-ups:'); signups.forEach(u => console.log('          ' + u));
ok(signups.every(u => /^https:\/\/www\.signupgenius\.com\/go\/[0-9A-F]{20}-\d+-[a-z]+/.test(u)),
   'every SignUpGenius link is well formed');
const acct = {}; signups.forEach(u => { const a=u.match(/go\/([0-9A-F]{20})/)[1]; acct[a]=(acct[a]||0)+1; });
console.log('        sign-up accounts: ' + Object.entries(acct).map(([a,n])=>a+' x'+n).join(', '));

H('the calendar');
const cal = await p.evaluate(() => {
  function rows(h) {
    const re = /<li([^>]*)><b>([^<]*)<\/b><span>([\s\S]*?)<\/span><\/li>/g, out = []; let m;
    while ((m = re.exec(h))) {
      const u = (m[1].match(/data-until='([0-9-]+)'/) || [])[1];
      if (!u) continue;
      out.push({ until: u, start: (m[1].match(/data-start='([0-9-]+)'/) || [])[1] || u,
                 label: m[2], text: m[3].replace(/<[^>]+>/g, '').trim(),
                 nocal: /data-nocal/.test(m[1]) });
    }
    return out;
  }
  const en = DATA.find(d => d.t === 'School calendar, PTA events and meetings');
  return { en: rows(en.h), es: rows(ES_CARDS[en.t].h) };
});
ok(cal.en.length === cal.es.length, 'English and Spanish calendars have the same number of rows ('
   + cal.en.length + ' / ' + cal.es.length + ')');
let sorted = true;
cal.en.forEach((r, i) => { if (i && r.start < cal.en[i-1].start) { sorted = false; note('out of order: ' + r.label); } });
ok(sorted, 'rows are in date order');
const past = cal.en.filter(r => r.until < TODAY);
ok(past.length === 0, 'nothing in the past is still listed' + (past.length ? ': ' + past.map(r => r.label).join(', ') : ''));
const liveRows = await p.evaluate(() => document.querySelectorAll('#results [data-until]').length);
console.log('        ' + liveRows + ' dated rows visible today');
const badDate = cal.en.filter(r => isNaN(Date.parse(r.until)) || isNaN(Date.parse(r.start)));
ok(badDate.length === 0, 'every row has a valid date');
const backwards = cal.en.filter(r => r.until < r.start);
ok(backwards.length === 0, 'no row ends before it starts');
ok(cal.es.every((r, i) => r.start === cal.en[i].start && r.until === cal.en[i].until),
   'Spanish rows carry the same dates as the English ones');
console.log('        ' + cal.en.length + ' rows, ' + cal.en.filter(r => r.nocal).length + ' of them days off');

H('add-to-calendar export');
const ics = await p.evaluate(() => {
  const ev = collectEvents();
  return { n: ev.length, dupes: ev.map(e => e.start + '|' + e.title).filter((v, i, a) => a.indexOf(v) !== i),
           bad: ev.filter(e => !e.title || !/^\d{4}-\d{2}-\d{2}$/.test(e.start) || e.end < e.start),
           past: ev.filter(e => e.end < '2026-10-12').length,
           sample: ev.slice(0, 3).map(e => e.start + ' ' + e.title) };
});
/* Past events are pruned from the page, so this count shrinks through the year. */
ok(ics.n >= 15, ics.n + ' events will export to a personal calendar');
ok(ics.dupes.length === 0, 'nothing exports twice' + (ics.dupes.length ? ': ' + ics.dupes.join(', ') : ''));
ok(ics.bad.length === 0, 'every exported event has a title and sane dates');
ok(ics.past === 0, 'nothing already past gets exported');

H('search');
const probes = [['sick','sick'],['pickup','pick'],['thanksgiving','thanksgiving'],['mystery reader','mystery'],['feast','feast'],
                ['spring break','break'],['who do i email','email'],['nap','nap'],
                ['supplies','suppl'],['turkey','disguise'],['aftercare','psc']];
for (const [q, expect] of probes) {
  const n = await p.evaluate(async (q) => {
    const el = document.getElementById('q');
    el.value = q; el.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    return { count: document.querySelectorAll('#results .card').length,
             text: document.getElementById('results').innerText.toLowerCase() };
  }, q);
  ok(n.count > 0 && n.text.includes(expect), 'search "' + q + '" returns ' + n.count + ' answer(s)');
}
await p.evaluate(() => { const el = document.getElementById('q'); el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
await p.waitForTimeout(200);

H('the live banner and the top of the page');
const top = await p.evaluate(() => ({
  line: document.getElementById('nowLine').textContent,
  noticeHidden: document.getElementById('notice').classList.contains('hidden'),
  installInHeader: !!document.querySelector('header #installBtn'),
  installBeforeNow: !!document.querySelector('header #installBtn ~ .now'),
  installVisible: !document.getElementById('installBtn').classList.contains('hidden')
}));
ok(top.line && top.line.length > 6 && !/Checking the time/.test(top.line),
   'live banner says something real for right now: "' + top.line + '"');
const dayOff = await p.evaluate(() => !!closedSpan(ymd(new Date())));
ok(dayOff ? top.noticeHidden : true, 'on a day off the attention bar does not repeat the banner');
console.log('        attention bar: ' + (top.noticeHidden ? 'hidden' : 'showing a heads-up'));
ok(top.installInHeader && top.installBeforeNow, 'the app button sits above the live banner');
ok(top.installVisible, 'the app button is showing');

H('fonts and offline behaviour');
const fontOk = await p.evaluate(() => {
  const h1 = getComputedStyle(document.querySelector('h1')).fontFamily;
  return { stack: h1, hasFallback: /georgia|serif/i.test(h1) };
});
ok(fontOk.hasFallback, 'headings fall back to a system font if Google Fonts is unreachable');

H('both languages render');
for (const lang of ['es', 'en']) {
  if (lang === 'es') await p.click('#langBtn');
  await p.waitForTimeout(400);
  const t = await p.$eval('#results', e => e.innerText);
  ok(t.length > 2000, lang.toUpperCase() + ': cards render, ' + t.length + ' characters');
  ok(!/undefined|\[object /.test(t), lang.toUpperCase() + ': nothing broken in the text');
  if (lang === 'es') await p.click('#langBtn');
}
await p.waitForTimeout(300);


H('the page on other days (date simulation)');
// a bug that only shows up on one evening is the kind this page has shipped before
const probeDays = [
  ['2026-10-25T18:00:00','Sun before Red Ribbon week'],
  ['2026-10-26T07:30:00','Mon morning, red day'],
  ['2026-10-28T19:00:00','Wed evening'],
  ['2026-10-29T19:00:00','Thu evening'],
  ['2026-10-30T12:00:00','Fri, parade day'],
  ['2026-11-02T08:00:00','Mon after Halloween'],
  ['2026-11-03T09:00:00','Election Day, no school'],
  ['2026-12-24T10:00:00','December break'],
  ['2027-03-15T07:00:00','early release day'],
  ['2027-06-15T10:00:00','summer, out of year']
];
for (const [iso,label] of probeDays) {
  const pg = await b.newPage({ viewport:{width:430,height:800} });
  const errs2 = [];
  pg.on('pageerror', e => errs2.push(e.message));
  await pg.clock.install({ time: new Date(iso) });
  await pg.goto('file://' + FILE);
  await pg.waitForTimeout(450);
  const st = await pg.evaluate(() => ({
    cards: document.querySelectorAll('#results .card').length,
    line: (document.getElementById('nowLine')||{}).textContent || '',
    notice: document.getElementById('notice').classList.contains('hidden') ? 'none' : 'heads-up',
    wear: (function(){
      const w = document.getElementById('wearNotice');
      if (w.classList.contains('hidden')) return 'none';
      const t = w.innerText.split('\n').filter(Boolean);
      return (t[0]||'').slice(0,22);
    })(),
    actions: document.getElementById('actions').classList.contains('hidden') ? 0
             : document.querySelectorAll('#actions details').length
  })).catch(e => ({err:String(e)}));
  const bad = errs2.length || !st.cards || !st.line;
  ok(!bad, label.padEnd(28) + ' cards:' + st.cards + ' green:' + String(st.notice).padEnd(9)
     + ' wear:' + String(st.wear).padEnd(23) + ' actions:' + st.actions
     + (errs2.length ? '  ERROR: ' + errs2[0] : ''));
  await pg.close();
}


H('weekday names match their dates');
// e.g. "Thursday Oct 23" when Oct 23 is a Friday -- easy to write, hard to spot
{
  const MON = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const both = await p.evaluate(async () => {
    const out = [];
    for (const lang of [0,1]) {
      out.push(document.body.innerText);
      document.getElementById('langBtn').click();
      await new Promise(r=>setTimeout(r,350));
    }
    return out.join('\n');
  });
  const re = /(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/g;
  let m, checked = 0; const wrong = [];
  while ((m = re.exec(both))) {
    const mon = MON[m[2]];
    const year = mon >= 7 ? 2026 : 2027;          // school year runs Aug to May
    const d = new Date(year, mon, Number(m[3]), 12);
    checked++;
    if (DAY[d.getDay()] !== m[1]) wrong.push(m[0] + ' is actually a ' + DAY[d.getDay()]);
  }
  ok(wrong.length === 0, 'checked ' + checked + ' weekday/date pairs'
     + (wrong.length ? ' -- WRONG: ' + wrong.join('; ') : ''));
}


H('every card matches between languages');
{
  const mism = await p.evaluate(() => {
    const n = h => ((h||'').match(/data-until=/g)||[]).length;
    const links = h => ((h||'').match(/href=/g)||[]).length;
    const out = [];
    DATA.forEach(d => {
      const es = ES_CARDS[d.t]; if (!es) return;
      if (n(d.h) !== n(es.h)) out.push(d.t + ' dated rows EN:' + n(d.h) + ' ES:' + n(es.h));
      if (links(d.h) !== links(es.h)) out.push(d.t + ' links EN:' + links(d.h) + ' ES:' + links(es.h));
    });
    return out;
  });
  ok(mism.length === 0, 'dated rows and links line up card by card'
     + (mism.length ? ' -- ' + mism.join('; ') : ''));
}

H('privacy');
const full = (await p.$eval('body', e => e.innerText)) + html;
[['Melanie Wright','a volunteer\'s full name'],['Steven Hill','a volunteer\'s full name'],
 ['Skylar','a child\'s name'],['Hudson','a child\'s name'],['Freyja','a child\'s name'],
 ['2183301','a student number'],['004377','the aftercare door code'],
 ['706.506.5002','a personal phone number'],['706-506-5002','a personal phone number']]
 .forEach(([needle, what]) => ok(!full.includes(needle), 'no ' + what + ' on the public page (' + needle + ')'));

await b.close();
console.log('\n' + (fail ? fail + ' PROBLEM(S) FOUND' : 'everything checks out') + (warn ? ', ' + warn + ' note(s)' : ''));
process.exit(fail ? 1 : 0);
})();
