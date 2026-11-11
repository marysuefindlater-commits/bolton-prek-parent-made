# -*- coding: utf-8 -*-
"""Remove everything dated before today. Safe to re-run; run it after any update.

Nothing is written unless the result still parses as JavaScript.

Usage: python3 -I prune_past.py [YYYY-MM-DD]
"""
import io, re, sys, datetime, subprocess

import os
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "index.html")
TODAY = sys.argv[1] if len(sys.argv) > 1 else datetime.date.today().isoformat()
original = io.open(P, encoding="utf-8").read()
s = original

# ---- dated rows in any card ------------------------------------------------
# attributes can come in any order, so do not assume data-until is first
gone = []
def row_is_past(m):
    if m.group(1) < TODAY:
        gone.append(m.group(1) + "  " + re.sub("<[^>]+>", " ", m.group(0)).strip()[:52])
        return ""
    return m.group(0)
s = re.sub(r"<li[^>]*data-until='(\d{4}-\d\d-\d\d)'[^>]*>.*?</li>", row_is_past, s)
print("  rows removed: %d" % len(gone))
for g in gone: print("     " + g)

# ---- entries in the calendar data -----------------------------------------
def block(name):
    """Return (start, end) of the object literal after `const NAME = `, by
    counting braces, so a nested {en:..,es:..} value cannot run us off the end."""
    i = s.find("const " + name + " = {")
    if i < 0: return None
    o = s.index("{", i)
    depth = 0
    for k in range(o, len(s)):
        if s[k] == "{": depth += 1
        elif s[k] == "}":
            depth -= 1
            if depth == 0: return (o, k)
    return None

def prune_map(name):
    global s
    span = block(name)
    if not span:
        print("  %s: not found" % name); return
    o, c = span
    inner = s[o + 1:c]
    lines = [l for l in inner.split("\n") if l.strip()]
    if not lines:
        print("  %s: already empty" % name); return
    keep, dropped = [], 0
    for l in lines:
        d = re.findall(r"\d{4}-\d{2}-\d{2}", l)
        end = d[-1] if d else None          # a range is judged by its last date
        if end and end < TODAY:
            dropped += 1; continue
        keep.append(l.rstrip().rstrip(","))
    body = ("\n" + ",\n".join(keep) + "\n") if keep else "\n"
    s = s[:o + 1] + body + s[c:]
    print("  %s: %d removed, %d kept" % (name, dropped, len(keep)))

for n in ["CAL_CLOSED", "CAL_EARLY", "CAL_TRIPS", "CAL_DRESS"]:
    prune_map(n)

# ---- only write if the result still parses ---------------------------------
# the page has a small version-check script in the head as well as the main
# one, so pick the block that actually holds the data
blocks = re.findall(r"<script>([\s\S]*?)</script>", s)
js = next(b for b in blocks if "const DATA" in b)
r = subprocess.run(["node", "-e",
                    "let src='';process.stdin.on('data',d=>src+=d).on('end',()=>{"
                    "try{new Function(src);console.log('  script parses')}"
                    "catch(e){console.error('  PARSE ERROR: '+e.message);process.exit(1)}});"],
                   input=js, text=True)
if r.returncode != 0:
    print("  NOTHING WRITTEN, the file is unchanged")
    sys.exit(1)

io.open(P, "w", encoding="utf-8").write(s)
print("  %d -> %d bytes" % (len(original), len(s)))
