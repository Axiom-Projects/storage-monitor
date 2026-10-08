#!/bin/zsh
# Weekly competitor prices via Sam's REAL Chrome (launchd com.sam.storage-scrape, Mondays 10:00).
# Oct 2026: Big Yellow (Imperva hCaptcha) and Safestore (reCAPTCHA v3) now block every automated browser,
# including the headed Playwright run (run-local-headed.sh). Both load normally in Sam's own Chrome, so a
# Claude session with ONLY the Chrome tools follows scraper/chrome-runbook.md (Big Yellow, Safestore, Access),
# returns prices as JSON, apply-chrome-prices.js sanity-checks + writes data.js, then commit, push and text Sam.
#
#   chrome-weekly.sh [--dry-run] [--only bigyellow|safestore|access]
# Needs: Mac awake + logged in, Google Chrome with the Claude extension connected.
set -u
REPO="/Users/sam/storage-monitor"
CLAUDE="/Users/sam/.local/bin/claude"
NODE="/opt/homebrew/bin/node"
GIT="/usr/bin/git"
LOG="$REPO/scraper/chrome-weekly.log"
RUNS="$REPO/scraper/chrome-runs"                 # git-ignored: raw model output per run, for checking
SEND="$REPO/scraper/send-imessage.applescript"
IMESSAGE_TO="$(cat "$REPO/scraper/.imessage-to" 2>/dev/null)"
CHECKOUT_FLAG="/Users/sam/imessage-bot/data/checkout_active"   # Sam's card may be open in Chrome
DATE="$(date '+%a %d %b %H:%M')"
DRY=0; ONLY=""
while [ $# -gt 0 ]; do case "$1" in --dry-run) DRY=1;; --only) ONLY="$2"; shift;; esac; shift; done

log() { echo "$(date '+%F %T') $*" >>"$LOG"; }
notify() {
    log "STATUS: $1"
    [ $DRY -eq 1 ] && return
    [ -z "$IMESSAGE_TO" ] && { log "WARN: no iMessage handle"; return; }
    /usr/bin/osascript "$SEND" "$IMESSAGE_TO" "$1" 2>>"$LOG" || log "WARN: iMessage send failed"
}

cd "$REPO" || exit 1
mkdir -p "$RUNS"
log "===== start (dry=$DRY only=${ONLY:-all}) ====="

# Never drive Chrome while a checkout hand-off is live (same rule as the assistant bot: perms.checkout_live).
if [ -f "$CHECKOUT_FLAG" ] && [ $(( $(date +%s) - $(stat -f %m "$CHECKOUT_FLAG") )) -lt 10800 ]; then
    notify "⚠️ Storage Monitor ($DATE) — weekly prices SKIPPED: a checkout hand-off is open in Chrome. Run scraper/chrome-weekly.sh later."
    exit 0
fi

pgrep -x "Google Chrome" >/dev/null || { open -a "Google Chrome"; sleep 20; }
"$GIT" pull --ff-only >>"$LOG" 2>&1 || log "WARN: git pull failed"

PROMPT="$(cat "$REPO/scraper/chrome-runbook.md")"
if [ -n "$ONLY" ]; then
    PROMPT="$PROMPT

THIS RUN: do ONLY the '$ONLY' provider; for the other two return {\"status\": \"skipped\"}."
fi
TOOLS="mcp__claude-in-chrome__tabs_context_mcp mcp__claude-in-chrome__tabs_create_mcp mcp__claude-in-chrome__tabs_close_mcp \
mcp__claude-in-chrome__navigate mcp__claude-in-chrome__computer mcp__claude-in-chrome__find mcp__claude-in-chrome__read_page \
mcp__claude-in-chrome__get_page_text mcp__claude-in-chrome__javascript_tool mcp__claude-in-chrome__form_input \
mcp__claude-in-chrome__browser_batch"
STAMP="$(date +%Y%m%d-%H%M)"
RAW="$RUNS/$STAMP.json"

# Chrome tools only: no shell, no file access. Uses the claude.ai login (not an API key / parent session env).
env -u ANTHROPIC_API_KEY -u CLAUDE_CODE_ENTRYPOINT -u CLAUDE_CODE_SESSION_ID -u CLAUDE_CODE_CHILD_SESSION \
    "$CLAUDE" --print --chrome --model claude-opus-5-5 --effort medium --tools "" \
    --allowed-tools "$TOOLS" --permission-mode default --permission-prompts none --no-session-persistence \
    --output-format json <<<"$PROMPT" >"$RAW" 2>>"$LOG"
log "claude exit $? -> $RAW"

RESULT="$RUNS/$STAMP.result.json"
"$NODE" -e '
const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); const t=j.result||"";
const o=JSON.parse(t.slice(t.indexOf("{"))); require("fs").writeFileSync(process.argv[2], JSON.stringify(o,null,1));' \
    "$RAW" "$RESULT" 2>>"$LOG" || {
    notify "⚠️ Storage Monitor ($DATE) — weekly prices FAILED: the Chrome run returned no readable result. See scraper/chrome-weekly.log."
    exit 1; }

SUMMARY="$("$NODE" "$REPO/scraper/apply-chrome-prices.js" "$RESULT" $([ $DRY -eq 1 ] && echo --dry-run) 2>&1)"; APPLIED=$?
log "$SUMMARY"
PUSHNOTE=""
if [ $DRY -eq 0 ] && [ $APPLIED -eq 0 ] && ! "$GIT" diff --quiet -- data.js; then
    "$GIT" add data.js && "$GIT" commit -q -m "Weekly real-Chrome prices (Big Yellow, Safestore, Access) $(date +%Y-%m-%d)" >>"$LOG" 2>&1
    if "$GIT" push -q >>"$LOG" 2>&1; then PUSHNOTE="Pushed live."; else PUSHNOTE="But git push FAILED - check the log."; fi
fi
if [ $APPLIED -eq 0 ]; then
    notify "✅ Storage Monitor ($DATE) — weekly prices updated. $PUSHNOTE
$SUMMARY"
else
    notify "⚠️ Storage Monitor ($DATE) — weekly prices NOT updated.
$SUMMARY"
fi
