Optional exercise pictures for the F3 info sheet and the small thumbnail.
Format: WebP with transparent background (so they work in light and dark mode). Name them <exercise id>-1.webp and <exercise id>-2.webp (e.g. db_bench-1.webp). Ids are the keys in js/guides.js.
Missing pictures are skipped (the sheet shows "Image coming"); the first one is also the thumbnail (cropped to a square from the centre).
Pictures are precached by sw.js for offline use: when a new exercise id is added, add it to IDS in sw.js too.
Current set: 18 square crops (about 500 px) cut from three generated sheets on 2026-11-20, alpha kept. Missing: seated_row, calf_raise, pull_up, dips, ham_curl, plank.
