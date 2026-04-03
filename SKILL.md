---
name: pixel-office
description: Deploy a live pixel art office dashboard for your OpenClaw AI agents. Shows all agents as animated pixel characters on a retro office map with real-time status, activity feed, and CRT screen effect. Use when you need to: visualize running AI agents, build a live agent monitor, create a pixel-style ops dashboard, or show agent activity to clients. Triggers on: pixel office, agent dashboard, agent monitor, live office, pixel agents, agent visualization, пиксельный офис, дашборд агентов, офис агентов.
---

# Pixel Office — OpenClaw Agent Dashboard

A retro pixel art office that shows all your OpenClaw agents as animated characters on a live map. Built with Next.js + Pixi.js, served behind nginx.

## What it does

- 🗺️ **Pixel office map** — each agent has a desk on the retro office canvas (Pixi.js)
- 🏃 **Live animations** — agents move and animate based on current status (idle / working / error)
- 📊 **Status panel** — right sidebar shows all agents, roles, and current state
- 📡 **Live Feed** — scrolling activity log of agent actions in real time
- 🖥️ **CRT effect** — optional retro scanline toggle for aesthetics
- 🔒 **Basic Auth** — nginx password protection for the dashboard URL

## Architecture

```
Browser → nginx (Basic Auth)
  → Next.js app (port 3001)
    → GET /api/agents  ← reads from OpenClaw Gateway
    → GET /api/openclaw/stats
    → /office/stream   ← Pixi.js canvas + SSE live feed
```

## Quick Setup

### 1. Clone the skill

```bash
cd ~/agents-workspace
git clone https://github.com/SC32br/openclaw-skill-pixel-office virusy-office
cd virusy-office
npm install
```

### 2. Configure environment

```bash
# .env.local
OPENCLAW_GATEWAY_URL=http://localhost:18789
OPENCLAW_TOKEN=your_gateway_token_here
```

Or set via systemd service environment (see `deploy/virusy-office.service`).

### 3. Build and start

```bash
npm run build
npm start  # runs on port 3001
```

### 4. Configure nginx

See `deploy/nginx-location.conf` — add to your existing nginx server block:

```nginx
# Next.js static assets
location ^~ /_next/ {
    auth_basic "Office";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
}

# API routes (no auth — protected by Next.js middleware)
location ^~ /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
}

# Office dashboard
location ^~ /office/ {
    auth_basic "Office";
    auth_basic_user_file /etc/nginx/.htpasswd;
    rewrite ^/office/(.*)$ /$1 break;
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
}
```

Create password file:
```bash
sudo htpasswd -c /etc/nginx/.htpasswd youruser
```

### 5. Register agents

Agents are loaded from OpenClaw Gateway API. Each agent needs `positionX` and `positionY` in its config to appear on the map.

## Agent Positions

Positions are stored in the OpenClaw agents database. Default grid:

| Agent | X | Y |
|-------|---|---|
| Main coordinator | 100 | 400 |
| Marketer | 600 | 200 |
| Copywriter | 750 | 200 |
| Analyst | 600 | 500 |

## Systemd Service

```bash
sudo cp deploy/virusy-office.service /etc/systemd/system/
sudo systemctl enable --now virusy-office
```

## Troubleshooting

**0 agents shown / white canvas:**
- Check nginx: `/_next/` must proxy to port 3001 (not gateway port)
- Check `/api/agents` returns 200 without auth
- Check `OPENCLAW_GATEWAY_URL` and `OPENCLAW_TOKEN` are set in systemd service

**Pixi.js not loading:**
- Ensure `/_next/` location is in nginx config
- Without it, JS chunks get 404 → canvas never initializes

**Auth loop:**
- `/api/` location must NOT have `auth_basic` — browser XHR doesn't send Basic Auth credentials
