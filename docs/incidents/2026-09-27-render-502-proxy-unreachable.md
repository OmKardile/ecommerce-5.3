# Incident 2026-09-27 — HTTP 502 on Render: the proxy could not reach the running Next.js server

> *"Render's proxy could not successfully reach the running Next.js server."*
> — the text on the 502 page at `https://patelnetworks.onrender.com`, 2026-09-27

| | |
|---|---|
| **Date** | 2026-09-27 (documented 2026-09-28) |
| **Status** | ✅ Resolved — fix verified live, then back-ported into the repo (Task 29, decision D-14) |
| **Severity** | Sev-1 — complete outage of the public site (storefront + admin console) |
| **Service** | Render web service `patelnetworks` — Node runtime, free plan |
| **URL** | `https://patelnetworks.onrender.com` |
| **Data impact** | None. The database is external (Neon Postgres); during the outage no traffic reached the app, so nothing was written, lost, or corrupted. Fail-closed by design. |
| **Related** | Build-stage P1012 failure the day before was a **separate, independent** incident — see Task 28 / D-13 (`scripts/with-env.sh`). |

---

## TL;DR

The very first Render deploy with a green build served **HTTP 502 Bad Gateway** to every visitor, while the service's own logs showed a perfectly healthy boot:

```
✓ Starting…
✓ Ready in 802ms
==> Your service is live 🎉
```

