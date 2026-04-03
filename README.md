# 🖥️ Pixel Office — OpenClaw AI Agent Dashboard

[![OpenClaw Skill](https://img.shields.io/badge/OpenClaw-Skill-blueviolet?style=flat-square)](https://github.com/SC32br/openclaw-skill-pixel-office)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Pixi.js](https://img.shields.io/badge/Pixi.js-v8-e91e63?style=flat-square)](https://pixijs.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**Live pixel-art office dashboard for your OpenClaw AI agents.**  
Each agent appears as an animated pixel character — walking, stretching, meeting, going to the water cooler — with real-time status and an activity feed.

```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 Pixel Office                                    [LIVE] ●    │
├──────────────────────────────────────┬──────────────────────────┤
│                                      │  👥 Agents               │
│   ┌───┐  ┌───┐  ┌───┐  ┌───┐        │  🤖 Main      ● Working  │
│   │ 💻│  │ 💻│  │ 💻│  │ 💻│        │  📊 Marketer  ● Thinking │
│   └───┘  └───┘  └───┘  └───┘        │  ✍️  Writer    ○ Idle     │
│    [A]    [B]    [C]    [D]          │  📢 Publisher ● Working  │
│                                      │                          │
│   ┌───┐  ┌───┐  ┌───┐  ┌───┐        │  🔴 Live Feed            │
│   │ 💻│  │ 💻│  │ 💻│  │ 💻│        │  14:32 🤖 Processing...  │
│   └───┘  └───┘  └───┘  └───┘        │  14:31 📊 Strategy done  │
│    [E]    [F]    [G]    [H]          │  14:30 ✍️  Post written   │
│                                      │                          │
│         ┌──────────────────┐         │                          │
│         │  🤝 MEETING ROOM  │         │                          │
│         └──────────────────┘         │                          │
│  [LIVE ●]           [🤝 Gather All]  │                          │
└──────────────────────────────────────┴──────────────────────────┘
```

---

## Requirements

- **Node.js 20+** — required for `better-sqlite3`, `@tailwindcss/oxide`, and Next.js 16
  ```bash
  node --version  # must be v20.x or v22.x
  # nvm users: nvm install 22 && nvm use 22
  ```
- nginx (for reverse proxy)
- OpenClaw Gateway running locally

## Quick Start

```bash
# 1. Clone
git clone https://github.com/SC32br/openclaw-skill-pixel-office pixel-office
cd pixel-office

# 2. Install deps (Node 20+ required)
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local — set OPENCLAW_TOKEN and OPENCLAW_GATEWAY_URL

# 4. Create database tables (run once)
npm run db:push

# 5. Build and start
npm run build
npm start
```

## Data Model — Agents vs Bots vs Sessions

Understanding what shows on the map:

```
OpenClaw Workspace
│
├── Sessions (source of truth for the map)
│   └── Fetched via POST /tools/invoke → sessions_list
│   └── Each session with key "agent:main:<label>" = one agent on the map
│
├── Bots (channels — Telegram, MAX, Discord, etc.)
│   └── A bot ≠ an agent. One bot can serve many agents.
│   └── An agent can have zero bots (runs headlessly).
│
└── Workspace folders (your project structure)
    └── Not read directly — only active Gateway sessions appear on map.
```

**Rule:** The number of agents on the map = number of active OpenClaw sessions, not bots or workspace folders.

To populate the map:
1. Set `OPENCLAW_TOKEN` in `.env.local`
2. Start your OpenClaw agents (they register as sessions)
3. Refresh the dashboard

## ⚡ One-Command Install

Just tell your OpenClaw agent:

> **"install pixel office"** or **"установи пиксельный офис"**

The agent will:
1. Clone this repo to `~/agents-workspace/pixel-office`
2. Build the Next.js app
3. Generate a random 8-char password
4. Create a systemd service on port 3001
5. Configure nginx with proper locations
6. Set up HTTP Basic Auth
7. Give you the URL + credentials

Full install instructions are in [SKILL.md](SKILL.md).

---

## 🏗️ Architecture

```
Browser
  └── nginx (your domain)
        ├── /office/*    → proxy :3001  (auth required)
        ├── /_next/*     → proxy :3001  (auth required — serves JS bundles)
        └── /api/*       → proxy :3001  (NO auth — XHR must work)
                                │
                          Next.js :3001
                          ├── /office/stream  → PixelOffice canvas (Pixi.js v8)
                          ├── /api/agents     → SQLite via drizzle-orm
                          ├── /api/activity/feed
                          └── /api/openclaw/stats → OpenClaw Gateway
                                                     (optional, for token stats)
```

**Stack:**
| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19, Pixi.js v8, Zustand |
| Styling | Tailwind CSS v4 |
| Database | SQLite (better-sqlite3 + drizzle-orm) |
| Auth | nginx HTTP Basic Auth |
| Process | systemd |
| Runtime | Node.js 18+ |

---

## ⚙️ Configuration

Edit `~/agents-workspace/pixel-office/.env.local`:

```env
NODE_ENV=production
PORT=3001

# OpenClaw Gateway — for real token/cost stats (optional)
OPENCLAW_GATEWAY_URL=http://localhost:18789
OPENCLAW_TOKEN=your_openclaw_token

# SQLite database
DATABASE_URL=/home/openclaw/agents-workspace/pixel-office/data/office.db
```

After changes: `sudo systemctl restart pixel-office`

### Adding Your Agents

Agents are stored in the SQLite database. The app reads them from `/api/agents` and maps them to pixel characters on the canvas.

You can insert agents via drizzle migrations or directly with SQLite:

```sql
INSERT INTO agents (id, name, role, emoji, currentStatus)
VALUES ('main', 'Main Agent', 'Coordinator', '🤖', 'idle');
```

---

## 🚀 Manual Install

If you prefer to install manually instead of using the skill:

```bash
# 1. Clone
cd ~/agents-workspace
git clone https://github.com/SC32br/openclaw-skill-pixel-office pixel-office
cd pixel-office

# 2. Build
npm install
npm run build

# 3. Create .env.local
cp .env.example .env.local  # edit as needed

# 4. systemd service
sudo cp deploy/pixel-office.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pixel-office

# 5. nginx — add to your server {} block
# See deploy/nginx-location.conf for the required location blocks

# 6. htpasswd
PASSWORD=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 8 | head -n 1)
sudo sh -c "echo -n 'office:' >> /etc/nginx/.htpasswd"
sudo sh -c "openssl passwd -apr1 '$PASSWORD' >> /etc/nginx/.htpasswd"
echo "Password: $PASSWORD"

# 7. Reload
sudo nginx -t && sudo systemctl reload nginx
```

---

## 🔧 Troubleshooting

### White screen / Pixi.js not loading
**Cause:** Missing `/_next/` location block in nginx → JS chunks return 404.  
**Fix:** Add the `/_next/` location block from `deploy/nginx-location.conf`.

```bash
# Check browser console for:
# GET https://yourdomain.com/_next/static/chunks/... 404
```

### 0 agents shown in sidebar
**Cause:** `auth_basic` on `/api/` location → XHR gets 401.  
**Fix:** Remove `auth_basic` from the `/api/` location block.

### Service not starting
```bash
sudo journalctl -u pixel-office -n 50 --no-pager
```

### Port conflict
```bash
sudo lsof -i :3001
# Change PORT in .env.local and update nginx proxy_pass
```

### Build errors
```bash
node --version  # must be ≥ 18.x
npm install
npm run build 2>&1 | tail -40
```

---

## 📁 Project Structure

```
pixel-office/
├── SKILL.md                    # OpenClaw auto-installer
├── deploy/
│   ├── nginx-location.conf     # nginx location blocks (copy into server {})
│   └── pixel-office.service    # systemd service unit
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agents/         # GET /api/agents → SQLite
│   │   │   ├── activity/feed/  # GET /api/activity/feed
│   │   │   └── openclaw/stats/ # GET /api/openclaw/stats → Gateway
│   │   ├── office/stream/      # Main dashboard page
│   │   └── stream/             # Alt stream route
│   ├── components/office/
│   │   ├── PixelOffice.tsx     # Main Pixi.js canvas component
│   │   ├── drawAgent.ts        # Pixel character rendering
│   │   └── drawOffice.ts       # Office environment (desks, rooms)
│   ├── lib/db/                 # drizzle-orm schema + SQLite client
│   ├── stores/                 # Zustand stores (agents, auth, ui)
│   └── middleware.ts           # Rate limiting + auth middleware
└── package.json
```

---

## 🎨 Customization

### Change the emoji / agent appearance
Edit `src/components/office/drawAgent.ts` — each agent ID maps to a color scheme and pixel sprite style.

### Add more desk positions
Edit `DESK_POSITIONS` in `src/components/office/drawOffice.ts`.

### Change the port
Update `PORT` in `.env.local`, the systemd service file, and nginx `proxy_pass`.

---

## 📄 License

MIT — free to use, modify, and deploy.

---

*Part of the [OpenClaw](https://openclaw.io) skills ecosystem.*
