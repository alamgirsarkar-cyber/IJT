# Agent entry point

Read `.agent/rules/agent-role.md` and `.agent/rules/governance.md` in full before doing
anything else. Gate 1 / Gate 2 reviewer self-identification and Review Dashboard automation
live only in `governance.md` — do not copy those rules here.

## Cursor Cloud specific instructions

Node.js 22 is already on the image and is the version these packages run on (`node:sqlite`). Put it on the default `PATH` before install; a non-interactive shell may not see `nvm`.

```bash
npm ci --prefix employee-services
npm ci --prefix employee-portal-web
```

`npm test` in each package is the check. There is no separate lint or typecheck script.

The API listens on port 3001 only when `LOCAL_DEV_IDENTITY=1` (local demo) or `GATEWAY_HMAC_SECRET` is set. The portal is `npm start` in `employee-portal-web` (Vite on port 5173) and calls `http://localhost:3001`. Sign-in buttons are Employee (`emp-1`), Line manager (`mgr-line`), Receiving manager (`mgr-recv`), and HR (`hr-1`). Startup creates `employee-services/data/portal.sqlite`.
