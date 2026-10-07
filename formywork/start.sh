#!/usr/bin/env bash
# FormyWork – démarrage en une commande (macOS et Linux) : ./start.sh
# Installe ce qu'il faut, prépare la base de données et ouvre l'application.
set -u
cd "$(dirname "$0")"

bleu() { printf '\033[1;34m%s\033[0m\n' "$1"; }
ok() { printf '\033[1;32m✓ %s\033[0m\n' "$1"; }
attention() { printf '\033[1;33m! %s\033[0m\n' "$1"; }
erreur() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1"; shift; for l in "$@"; do printf '  %s\n' "$l"; done; echo; exit 1; }

bleu "FormyWork – préparation"

# ------------------------------------------------------------------ Python
PY=""
for c in python3.13 python3.12 python3.14 python3.11 python3 python; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then
    PY="$c"; break
  fi
done
if [ -z "$PY" ]; then
  if command -v python3 >/dev/null 2>&1; then
    erreur "Votre Python est trop ancien ($(python3 --version 2>&1)). Il faut la version 3.11 ou plus récente." \
      "Téléchargez Python 3.13 sur https://www.python.org/downloads/ puis relancez ./start.sh"
  fi
  erreur "Python n'est pas installé." "Téléchargez Python 3.13 sur https://www.python.org/downloads/ puis relancez ./start.sh"
fi
ok "Python trouvé : $($PY --version 2>&1)"

# ------------------------------------------------------------------ environnement Python
if [ ! -x .venv/bin/python ]; then
  bleu "Création de l'environnement Python (une seule fois)…"
  if ! "$PY" -m venv .venv; then
    erreur "Impossible de créer l'environnement Python." \
      "Sous Ubuntu/Debian, installez le module venv :  sudo apt install python3-venv" \
      "puis relancez ./start.sh"
  fi
fi
VPY=.venv/bin/python
REQ_HASH=$(cksum backend/requirements.txt | cut -d' ' -f1)
if [ "$(cat .venv/.formywork-req 2>/dev/null)" != "$REQ_HASH" ]; then
  bleu "Installation des composants Python (2 à 5 minutes la première fois)…"
  "$VPY" -m pip install --upgrade pip >/dev/null 2>&1
  if ! "$VPY" -m pip install -r backend/requirements.txt; then
    erreur "L'installation des composants Python a échoué." \
      "Vérifiez votre connexion internet puis relancez ./start.sh." \
      "Si vous utilisez une version très récente de Python, installez plutôt Python 3.13 :" \
      "https://www.python.org/downloads/  (puis supprimez le dossier .venv et relancez)"
  fi
  echo "$REQ_HASH" > .venv/.formywork-req
fi
ok "Composants Python prêts"

# ------------------------------------------------------------------ fichier .env
if [ ! -f .env ]; then
  cp .env.example .env
  KEY=$("$VPY" -c 'import secrets; print(secrets.token_urlsafe(32))')
  sed -i.bak "s/^SECRET_KEY=.*/SECRET_KEY=$KEY/" .env && rm -f .env.bak
  ok "Fichier .env créé (mode démo activé)"
fi
mkdir -p data

# ------------------------------------------------------------------ interface (Node.js)
STATIC=backend/app/static/index.html
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
  if [ "$NODE_MAJOR" -lt 18 ]; then
    attention "Node.js $(node --version) est trop ancien (18 ou plus requis) : l'interface déjà compilée sera utilisée."
    attention "Pour la mettre à jour : https://nodejs.org (version LTS)"
  else
    NEED_BUILD=0
    [ -f "$STATIC" ] || NEED_BUILD=1
    if [ "$NEED_BUILD" = 0 ] && [ -n "$(find frontend/src frontend/index.html frontend/package.json -newer "$STATIC" 2>/dev/null | head -1)" ]; then NEED_BUILD=1; fi
    if [ "$NEED_BUILD" = 1 ]; then
      bleu "Préparation de l'interface…"
      (cd frontend && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npx vite build --logLevel warn) \
        && ok "Interface compilée" \
        || attention "La compilation de l'interface a échoué : la version déjà compilée sera utilisée."
    fi
    ok "Node.js $(node --version) trouvé"
  fi
else
  attention "Node.js n'est pas installé : l'interface déjà compilée fournie sera utilisée (c'est suffisant)."
fi
[ -f "$STATIC" ] || erreur "L'interface est introuvable (backend/app/static)." "Installez Node.js LTS depuis https://nodejs.org puis relancez ./start.sh"

# ------------------------------------------------------------------ lancement
PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
PORT=${PORT:-8000}
if "$VPY" -c "import socket,sys; s=socket.socket(); sys.exit(0 if s.connect_ex(('127.0.0.1', $PORT)) == 0 else 1)"; then
  erreur "Le port $PORT est déjà utilisé : FormyWork est peut-être déjà ouvert." \
    "Ouvrez http://127.0.0.1:$PORT dans votre navigateur, ou changez PORT dans le fichier .env."
fi

URL="http://127.0.0.1:$PORT"
echo
bleu "FormyWork démarre sur $URL"
echo "  (laissez cette fenêtre ouverte ; Ctrl+C pour arrêter)"
echo
( sleep 3; if command -v open >/dev/null 2>&1; then open "$URL"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1; fi ) &
cd backend && exec "../$VPY" -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT" --log-level warning
