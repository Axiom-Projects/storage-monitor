#!/bin/zsh
# Weekly HEADED scrape, run locally on Sam's Mac via launchd (com.sam.storage-scrape).
# Real headed Chrome clears the anti-bot walls that block the headless GitHub Actions
# runner: Safestore (reCAPTCHA v3) and Big Yellow (Incapsula). Everything else the
# daily Actions scrape already handles; this run refreshes those two + the weekly
# email-quote forms, commits & pushes, then texts Sam an iMessage status summary.
#
# Requires: a logged-in GUI session (headed Chrome needs a display) + Google Chrome.
# NordVPN may be on or off — headed Chrome passes reCAPTCHA either way.

set -u
REPO="/Users/sam/storage-monitor"
NODE="/opt/homebrew/bin/node"
GIT="/usr/bin/git"
LOG="$REPO/scraper/local-scrape.log"
SEND="$REPO/scraper/send-imessage.applescript"
# Handle kept out of this (public) repo — read from a git-ignored local file.
IMESSAGE_TO="$(cat "$REPO/scraper/.imessage-to" 2>/dev/null)"
RUNLOG="$(/usr/bin/mktemp /tmp/storage-scrape.XXXXXX)"
DATE="$(date '+%a %d %b %H:%M')"

notify() {
    if [ -z "$IMESSAGE_TO" ]; then echo "WARN: no iMessage handle (scraper/.imessage-to missing)" >>"$LOG"; return; fi
    /usr/bin/osascript "$SEND" "$IMESSAGE_TO" "$1" 2>>"$LOG" || echo "WARN: iMessage send failed" >>"$LOG";
}

echo "===== $(date '+%F %T') local headed scrape starting =====" >>"$RUNLOG"

cd "$REPO" || {
    notify "⚠️ Storage Monitor ($DATE) — update did NOT run: repo folder missing on the Mac."
    cat "$RUNLOG" >>"$LOG"; rm -f "$RUNLOG"; exit 1
}

# Sync first so we commit on top of the daily Actions bot commits (avoids push races).
"$GIT" pull --ff-only >>"$RUNLOG" 2>&1 || echo "WARN: git pull --ff-only failed (continuing)" >>"$RUNLOG"

# HEADED=1 -> Safestore/Big Yellow via headed Chrome; FORCE_QUOTES=1 -> run the quote day.
HEADED=1 FORCE_QUOTES=1 "$NODE" scraper/scrape.js >>"$RUNLOG" 2>&1
STATUS=$?

# --- Commit & push if data changed ---
PUSHED=3   # 1=pushed, 2=push failed, 3=no change
if [ $STATUS -eq 0 ] && ! "$GIT" diff --quiet -- data.js; then
    "$GIT" add data.js >>"$RUNLOG" 2>&1
    "$GIT" commit -m "Weekly headed scrape (Safestore + Big Yellow) $(date +%Y-%m-%d)" >>"$RUNLOG" 2>&1
    if "$GIT" push >>"$RUNLOG" 2>&1; then PUSHED=1; else PUSHED=2; fi
fi

# --- Assess what actually happened (for the "why" in the status text) ---
HEADED_OK=0; grep -q "Headed Chrome launched" "$RUNLOG" && HEADED_OK=1
BY_OK=0;     grep -q 'Big Yellow prices: {"' "$RUNLOG" && BY_OK=1
SS_COUNT=$(grep -c "(online price)" "$RUNLOG" 2>/dev/null); SS_COUNT=${SS_COUNT//[^0-9]/}; SS_COUNT=${SS_COUNT:-0}
SS_RECAP=0;  grep -q "reCAPTCHA blocked all attempts" "$RUNLOG" && SS_RECAP=1

case $PUSHED in
    1) PUSHNOTE="Pushed live." ;;
    2) PUSHNOTE="But git push FAILED — updated locally only, check the log." ;;
    3) PUSHNOTE="No price changes vs last week." ;;
esac

if [ $STATUS -ne 0 ]; then
    MSG="⚠️ Storage Monitor ($DATE) — update FAILED. The scraper crashed (exit $STATUS). See scraper/local-scrape.log."
elif [ $HEADED_OK -ne 1 ]; then
    MSG="⚠️ Storage Monitor ($DATE) — update did NOT complete: headed Chrome couldn't launch (Mac locked/asleep, or a Chrome issue), so Safestore & Big Yellow were not refreshed."
else
    if [ $SS_RECAP -eq 1 ] && [ "$SS_COUNT" -eq 0 ]; then SS_FAIL="Safestore (reCAPTCHA blocked)"; else SS_FAIL="Safestore (no price returned)"; fi
    if [ $BY_OK -eq 1 ] && [ "$SS_COUNT" -gt 0 ]; then
        BY50="$("$NODE" -e 'const fs=require("fs");try{const S=new Function(fs.readFileSync("data.js","utf8")+";return SITES;")().islington;process.stdout.write(String(S.currentPrices.bigyellow["50"]))}catch(e){}' 2>/dev/null)"
        SS50="$("$NODE" -e 'const fs=require("fs");try{const S=new Function(fs.readFileSync("data.js","utf8")+";return SITES;")().islington;process.stdout.write(String(S.currentPrices.safestore["50"]))}catch(e){}' 2>/dev/null)"
        PRICELINE=""; [ -n "$BY50" ] && [ -n "$SS50" ] && PRICELINE=" (BY 50ft £$BY50 · SS 50ft £$SS50)"
        MSG="✅ Storage Monitor ($DATE) — weekly update DONE. Safestore ($SS_COUNT/5) & Big Yellow refreshed via Chrome.$PRICELINE $PUSHNOTE"
    elif [ $BY_OK -eq 1 ] || [ "$SS_COUNT" -gt 0 ]; then
        if [ $BY_OK -eq 1 ]; then WORKED="Big Yellow ✓"; FAILED="$SS_FAIL"; else WORKED="Safestore ✓ ($SS_COUNT/5)"; FAILED="Big Yellow (no price — flow may have changed)"; fi
        MSG="⚠️ Storage Monitor ($DATE) — PARTIAL update. Worked: $WORKED. Failed: $FAILED. $PUSHNOTE See scraper/local-scrape.log."
    else
        MSG="⚠️ Storage Monitor ($DATE) — update FAILED. Neither refreshed — Big Yellow (no price) & $SS_FAIL. See scraper/local-scrape.log."
    fi
fi

cat "$RUNLOG" >>"$LOG"
rm -f "$RUNLOG"
echo "STATUS MSG: $MSG" >>"$LOG"
notify "$MSG"
