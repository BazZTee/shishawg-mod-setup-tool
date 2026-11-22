# Working preferences for this repository

- Always use the Graft skill and its CLI for repository orientation, code location, and call tracing. Keep its local graph current when code changes affect later queries.
- Use the Caveman skill for concise communication in this repository, unless the user asks for normal style or clarity requires more detail.

## Graft

Graft is installed globally on this computer as `graft` (`@nanonets/graft`). Check `Get-Command graft` if the command is not found. The executable is normally at `C:\Users\BazZTee\AppData\Roaming\npm\graft.cmd`.

Use `graft map` or `graft ask "<question>" --source` for orientation and code location. Use `graft skeleton <file>` to inspect a file's symbols and `graft callers <symbol>` for call paths. If the graph is absent or stale, run `graft build` before querying. Keep the generated `graft/` cache out of commits unless explicitly requested.
