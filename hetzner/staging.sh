#!/usr/bin/env bash
# Jumpi Games: a private TEST copy of the site next to the real one, on the same server.   bash ~/staging.sh
#   - the code: the "staging" branch on GitHub (Claude pushes there freely; main stays for the real site)
#   - its own folder (~/jumpi-staging), its own port (3100), its OWN database ("jumpi_staging"): nothing touches real players
#   - no payments, no emails, no Discord bot from the test copy
#   - every minute it checks GitHub; when the staging branch has new code it updates itself and restarts
# Safe to run again. It never shows or prints any secret: it copies the real .env and only adds lines at the end
# (later lines win), so the passwords and keys in it are never read by anyone.
set -euo pipefail
LIVE=~/jumpi; APP=~/jumpi-staging; PORT=3100
say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }

say "1/4 The test copy of the code (branch: staging)"
if [ -d "$APP/.git" ]; then git -C "$APP" fetch origin staging && git -C "$APP" checkout -q staging && git -C "$APP" reset -q --hard origin/staging
else git clone -b staging https://github.com/ilanvx/jumpionlinegames.git "$APP"; fi
cd "$APP"; npm ci --omit=dev

say "2/4 Its settings: the real .env + test overrides (own port and database, no payments, emails or Discord)"
[ -f "$LIVE/.env" ] || { echo "No $LIVE/.env found: the real site has to be set up first."; exit 1; }
cp "$LIVE/.env" "$APP/.env"; chmod 600 "$APP/.env"
cat >> "$APP/.env" <<'EOF'

# ---- test copy (added by staging.sh) ----
PORT=3100
MONGODB_DB=jumpi_staging
PUBLIC_URL=https://staging.jumpigames.com
STAGING=1
DISCORD_LIVE=0
HYP_MASOF=
HYP_PASSP=
HYP_KEY=
PAYMENTS_CODE=
STORE_TEST=1
RESEND_API_KEY=
MS_CLIENT_SECRET=
EOF

say "3/4 Start it (pm2 name: jumpi-staging)"
if pm2 describe jumpi-staging >/dev/null 2>&1; then pm2 restart jumpi-staging --update-env; else pm2 start server.js --name jumpi-staging --cwd "$APP"; fi
pm2 save

say "4/4 Update by itself every minute when the staging branch changes"
cat > ~/staging-update.sh <<'EOF'
#!/usr/bin/env bash
# run every minute by cron: if GitHub's staging branch has new code, take it and restart the test copy
cd ~/jumpi-staging || exit 0
git fetch -q origin staging || exit 0
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/staging)" ] && exit 0
OLD=$(git rev-parse HEAD)
git reset -q --hard origin/staging
git diff --quiet "$OLD" HEAD -- package.json package-lock.json || npm ci --omit=dev >/dev/null 2>&1
pm2 restart jumpi-staging --update-env >/dev/null
echo "$(date '+%F %T') updated to $(git log -1 --format='%h %s')" >> ~/staging-update.log
EOF
chmod +x ~/staging-update.sh
( crontab -l 2>/dev/null | grep -v staging-update.sh; echo "* * * * * bash ~/staging-update.sh" ) | crontab -
sleep 4
curl -s -o /dev/null -w "test copy on this server: HTTP %{http_code} (http://localhost:$PORT)\n" "http://localhost:$PORT/" || true
echo
echo "Last step, in Cloudflare (once): Zero Trust → Networks → Tunnels → your tunnel → Public Hostname → Add:"
echo "   staging.jumpigames.com  →  http://localhost:$PORT"
echo "Then lock it to you: Zero Trust → Access → Applications → Add (Self-hosted) for staging.jumpigames.com, allow only your email."
