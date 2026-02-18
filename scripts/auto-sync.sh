#!/bin/bash
# Auto-sync: commit & push any changes every hour
REPO_DIR="/Users/gd-npc-848/Desktop/FeishuClaw/Dreamlab/dreamlab"
LOG="$REPO_DIR/scripts/auto-sync.log"

cd "$REPO_DIR" || exit 1

# Only commit if there are changes
if [[ -n $(git status --porcelain) ]]; then
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
  git add -A
  git commit -m "auto-save: $TIMESTAMP"
  git push >> "$LOG" 2>&1
  echo "[$TIMESTAMP] pushed" >> "$LOG"
else
  echo "[$(date '+%Y-%m-%d %H:%M')] no changes" >> "$LOG"
fi
