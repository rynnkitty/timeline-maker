---
name: project-windows-background-servers
description: On this Windows + Git Bash setup, stopping a background `npx vite` task only kills the bash wrapper — the node vite child keeps the port; check listeners and kill by PID
metadata:
  type: project
---

Stopping a background Bash task that ran `npx vite …` (dev or preview) leaves the `node …vite.js` child alive and still bound to its port. Found 2026-09-23: Phase 1's 5173/4173 servers were still running in Phase 2, causing "Port 5173 is already in use" and a stale server that answered `.ts` module requests with index.html (runner timed out waiting for the page).

**Why:** Windows process-tree semantics under Git Bash — TaskStop terminates the shell, not its node grandchild.
**How to apply:** after finishing browser checks, list listeners with PowerShell `Get-NetTCPConnection -State Listen | ? LocalPort -in 5173,5174,4173,4174` → `Get-CimInstance Win32_Process -Filter "ProcessId=N"` to confirm it is this project's vite command line → `Stop-Process -Id N -Force`. Only kill processes whose command line matches something this session started. When a port is taken by an unknown process, start your own server on another port and pass `--base=` to the spike runners instead of killing it.
