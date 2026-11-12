# -*- coding: utf-8 -*-
"""Stamp every page and version.txt with the same build time.

Each page fetches version.txt on every visit and reloads itself if the two
disagree, which is how a saved bookmark or a home-screen icon gets past the
browser cache. They have to be stamped together or a page would reload
forever, so this is the only place that writes any of them.
"""
import io, os, re, sys, datetime

PAGES = ["index.html", "atlanta.html"]

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
stamp = sys.argv[1] if len(sys.argv) > 1 else \
    datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")

for name in PAGES:
    page = os.path.join(root, name)
    s = io.open(page, encoding="utf-8").read()
    s2 = re.sub(r'const BUILD = "[^"]*";', 'const BUILD = "%s";' % stamp, s, count=1)
    assert s2 != s, "BUILD constant not found in " + name
    io.open(page, "w", encoding="utf-8").write(s2)

io.open(os.path.join(root, "version.txt"), "w", encoding="utf-8").write(stamp + "\n")
print("  stamped " + stamp + " into " + ", ".join(PAGES))
