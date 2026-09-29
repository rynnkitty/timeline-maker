---
name: project-privacy-boundaries
description: Where real-data-derived info may live in TimelineMaker — reference video header shows a real person's name; which real-file aggregates may be committed vs kept in gitignored docs/reference/
metadata:
  type: project
---

The reference video header (`ref/Output_semple.mp4`) shows a **real person's full name** in the title. Never transcribe it into docs, fixtures, tests, memory, commands or reports — always write `{이름}` (and don't type it into grep commands either; grep for the header pattern instead). Frames also show a real trajectory, so don't add city names beyond what agent doc §2.4 already lists.

Split decided in Phase 0 (2026-09-23):
- **Committable** (docs/reference-spec.md, ROADMAP): schema facts (keys, types, string formats) and **decision-relevant** counts/ratios/bucket distributions — file size, segment/point counts, parse time, overlap pair counts, speed buckets, km ratio vs the reference.
- **Gitignored only** (`docs/reference/survey-android.txt`, alongside the reference frames): monthly histograms, dates, per-enum counts that reveal habits (e.g. how many flights, home/work visit counts).

**Why:** public repo (D-08) + H-2; the detail describes one person's habits, the summary is needed to justify parser decisions.
**How to apply:** new real-file measurements → raw aggregate into `docs/reference/`, only the decision-relevant summary into committed docs. Survey scripts print classes/counts only, never values (→ reference-spec §6).
