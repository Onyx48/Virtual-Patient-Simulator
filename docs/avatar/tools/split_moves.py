import csv, os
from collections import defaultdict

BASE = "D:/vps/Virtual-Patient-Simulator/docs/avatar"
ORDER = ["rest", "shoulder", "neck", "lower_back", "hip", "knee", "ankle", "foot",
         "elbow", "forearm", "wrist", "thumb", "fingers", "test"]

rows = list(csv.DictReader(open(f"{BASE}/avatar_movements.csv", encoding="utf-8-sig")))
groups = defaultdict(list)
for r in rows:
    groups[(r["region"], r["side"] or "both")].append(r)

index = []
for n, region in enumerate(ORDER, 1):
    for side in ["both", "left", "right"]:
        items = groups.get((region, side))
        if not items:
            continue
        folder = f"{n:02d}_{region}" + ("" if side == "both" else f"/{side}")
        path = f"{BASE}/{folder}"
        os.makedirs(path, exist_ok=True)
        title = region.replace("_", " ").title() + ("" if side == "both" else f" - {side}")
        lines = [f"# {title}", "",
                 f"{len(items)} clips. Save each video in this folder, named exactly as the heading (e.g. `{items[0]['label']}.mp4`).",
                 "Use the reference image as both the first and the last frame. 25 fps.", ""]
        for r in items:
            lines += [f"## {r['label']}", f"{r['name']} - {r['version']}", "", "```", r["prompt"], "```", ""]
        open(f"{path}/prompts.md", "w", encoding="utf-8").write("\n".join(lines))
        with open(f"{path}/prompts.csv", "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=list(items[0].keys()))
            w.writeheader()
            w.writerows(items)
        index.append((folder, len(items)))

for folder, count in index:
    print(f"{folder:28s} {count}")
print("total", sum(c for _, c in index))
