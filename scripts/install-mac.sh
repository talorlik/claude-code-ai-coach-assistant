#!/bin/bash
# Game Changer App Template — macOS Interactive Installer
#
# Usage (recommended — process substitution keeps stdin on the terminal):
#   bash <(curl -fsSL https://raw.githubusercontent.com/RanNahmany/game-changer-app-template/main/scripts/install-mac.sh)
#
# Or download and run:
#   curl -fsSL https://raw.githubusercontent.com/RanNahmany/game-changer-app-template/main/scripts/install-mac.sh -o /tmp/gc-install.sh && bash /tmp/gc-install.sh

set -euo pipefail

REPO_URL="https://github.com/RanNahmany/game-changer-app-template.git"

# ── Colors ──────────────────────────────────────────────────────────────────
cyan()    { echo -e "\033[36m$*\033[0m"; }
green()   { echo -e "\033[32m$*\033[0m"; }
yellow()  { echo -e "\033[33m$*\033[0m"; }
magenta() { echo -e "\033[35m$*\033[0m"; }
bold()    { echo -e "\033[1m$*\033[0m"; }
dim()     { echo -e "\033[2m$*\033[0m"; }
red()     { echo -e "\033[31m$*\033[0m"; }

ok()   { echo -e "  \033[32m✓\033[0m $*"; }
info() { echo -e "  \033[33m→\033[0m $*"; }
err()  { echo -e "  \033[31m✗\033[0m $*"; }

step() {
  echo ""
  cyan "──────────────────────────────────────────────"
  cyan " $*"
  cyan "──────────────────────────────────────────────"
}

# ── Header ───────────────────────────────────────────────────────────────────
echo ""
magenta "╔══════════════════════════════════════════════╗"
magenta "║                                              ║"
magenta "║   🎮  Game Changer — App Template Setup      ║"
magenta "║                                              ║"
magenta "╚══════════════════════════════════════════════╝"
echo ""

# ── Step 1: Project name ─────────────────────────────────────────────────────
step "Step 1 — Project name"
echo ""
dim "  Give your project a name (lowercase, letters/numbers/hyphens)."
dim "  This becomes the folder name and the name in package.json."
echo ""

while true; do
  printf "  $(bold '→ Project name:') " >&2
  # Read from /dev/tty so this works even when the script is piped via curl | bash
  read -r RAW_NAME </dev/tty

  # Sanitize: lowercase, replace anything invalid with a hyphen, collapse & trim hyphens
  PROJECT_NAME=$(echo "$RAW_NAME" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9-]/-/g' \
    | sed 's/--*/-/g' \
    | sed 's/^-//;s/-$//')

  if [[ -z "$PROJECT_NAME" ]]; then
    err "Name cannot be empty — try again."
  else
    break
  fi
done

ok "Project name: $(bold "$PROJECT_NAME")"

# ── Step 2: Detect Desktop (handles Hebrew "שולחן העבודה") ───────────────────
step "Step 2 — Detecting Desktop folder"

DESKTOP_PATH=""
for candidate in \
    "$HOME/Desktop" \
    "$HOME/שולחן העבודה"; do
  if [[ -d "$candidate" ]]; then
    DESKTOP_PATH="$candidate"
    break
  fi
done

if [[ -z "$DESKTOP_PATH" ]]; then
  DESKTOP_PATH="$HOME"
  info "Desktop folder not found — using home directory: $DESKTOP_PATH"
else
  ok "Desktop: $DESKTOP_PATH"
fi

TARGET_DIR="$DESKTOP_PATH/projects/$PROJECT_NAME"
ok "Target folder: $(bold "$TARGET_DIR")"

# ── Step 3: Clone ─────────────────────────────────────────────────────────────
step "Step 3 — Cloning template"

if [[ -d "$TARGET_DIR" ]]; then
  err "Folder already exists: $TARGET_DIR"
  echo "  Delete it first, or pick a different project name."
  exit 1
fi

mkdir -p "$DESKTOP_PATH/projects"
git clone "$REPO_URL" "$TARGET_DIR"
ok "Template cloned"

# ── Step 4: Setup ─────────────────────────────────────────────────────────────
step "Step 4 — Running project setup"

cd "$TARGET_DIR"
npm run setup

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
green "══════════════════════════════════════════════════"
bold "✅  All done! Open your project in Claude Code:"
echo ""
echo -e "     $(yellow "cd \"$TARGET_DIR\"")"
echo -e "     $(yellow "claude")"
echo ""
dim "  Then run /start-from-template inside Claude Code."
green "══════════════════════════════════════════════════"
echo ""
