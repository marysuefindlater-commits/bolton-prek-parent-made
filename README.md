# Bolton Academy Pre-K parent hub

The public page lives at
<https://marysuefindlater-commits.github.io/bolton-prek-parent-made/> and is
served by GitHub Pages straight from `index.html` in this repository.

Maintained by Mary Sue. Room parents share it with every Pre-K family, so
treat accuracy as the first requirement and prettiness as the second.

## What this repo holds

| File | What it is |
|---|---|
| `index.html` | The whole site. One self-contained file: markup, styles, script, data, images. No build step, no dependencies. |
| `tools/verify.js` | Fast checks. Parses the script, runs it against a stub DOM, compares English against Spanish, looks for private names and codes. A second or two. |
| `tools/audit.js` | Full checks in a real browser: every link, the calendar export, search, both languages, and the page simulated on ten different dates. About a minute. |
| `tools/prune_past.py` | Deletes anything dated before today. Safe to re-run. Refuses to write if the result would not parse. |

## The rule that matters

**Never publish without running both checks.**

```sh
node tools/verify.js      # must end: all checks passed
node tools/audit.js       # must end: everything checks out
```

A single stray double quote inside a card body blanks the entire page for
every family. That has happened. `verify.js` exists to catch it.

## Updating

```sh
python3 -I tools/prune_past.py     # drop anything already past
# ...make the edits...
node tools/verify.js && node tools/audit.js
git commit -am "what changed" && git push
```

GitHub Pages redeploys on its own, usually within a minute or two.

## How the page is built

Cards are entries in a `DATA` array, each with a question (`t`), search
keywords (`k`), and an answer (`h`). Spanish lives in `ES_CARDS`, keyed by the
English question; a card with no Spanish entry falls back to English.

**Inside `h:"..."` use single quotes only.** A double quote ends the string
early and the page renders blank.

Dates drive themselves. A row written as
`<li data-until='2026-11-12'>` disappears on its own the day after. The
`CAL_CLOSED`, `CAL_EARLY`, `CAL_TRIPS` and `CAL_DRESS` objects each feed the
banner, the alerts, the calendar card and the calendar export from one place,
so a date is edited once and changes everywhere. `ACTIONS` is the call-out at
the top; entries expire on their `until` date and sort soonest first.

Seasonal decoration is two dates near the top of the script and turns itself
off.

## Where the facts come from

In order of authority:

1. The school's own documents: the Weekly Hoot, flyers, the posted calendar,
   School Cash Online and MySchoolBucks receipts.
2. The room parents' emails and the teacher's ClassDojo posts.
3. Anything else needs a source before it goes on the page.

If a claim cannot be traced to one of those, it does not belong here. Several
errors have been caught by asking "where did this come from?" and failing to
answer.

## What never goes on this page

It is public and will be scraped.

- Children's names, including the maintainer's own
- Parents' personal phone numbers, home addresses, payment handles
- Student numbers, aftercare security codes, any shared password
- Mailchimp links carrying an `e=` parameter, which identify one recipient
- Microsoft "safelinks" URLs, which carry the sender's address

School staff names and their `@apsk12.org` addresses are fine and expected.
