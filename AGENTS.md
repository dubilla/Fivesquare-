<!-- BEGIN shared-doctrine: synced from ~/.dotfiles/agents/AGENTS.md — edit there, run agents-sync -->

# First Principle: Vertical Slices

Every change must deliver end-to-end user value. Never build a layer (schema, API, sync) without the corresponding UI that makes it visible and useful to the user.

- Bad: "Add subtasks table and sync logic" (user sees nothing)
- Good: "Add subtasks that sync from Asana and display as a checklist on the task detail page"

A feature is not done until the user can see it and interact with it. If a story doesn't change what the user experiences, it's not a story. When planning work, always ask: "What will the user see or do differently after this ships?" If you can't answer that, the scope is wrong.

# Dev Setup

## Dev logs

Projects should log dev server output to `logs/dev.log` so the agent can read them without running the server.

Setup (once per project):

```bash
mkdir -p logs && touch logs/dev.log
echo '/logs' >> .gitignore
```

Then update the dev script in `package.json`. The shape is `truncate logs/dev.log && <runner> 2>&1 | tee logs/dev.log` — wrap whatever the project's actual dev runner is, with or without a proxy/wrapper in front:

```json
// Plain Next.js
"dev": "truncate -s 0 logs/dev.log && next dev 2>&1 | tee logs/dev.log"

// Wrapped (e.g. portless, ngrok, cloudflared, doppler run, dotenv-cli, etc.)
"dev": "truncate -s 0 logs/dev.log && portless run next dev 2>&1 | tee logs/dev.log"
```

The `tee` must sit on the outermost command so all wrapper + child output is captured. If a project doesn't have this set up, remind the user.

<!-- END shared-doctrine -->
