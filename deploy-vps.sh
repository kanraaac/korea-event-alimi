#!/bin/bash
set -euo pipefail
DEST=/docker/korea-event-alimi
REPO=https://github.com/kanraaac/korea-event-alimi.git
mkdir -p /docker
if [ -d "$DEST/.git" ]; then
  git -C "$DEST" fetch origin
  git -C "$DEST" reset --hard origin/main
else
  rm -rf "$DEST"
  git clone "$REPO" "$DEST"
fi
cd "$DEST"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "EDIT $DEST/.env with real keys first (see docs/VPS.md), then re-run:"
  echo "  cd $DEST && docker compose up -d --build"
  exit 0
fi
docker compose up -d --build
sleep 2
docker compose ps
echo "manual test: docker compose exec digest node /app/run.mjs"
echo "dry run:    docker compose exec -e DRY_RUN=1 digest node /app/run.mjs"
echo "logs:       docker compose exec digest tail -n 100 /var/log/digest.log"
