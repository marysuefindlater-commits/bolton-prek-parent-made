# -*- coding: utf-8 -*-
"""Stamp index.html and version.txt with the same build time.

The page fetches version.txt on every visit and reloads itself if the two
disagree, which is how a saved bookmark or a home-screen icon gets past the
browser cache. They have to be stamped together or the page would reload
forever, so this is the only place that writes either of them.
"""
import io, os, re, sys, datetime

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
stamp = sys.argv[1] if len(sys.argv) > 1 else \
    datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")

page = os.path.join(root, "index.html")
s = io.open(page, encoding="utf-8").read()
s2 = re.sub(r'const BUILD = "[^"]*";', 'const BUILD = "%s";' % stamp, s, count=1)
assert s2 != s, "BUILD constant not found in index.html"
io.open(page, "w", encoding="utf-8").write(s2)
io.open(os.path.join(root, "version.txt"), "w", encoding="utf-8").write(stamp + "\n")
print("  stamped " + stamp)
