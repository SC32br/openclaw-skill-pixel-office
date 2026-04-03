---
name: pixel-office
description: Deploy a live pixel art office dashboard for your OpenClaw AI agents. Automated install — agent clones repo, builds, configures nginx, creates password, and gives you the URL. One command: "install pixel office". Shows all agents as animated pixel characters with real-time status and activity feed. Triggers on: pixel office, install office, agent dashboard, agent monitor, live office, пиксельный офис, установи офис, дашборд агентов.
---

# Pixel Office — Auto-Install Skill

This skill deploys the **Pixel Office** dashboard: a live pixel-art canvas showing all your OpenClaw AI agents as animated characters, with real-time status and activity feed.

## When This Skill Activates

User says something like:
- "install pixel office"
- "setup agent dashboard"
- "установи пиксельный офис"
- "дашборд агентов"
- "live office"

---

## Agent Instructions (Step-by-Step)

### Step 0: Pre-flight Check

```bash
# Check required tools
node --version   # need v18+
npm --version
nginx -v
git --version
```

If any tool is missing, inform the user and stop.

---

### Step 1: Clone the Repo

```bash
cd ~/agents-workspace
git clone https://github.com/SC32br/openclaw-skill-pixel-office pixel-office
cd pixel-office
```

---

### Step 2: Install & Build

```bash
npm install
npm run build
```

> Build takes 1–3 minutes. If it fails, check Node version (`node --version` must be ≥18).

---

### Step 3: Generate a Random Password

```bash
PASSWORD=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 8 | head -n 1)
echo "Generated password: $PASSWORD"
```

Save it — you'll need it in Step 6 and to report to the user.

---

### Step 4: Determine the Domain

Ask the user:
> "What domain or subdomain should Pixel Office run on? For example: `office.yourdomain.com` or just your server IP."

If the user doesn't know, try to detect from existing nginx configs:
```bash
grep -r "server_name" /etc/nginx/sites-enabled/ 2>/dev/null | head -5
```

Store the answer as `DOMAIN`.

---

### Step 5: Configure Environment

```bash
cat > ~/agents-workspace/pixel-office/.env.local << EOF
NODE_ENV=production
PORT=3001

# OpenClaw Gateway (optional — for real token/cost stats)
OPENCLAW_GATEWAY_URL=http://localhost:18789
# OPENCLAW_TOKEN=your_token_here

# SQLite database path
DATABASE_URL=$(pwd)/data/office.db
EOF

mkdir -p ~/agents-workspace/pixel-office/data
```

---

### Step 6: Create systemd Service

```bash
sudo tee /etc/systemd/system/pixel-office.service > /dev/null << 'SYSTEMD'
[Unit]
Description=Pixel Office — AI Agents Dashboard
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/home/openclaw/agents-workspace/pixel-office
ExecStart=/usr/bin/node node_modules/.bin/next start -p 3001
Restart=on-failure
RestartSec=5
EnvironmentFile=/home/openclaw/agents-workspace/pixel-office/.env.local

[Install]
WantedBy=multi-user.target
SYSTEMD

sudo systemctl daemon-reload
sudo systemctl enable pixel-office
sudo systemctl start pixel-office
sleep 3
sudo systemctl status pixel-office --no-pager
```

Verify it started: should show `Active: active (running)`.

---

### Step 7: Configure nginx

**Create the htpasswd file:**
```bash
sudo sh -c "echo -n 'office:' >> /etc/nginx/.htpasswd"
sudo sh -c "openssl passwd -apr1 '$PASSWORD' >> /etc/nginx/.htpasswd"
```

**Add nginx location blocks** inside your `server {}` block for `$DOMAIN`:

```nginx
# ⚠️ CRITICAL: Do NOT remove /_next/ block — JS assets will 404 → white screen
# ⚠️ CRITICAL: Do NOT add auth_basic to /api/ — XHR will get 401 → 0 agents shown

location ^~ /_next/ {
    auth_basic "Pixel Office";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location ^~ /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location ^~ /office/ {
    auth_basic "Pixel Office";
    auth_basic_user_file /etc/nginx/.htpasswd;
    rewrite ^/office/(.*)$ /$1 break;
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_buffering off;
}
```

The ready-made config is also at `deploy/nginx-location.conf` in the repo.

---

### Step 8: Test & Reload nginx

```bash
sudo nginx -t && sudo systemctl reload nginx
```

If `nginx -t` fails, show the user the error output and stop.

---

### Step 9: Report to User

Send the user this summary:

```
✅ Pixel Office installed!

🌐 URL:      https://<DOMAIN>/office/stream
👤 Login:    office
🔑 Password: <PASSWORD>

Open the URL in your browser and enter the credentials.
Your AI agents will appear as pixel characters in real time!

💡 To see token stats, set OPENCLAW_TOKEN in:
   ~/agents-workspace/pixel-office/.env.local
   Then: sudo systemctl restart pixel-office
```

---

## Troubleshooting

### White screen / Pixi.js not loading
→ You're missing the `/_next/` nginx location block.  
→ Check browser console for 404s on `/static/chunks/...`

### 0 agents shown / agents list empty
→ The `/api/agents` endpoint returned 401.  
→ Ensure **no** `auth_basic` on `location ^~ /api/`.

### Service not starting
```bash
sudo journalctl -u pixel-office -n 50 --no-pager
```

### Port 3001 already in use
```bash
sudo lsof -i :3001
```
Change `PORT=3001` in `.env.local` and update the service file + nginx `proxy_pass`.

### Build fails
```bash
node --version  # must be ≥ 18
cd ~/agents-workspace/pixel-office
npm install
npm run build 2>&1 | tail -30
```

---

## Architecture Notes

- **Next.js 16** app on port 3001
- **SQLite** (better-sqlite3 + drizzle-orm) for agent/activity data
- **Pixi.js v8** for pixel-art canvas rendering
- **Zustand** for client state
- **nginx** handles auth + reverse proxy
- OpenClaw Gateway is queried every 10s for live agent status
- Activity feed polls `/api/activity/feed` every 10s
