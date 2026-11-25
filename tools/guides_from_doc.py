#!/usr/bin/env python3
"""Parse a PT how-to doc (### Name / **Cue:** / **Rest:** / numbered steps / **Common mistakes:** / other **Label:** paragraphs -> extra) and merge into js/guides.js.
Usage: python3 -I tools/guides_from_doc.py <doc.md> name=id [name=id ...]   (prints rest texts as JSON)"""
import json, re, sys
doc, pairs = sys.argv[1], dict(a.split("=", 1) for a in sys.argv[2:])
out, rest, cur = {}, {}, None
for line in open(doc, encoding="utf-8"):
    line = line.strip()
    if line.startswith("### "):
        cur = pairs.get(line[4:].strip()); 
        if cur: out[cur] = {"cue": "", "steps": [], "mistakes": ""}
        continue
    if not cur: continue
    if line.startswith("**Cue:**"): out[cur]["cue"] = line[8:].strip()
    elif line.startswith("**Rest:**"): rest[cur] = line[9:].strip().rstrip(".")
    elif line.startswith("**Common mistakes:**"): out[cur]["mistakes"] = line[20:].strip().rstrip(".")
    elif re.match(r"^\*\*[^*]+:\*\*", line):  # extra labelled paragraph, e.g. **Which band:** ...
        m = re.match(r"^\*\*([^*]+):\*\*\s*(.*)$", line); out[cur].setdefault("extra", []).append([m.group(1).strip(), m.group(2).strip()])
    elif re.match(r"^\d+\. ", line): out[cur]["steps"].append(re.sub(r"^\d+\. ", "", line))
missing = [n for n, i in pairs.items() if i not in out]
g = open("js/guides.js", encoding="utf-8").read()
head, body = g[:g.index("{")], g[g.index("{"):g.rindex("}") + 1]
data = json.loads(body); data.update(out)
open("js/guides.js", "w", encoding="utf-8").write(head + json.dumps(data, indent=1, ensure_ascii=False) + ";\n")
print(json.dumps(rest, ensure_ascii=False)); print("missing:", missing or "none", file=sys.stderr)
