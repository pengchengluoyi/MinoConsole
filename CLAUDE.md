# Four products

- **MinoConsole** — this repo. Pure web SPA for people, RBAC, SMTP, AI roles, packs.
- **MinoStudio** — testing workbench (Electron). Model keys, plugins, projects, runs.
- **MinoNexus** — API. Console talks only to Nexus.
- **MinoScout** — executor. Console may show a download link; it cannot install a desktop daemon.

Do not add Electron, adb, scrcpy, project CRUD, case run, or model-key write UI here.
Do not add MiniOrange / miniorange strings (`grep -i miniorange` must stay empty outside `node_modules`).
