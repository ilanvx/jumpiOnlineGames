#!/usr/bin/env bash
# Jumpi Games: sets up the Hetzner server (Ubuntu 24.04). Safe to run again.
# Run on the server as the user "ilan":   bash ~/setup-server.sh
# It never asks for or writes any secret: the .env file is copied by Ilan himself.
set -euo pipefail
APP=~/jumpi
say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }

say "1/6 System updates and basic tools"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y git curl ca-certificates fail2ban unattended-upgrades
sudo systemctl enable --now fail2ban

say "2/6 Node.js 22 (LTS)"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1)" != "v22" ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi
node -v

say "3/6 The game's code from GitHub"
if [ -d "$APP/.git" ]; then git -C "$APP" pull --ff-only; else git clone https://github.com/ilanvx/jumpionlinegames.git "$APP"; fi
cd "$APP"
npm ci --omit=dev

say "4/6 pm2 (keeps the game running, starts it again after a crash or a reboot)"
command -v pm2 >/dev/null || sudo npm install -g pm2
sudo env PATH="$PATH" "$(command -v pm2)" startup systemd -u "$USER" --hp "$HOME" >/dev/null
pm2 install pm2-logrotate >/dev/null 2>&1 || true

say "5/6 Cloudflare Tunnel program (cloudflared; the tunnel itself is connected later with Ilan's token)"
if ! command -v cloudflared >/dev/null; then
  sudo mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
  sudo apt-get update -y && sudo apt-get install -y cloudflared
fi
cloudflared --version

say "6/6 Start the game"
if [ ! -f "$APP/.env" ]; then
  echo "No .env yet. Copy it from your computer (see the instructions), then run this script again."
  exit 0
fi
chmod 600 "$APP/.env"
if pm2 describe jumpi >/dev/null 2>&1; then pm2 restart jumpi --update-env; else pm2 start server.js --name jumpi; fi
pm2 save
sleep 4
echo; echo "--- check ---"
curl -s -o /dev/null -w "local web page: HTTP %{http_code}\n" http://localhost:3000/ || true
pm2 logs jumpi --lines 15 --nostream || true
