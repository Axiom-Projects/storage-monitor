#!/bin/zsh
# Weekly HEADED scrape, run locally on Sam's Mac via launchd (com.sam.storage-scrape).
# Real headed Chrome clears the anti-bot walls that block the headless GitHub Actions
# runner: Safestore (reCAPTCHA v3) and Big Yellow (Incapsula). Everything else the
# daily Actions scrape already handles; this run refreshes those two + the weekly
# email-quote forms, then commits & pushes so GitHub Pages updates.
#
# Requires: a logged-in GUI session (headed Chrome needs a display) and Google Chrome.
# NordVPN may be on or off — headed Chrome passes reCAPTCHA either way; a UK/residential
# egress (VPN off) is marginally more reliable.

set -u
REPO="/Users/sam/storage-monitor"
NODE="/opt/homebrew/bin/node"
GIT="/usr/bin/git"
LOG="$REPO/scraper/local-scrape.log"

exec >>"$LOG" 2>&1
echo "===== $(date '+%Y-%m-%d %H:%M:%S') local headed scrape starting ====="

cd "$REPO" || { echo "repo not found"; exit 1; }

# Sync first so we commit on top of the daily Actions bot commits (avoids push races).
"$GIT" pull --ff-only || echo "WARN: git pull --ff-only failed (continuing on local state)"

# HEADED=1 -> Safestore/Big Yellow via headed Chrome; FORCE_QUOTES=1 -> run the quote day.
HEADED=1 FORCE_QUOTES=1 "$NODE" scraper/scrape.js
STATUS=$?
echo "scrape.js exit status: $STATUS"

if [ $STATUS -ne 0 ]; then
    echo "scrape failed; not committing"
    exit $STATUS
fi

if ! "$GIT" diff --quiet -- data.js; then
    "$GIT" add data.js
    "$GIT" commit -m "Weekly headed scrape (Safestore + Big Yellow) $(date +%Y-%m-%d)"
    "$GIT" push && echo "pushed." || echo "WARN: git push failed"
else
    echo "no data.js change to commit"
fi

echo "===== done $(date '+%Y-%m-%d %H:%M:%S') ====="
