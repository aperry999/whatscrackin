#!/usr/bin/env python3
"""Writes the website's event feed from the nightly What's Crackin' Events page.

Usage: python3 scripts/publish_feed.py <brewery-events.html> <data/events.json>

Reads the `const DATA = {...};` block the event engine builds into the page, keeps
upcoming events (yesterday through 30 days out, America/New_York) and only the fields
the site uses, and writes them sorted so day-to-day diffs stay small.
Exits non-zero, leaving the old feed untouched, if the page has no usable data.
"""
import json
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

FIELDS = ("city", "venue", "date", "time", "title", "cat", "link", "weekly", "featured")


def main(src: str, dest: str) -> None:
    html = open(src, encoding="utf-8").read()
    start = html.find("const DATA = ")
    if start < 0:
        sys.exit("No DATA block found in the events page.")
    decoder = json.JSONDecoder()
    data, _ = decoder.raw_decode(html, start + len("const DATA = "))
    events = data.get("events") or []
    if not events:
        sys.exit("The events page has no events; keeping the old feed.")

    today = datetime.now(ZoneInfo("America/New_York")).date()
    lo, hi = (today - timedelta(days=1)).isoformat(), (today + timedelta(days=30)).isoformat()
    out = []
    for e in events:
        d = str(e.get("date", ""))
        if not (lo <= d <= hi):
            continue
        row = {k: e[k] for k in FIELDS if k in e and e[k] not in ("", None, False)}
        if row.get("city") and row.get("venue") and row.get("title"):
            out.append(row)
    out.sort(key=lambda r: (r["city"], r["date"], r.get("time", "99"), r["venue"], r["title"]))

    with open(dest, "w", encoding="utf-8") as f:
        json.dump({"generated": data.get("generated"), "events": out}, f, ensure_ascii=False, indent=0, sort_keys=True)
        f.write("\n")
    print(f"feed: {len(out)} events written to {dest}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