The app was running; Render's edge proxy just couldn't reach it. Root cause: **Render injects `HOSTNAME` (the service's internal hostname) into the environment, and Next.js's standalone server binds to `process.env.HOSTNAME`** — an interface Render's proxy does not route to. The proxy's TCP connection failed and the edge answered 502.

The fix was one line in the Start Command — pin the bind address and port:

```bash
HOSTNAME=0.0.0.0 PORT=$PORT NODE_ENV=production bun .next/standalone/server.js
```

The same fix now lives in the repo (`npm run start`), so no future deploy can regress.

---

## Symptom vs. reality

| What we saw | What it meant |
|---|---|
| Browser: **502 Bad Gateway** on every URL | Render's edge/router could not fetch a response from the app instance |
| Render logs: `✓ Ready in 802ms` + "Your service is live 🎉" | The Node process started and bound **something** — but nothing in an app log validates that the *proxy* can reach the bound interface |
| Build logs: all green | Build was never the problem at this stage |
| Health check path `/api/health` configured | Irrelevant during a reachability outage — health checks travel through the same proxy path |

The misleading part is the 🎉 banner: **"service is live" means the process is running, not that it is reachable.** The fastest way to read this failure mode is the 502 text itself — it names the broken hop: proxy → app.

---

## Timeline

All steps below are the owner's actual sequence, reported in-chat:

1. **Deploy attempt 1 — build failure (separate incident).** Runtime switched Docker → Node; build command set to `npm install && npm run db:sync && npm run build`; Prisma flipped SQLite → PostgreSQL; Neon `DATABASE_URL` added to Render. Build still failed at `db:sync` with **P1012 "Environment variable not found: DATABASE_URL"** — fixed independently by commit `22d29c1` (env-precedence shim `scripts/with-env.sh`, Task 28).
2. **Build goes green.** With `DATABASE_URL` present on the service, the shim passes it through; `prisma db push` syncs all 38 tables on Neon; `next build` completes.
3. **First page load → HTTP 502.** Logs show `Ready in 802ms` and "Your service is live 🎉", yet `https://patelnetworks.onrender.com` returns Render's 502 page: *"Render's proxy could not successfully reach the running Next.js server."*
4. **Start Command changed** (dashboard → Settings): `HOSTNAME=0.0.0.0 PORT=$PORT NODE_ENV=production bun .next/standalone/server.js`.
5. **Redeploy → 502 gone.** Same `Ready` log, but this time the edge can actually connect. Site serves 200; `/api/health` → `{"ok":true,"data":{"status":"healthy","db":"up"}}`.
6. **Post-incident hardening (Task 29, commit `37fc08e`):** the verified binding was back-ported into the repo so a Blueprint re-apply or fresh deploy cannot reintroduce the 502.

---

## Root cause

### How Render serves traffic

Render terminates TLS at its edge for `*.onrender.com`, then forwards the request over Render's internal network to the web-service instance. The platform contract is:

- the app **must listen on `0.0.0.0:$PORT`** — Render injects `PORT` and routes to it;
- Render also injects `HOSTNAME` = the service's internal hostname (meant for inter-service addressing — *not* meant as a bind address).

### What Next.js standalone does

`.next/standalone/server.js` listens on `process.env.PORT` bound to `process.env.HOSTNAME`. When `HOSTNAME` is unset, it binds broadly (all/default interface). When it **is** set — as on Render — it binds **exactly that address**.

### The collision

On Render, `HOSTNAME` = the service hostname string → the standalone server bound a socket reachable only via that hostname's own resolution path — not the interface Render's proxy connects to. The proxy's TCP connect failed; the edge had no upstream to talk to; every request got **502 Bad Gateway**.

```
Browser ──▶ Render edge (TLS, *.onrender.com)
                 │  proxy → app instance on $PORT
                 │  app bound to <service-hostname> instead of 0.0.0.0
                 ✗  connection refused/unreachable
                 ▼
           502 Bad Gateway  ("Render's proxy could not successfully
                             reach the running Next.js server")
```

### Why it looked "fine" in the logs

`Ready in 802ms` proves the HTTP server started and bound *a* socket. Nothing in the app's own logs tests that the platform's proxy can reach the bound interface — that gap is exactly why this class of outage produces a green deploy and a dead site at the same time.

### Why the choice of `bun` was irrelevant

The verified dashboard command used `bun` to launch `server.js`, which tempted a "bun fixed it" conclusion. Bun was incidental — `bun` ships in Render's Node image and behaves identically here. The operative fix was `HOSTNAME=0.0.0.0 PORT=$PORT`. The repo's `npm run start` uses `node` for the same effect (node exists on every runtime, including the Docker/VPS path where bun is absent).

### Why this never appeared before Render

| Environment | Why no 502 |
|---|---|
| Sandbox dev (`next dev`) | No platform-injected `HOSTNAME`; dev server binds broadly |
| Docker / VPS (Task 3-b) | The Dockerfile runner has pinned `ENV HOSTNAME=0.0.0.0` since day one |
| Render Node runtime (new) | First environment running standalone `server.js` with a platform-injected `HOSTNAME` — the only place the trap exists |

---

## Resolution

**Dashboard Start Command (the fix that ended the outage):**

```bash
HOSTNAME=0.0.0.0 PORT=$PORT NODE_ENV=production bun .next/standalone/server.js
```

Token by token:

| Token | Why |
|---|---|
| `HOSTNAME=0.0.0.0` | Overrides Render's injected service hostname so the server binds **all interfaces** — the interface Render's proxy connects to included. This is the fix. |
| `PORT=$PORT` | Listen on the port Render actually assigns/proxies to (not a hardcoded guess). |
| `NODE_ENV=production` | Explicit production mode for the standalone server. |
| `bun` | Runtime detail only (ships in Render's Node image, verified live). `node` is equivalent; the repo script uses it. |

`0.0.0.0` inside Render's network is the documented requirement, not a security hole — Render's perimeter firewall guards the port externally.

---

## Prevention — what's in the repo now (Task 29, D-14)

1. **`package.json`** — `start` pins the binding:
   `HOSTNAME=0.0.0.0 PORT=${PORT:-3000} NODE_ENV=production node .next/standalone/server.js`
2. **`render.yaml`** — `startCommand: npm run start` (now equivalent to the dashboard's bun variant; the header comment documents the gotcha and the verified bun variant, and warns to keep the two in sync).
3. **`Dockerfile`** — runner has `ENV HOSTNAME=0.0.0.0` + `PORT=3000` (Task 3-b), so all three deployment paths agree.
4. **Decision D-14** in `decisions.md` records the choice and the rejected alternatives (dashboard-only fix, bun in the repo script, hardcoded PORT).
5. **`deploy/RENDER-STEPS.md`** — the troubleshooting map leads with the "build green but the site 502s" row.
6. **`healthCheckPath: /api/health`** in the Blueprint catches service-level boot failures (a different class than this one — see playbook).

---

## Recurrence playbook (if a 502 ever returns)

1. **Read the logs first.** `Ready` + 502 = reachability/binding problem (this incident). Crash-loop / no `Ready` = app boot problem (different incident).
2. Confirm the effective Start Command carries the binding — either the dashboard variant with `HOSTNAME=0.0.0.0 PORT=$PORT` or plain `npm run start` (which pins it in-repo).
3. Check the service's Environment tab for anything that overrides `HOSTNAME` — the injected value must lose to the start command's pin.
4. From the Render Shell, curl the app locally (`curl http://127.0.0.1:$PORT/api/health`) — if that works while the public URL 502s, the app is up and the proxy↔app hop is broken.
5. If a Blueprint re-apply ever resets the dashboard Start Command, that is now harmless — `npm run start` carries the same pin. Keep the dashboard override and the repo script in sync regardless (see `render.yaml` header).

---

## Lessons learned

- **Platform-injected env vars are contract surface.** Any PaaS variable (`HOSTNAME`, `PORT`, `REGION`, …) can silently change what a generic server binary does. Audit them before the first deploy on a new platform.
- **"Deploy succeeded" ≠ "service reachable".** A green build and a `Ready` log make no claim about the edge→app hop. The go-live smoke test must be a real request to the public URL (`/api/health`), not a log read.
- **Start commands are production code.** A fix applied only in a dashboard is invisible to the repo and regresses on re-apply. Ours now lives in `package.json`/`render.yaml`/`Dockerfile` with the rationale documented (D-14).
- **Separate failures are separate.** The P1012 build failure (Task 28) and this 502 (Task 29) had independent root causes and were debugged sequentially — one symptom per deploy, one fix per deploy, never assume a single cause explains everything.

---

## Verification record

- Post-fix (owner, live): site serves 200; Render logs `✓ Ready` + "Your service is live 🎉".
- Post-fix (Task 29 recon, from sandbox): `/api/health` → `{"ok":true,"data":{"status":"healthy","db":"up"}}`, homepage HTTP 200.
- Re-verified while documenting (2026-09-28 04:32 UTC): `/api/health` → 200 `{"db":"up"}`, homepage 200 in ~1.6 s.

## References

- Commits: `22d29c1` (Task 28 — env shim, build fix) · `37fc08e` (Task 29 — 502 back-port)
- Decisions: **D-14** (bind pin; rejected alternatives) · **D-13** (env precedence shim)
- Runbooks: [`deploy/RENDER-STEPS.md`](../../deploy/RENDER-STEPS.md) · [`docs/RENDER-DEPLOYMENT.md`](../RENDER-DEPLOYMENT.md)
- Blueprint: [`render.yaml`](../../render.yaml) (header comment = the short version of this document)
