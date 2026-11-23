#!/usr/bin/env python3
"""Turn the PT chat's "Next-Session Targets" doc (markdown tables) into next.json for the GymLog data repo.

Usage: python3 -I tools/next_from_doc.py <next-session-targets.md> <gymlog.json from the data repo> <out next.json>
Each "## ..." section is one review; a date (YYYY-MM-DD) in its heading is the review date (setOn), else today.
Rows are matched to exercise ids by the exercise name in gymlog.json (case-insensitive, punctuation ignored).
The app shows a target until the exercise is logged after setOn."""
import json, re, sys, datetime
doc, data, out = sys.argv[1:4]
db = json.load(open(data))
norm = lambda s: re.sub(r"[^a-z0-9]+", "", s.lower())
# Second chance: ignore equipment prefixes the user puts on names (DB, BB, Cable, Mx, Rig)
bare = lambda s: norm(re.sub(r"^((db|bb|cable|mx|rig)[ /]+)+", "", s.strip(), flags=re.I))
by_name = {norm(e["name"]): i for i, e in db["exercises"].items()}
by_bare = {bare(e["name"]): i for i, e in db["exercises"].items()}
today = datetime.date.today().isoformat()
targets, unmatched, sec, day = {}, [], "", today
for line in open(doc, encoding="utf-8"):
    line = line.rstrip("\n")
    if line.startswith("## "):
        sec = line[3:].strip(); m = re.search(r"\d{4}-\d{2}-\d{2}", sec); day = m.group(0) if m else today
        continue
    cells = [c.strip() for c in line.strip().strip("|").split("|")] if line.strip().startswith("|") else None
    if not cells or len(cells) < 3 or cells[0] in ("Exercise", "") or set(cells[0]) <= set("- :"):
        continue
    ex = by_name.get(norm(cells[0])) or by_bare.get(bare(cells[0]))
    if not ex: unmatched.append(cells[0]); continue
    targets[ex] = {"target": cells[1], "note": cells[2], "setOn": day, "from": sec}
json.dump({"updated": datetime.datetime.now().isoformat(timespec="minutes"), "targets": targets}, open(out, "w"), ensure_ascii=False, indent=1)
print(f"{len(targets)} targets", "| unmatched:", unmatched or "none")
