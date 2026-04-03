<div align="center">

# 🏢 openclaw-skill-pixel-office

**A retro pixel art office dashboard for your OpenClaw AI agents**

[![OpenClaw Skill](https://img.shields.io/badge/OpenClaw-Skill-6c47ff?style=for-the-badge)](https://openclaw.ai)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Pixi.js](https://img.shields.io/badge/Pixi.js-Canvas-e91e63?style=for-the-badge)](https://pixijs.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

---

**Watch your AI agents live — animated pixel characters on a retro office map**

[🚀 Quick Start](#quick-start) · [🗺️ How It Works](#how-it-works) · [⚙️ Configuration](#configuration) · [🛠 Deploy](#deploy) · [🐛 Troubleshooting](#troubleshooting)

</div>

---

## What Is This?

A **live pixel art office** that visualizes all your OpenClaw AI agents as animated retro characters. Each agent has a desk on the map, moves based on status, and shows activity in a live feed.

Built with **Next.js 15** + **Pixi.js** for canvas rendering. Served behind nginx with Basic Auth.

<div align="center">

```
┌─────────────────────────────────────────────────────┐
│  🦠 Вируся AI Office                    LIVE  🔴    │
│  10 агентов • 3 онлайн                  CRT [ON]    │
├──────────────────────────────────┬──────────────────┤
│                                  │  👥 АГЕНТЫ        │
│   [pixel office map canvas]      │  📋 Маркетолог   │
│                                  │  ● Working       │
│   🧑 🧑‍💻    🧑‍💻                   │  ✍️ Копирайтер   │
│         🧑‍💻  🏃                   │  ● Idle          │
│   🧑‍💻         🧑‍💻                  │  🤖 Клодик       │
│                                  │  ● Working       │
│                                  ├──────────────────┤
│                                  │  LIVE FEED       │
│                                  │  13:48 Анализ... │
│                                  │  13:47 Пишу пост │
└──────────────────────────────────┴──────────────────┘
```

</div>

---

## Features

| Feature | Description |
|---------|-------------|
| 🗺️ **Pixel office map** | Retro pixel art environment — desks, shelves, plants, whiteboards |
| 🏃 **Live animations** | Agents animate based on status: idle bouncing, working running, error shaking |
| 📊 **Status sidebar** | All agents listed with role, emoji, and current state |
| 📡 **Live Feed** | Real-time scrolling log of agent activity |
| 🖥️ **CRT scanline effect** | Toggle retro CRT screen overlay |
| 🔴 **LIVE indicator** | Pulsing dot when any agent is active |
| 🤝 **"Gather all" button** | Animate all agents to center of map |
| 🔒 **Basic Auth** | nginx password protection |

---

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│  Browser  →  nginx (Basic Auth, port 443)                    │
│                                                              │
│  /_next/static/*  →  proxy_pass :3001  (JS/CSS assets)       │
│  /api/*           →  proxy_pass :3001  (no auth, XHR safe)   │
│  /office/*        →  rewrite + proxy_pass :3001              │
│                                                              │
│  Next.js app (port 3001)                                     │
│    /office/stream     ← main page (Pixi.js canvas)           │
│    /api/agents        ← reads agents from OpenClaw Gateway   │
│    /api/openclaw/stats ← token usage, costs                  │
│                                                              │
│  OpenClaw Gateway (port 18789)                               │
│    GET /agents  →  returns all registered agents + status    │
└──────────────────────────────────────────────────────────────┘
```

**Key insight:** `/_next/` static assets **must** proxy to Next.js (port 3001), not the OpenClaw gateway (port 18789). Without this, JS chunks return 404 → Pixi.js never loads → blank canvas.

---

## Quick Start

### 1. Clone and install

```bash
cd ~/agents-workspace
git clone https://github.com/SC32br/openclaw-skill-pixel-office virusy-office
cd virusy-office
npm install
```

### 2. Set environment variables

```bash
cat > .env.local << EOF
OPENCLAW_GATEWAY_URL=http://localhost:18789
OPENCLAW_TOKEN=your_openclaw_gateway_token
EOF
```

### 3. Build and run

```bash
npm run build
npm start
# Running on http://localhost:3001
```

### 4. Configure nginx

Add to your nginx server block (see `deploy/nginx-location.conf`):

```nginx
# ⚠️ Critical: _next/ must proxy to Next.js, not gateway
location ^~ /_next/ {
    auth_basic "Office";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# API — no auth (browser XHR won't send Basic Auth headers)
location ^~ /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
}

# Dashboard
location ^~ /office/ {
    auth_basic "Office";
    auth_basic_user_file /etc/nginx/.htpasswd;
    rewrite ^/office/(.*)$ /$1 break;
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location = /office {
    return 302 /office/stream;
}
```

```bash
# Create password
sudo htpasswd -c /etc/nginx/.htpasswd youruser
sudo nginx -t && sudo systemctl reload nginx
```

### 5. Open the dashboard

```
https://yourdomain.com/office/
```

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENCLAW_GATEWAY_URL` | ✅ | Gateway URL, e.g. `http://localhost:18789` |
| `OPENCLAW_TOKEN` | ✅ | Gateway token from `openclaw.json` |
| `PORT` | ❌ | Next.js port (default: 3001) |

### Agent Positions

Each agent on the map needs `positionX` and `positionY`. These are set when agents are registered in OpenClaw and stored in the agents database.

Default positions (pixels on 1000×700 canvas):

```
(100, 400)  — Main coordinator   (center-left)
(600, 200)  — Marketer           (top-right area)
(750, 200)  — Copywriter
(600, 350)  — Publisher
(750, 350)  — Storymaker
(600, 500)  — Analyst
(750, 500)  — Targetologist
(880, 160)  — Stats agent
(150, 540)  — Carousel maker
(330, 540)  — Video agent
```

---

## Deploy

### Systemd service

```bash
sudo cp deploy/virusy-office.service /etc/systemd/system/
# Edit Environment= lines with your token
sudo systemctl daemon-reload
sudo systemctl enable --now virusy-office
sudo systemctl status virusy-office
```

`deploy/virusy-office.service`:

```ini
[Unit]
Description=Vируся AI Office Dashboard
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/home/openclaw/agents-workspace/virusy-office
ExecStart=/home/openclaw/.nvm/versions/node/v22.22.2/bin/node node_modules/.bin/next start -p 3001
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=OPENCLAW_GATEWAY_URL=http://localhost:18789
Environment=OPENCLAW_TOKEN=your_token_here

[Install]
WantedBy=multi-user.target
```

### Disk space

- Next.js build: ~200 MB
- Node modules: ~500 MB
- Total: ~700 MB — ensure at least 1 GB free before building

---

## Troubleshooting

### 0 agents / blank canvas

Most common cause: **`/_next/` not proxied to port 3001**.

```bash
# Test: should return JS, not 404
curl -u user:pass https://yourdomain.com/_next/static/chunks/main.js -I
# Must return: Content-Type: application/javascript
```

Fix: add `location ^~ /_next/` to nginx config (see above).

### 401 on /api/agents

`/api/` location has `auth_basic` → browser XHR returns 401 → 0 agents shown.

Fix: remove `auth_basic` from `/api/` location — Next.js middleware handles auth internally.

### Pixi.js canvas not rendering

Check browser console (F12):
- `Refused to execute script ... MIME type 'text/plain'` → `/_next/` not proxied
- `Failed to load resource: 404` → same issue
- No errors but blank → check `OPENCLAW_GATEWAY_URL` and `OPENCLAW_TOKEN`

### Build fails: "No space left on device"

```bash
df -h /
# Need 1+ GB free
sudo journalctl --vacuum-size=100M
sudo apt-get clean
pip cache purge
```

---

## File Structure

```
openclaw-skill-pixel-office/
├── SKILL.md                    # OpenClaw skill descriptor
├── README.md                   # This file
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agents/         # GET /api/agents
│   │   │   └── openclaw/stats/ # GET /api/openclaw/stats
│   │   ├── office/stream/      # Main dashboard page
│   │   └── layout.tsx
│   ├── components/
│   │   ├── PixelOffice.tsx     # Pixi.js canvas component
│   │   ├── AgentSidebar.tsx    # Right panel
│   │   └── LiveFeed.tsx        # Activity log
│   └── middleware.ts           # Auth middleware
├── deploy/
│   ├── nginx-location.conf     # nginx config snippet
│   └── virusy-office.service  # systemd unit
├── public/
│   └── assets/                 # Pixel art sprites
└── LICENSE
```

---

## Links

| Resource | URL |
|----------|-----|
| OpenClaw | https://openclaw.ai |
| OpenClaw Docs | https://docs.openclaw.ai |
| Next.js | https://nextjs.org |
| Pixi.js | https://pixijs.com |

---

## License

MIT © 2026

---

<div align="center">

Made with ❤️ for the OpenClaw community

**[⭐ Star this repo](https://github.com/SC32br/openclaw-skill-pixel-office)** if it helped you!

</div>
