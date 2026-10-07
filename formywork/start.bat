@echo off
REM FormyWork - demarrage en une commande sous Windows : double-cliquez sur start.bat
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo === FormyWork - préparation ===
echo.

REM ------------------------------------------------------------------ Python
set "PY="
where py >nul 2>&1 && (
  py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1 && set "PY=py -3"
)
if not defined PY (
  where python >nul 2>&1 && (
    python -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1 && set "PY=python"
  )
)
if not defined PY (
  echo [ERREUR] Python 3.11 ou plus récent est introuvable.
  echo   Téléchargez Python 3.13 sur https://www.python.org/downloads/
  echo   IMPORTANT : pendant l'installation, cochez la case "Add python.exe to PATH".
  echo   Puis relancez start.bat
  goto :fin_erreur
)
for /f "delims=" %%v in ('%PY% --version 2^>^&1') do echo [OK] %%v trouvé

REM ------------------------------------------------------------------ environnement Python
if not exist ".venv\Scripts\python.exe" (
  echo Création de l'environnement Python ^(une seule fois^)...
  %PY% -m venv .venv
  if errorlevel 1 (
    echo [ERREUR] Impossible de créer l'environnement Python.
    goto :fin_erreur
  )
)
set "VPY=.venv\Scripts\python.exe"
for /f "delims=" %%h in ('certutil -hashfile backend\requirements.txt MD5 ^| findstr /v ":"') do set "REQ_HASH=%%h"
set "OLD_HASH="
if exist ".venv\formywork-req.txt" set /p OLD_HASH=<".venv\formywork-req.txt"
if not "!OLD_HASH!"=="!REQ_HASH!" (
  echo Installation des composants Python ^(2 à 5 minutes la première fois^)...
  "%VPY%" -m pip install --upgrade pip >nul 2>&1
  "%VPY%" -m pip install -r backend\requirements.txt
  if errorlevel 1 (
    echo [ERREUR] L'installation des composants Python a échoué.
    echo   Vérifiez votre connexion internet puis relancez start.bat
    echo   Avec une version très récente de Python, installez plutôt Python 3.13,
    echo   supprimez le dossier .venv puis relancez.
    goto :fin_erreur
  )
  > ".venv\formywork-req.txt" echo !REQ_HASH!
)
echo [OK] Composants Python prêts

REM ------------------------------------------------------------------ fichier .env
if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  "%VPY%" -c "import pathlib,secrets; p=pathlib.Path('.env'); p.write_text(p.read_text(encoding='utf-8').replace('SECRET_KEY=change-me','SECRET_KEY='+secrets.token_urlsafe(32)), encoding='utf-8')"
  echo [OK] Fichier .env créé ^(mode démo activé^)
)
if not exist "data" mkdir data

REM ------------------------------------------------------------------ interface (Node.js)
where node >nul 2>&1
if errorlevel 1 (
  echo [INFO] Node.js n'est pas installé : l'interface déjà compilée sera utilisée ^(c'est suffisant^).
) else (
  for /f "tokens=1 delims=." %%n in ('node -p process.versions.node') do set "NODE_MAJOR=%%n"
  if !NODE_MAJOR! LSS 18 (
    echo [INFO] Node.js trop ancien : l'interface déjà compilée sera utilisée. Mise à jour : https://nodejs.org
  ) else (
    if not exist "backend\app\static\index.html" (
      echo Préparation de l'interface...
      pushd frontend
      if not exist node_modules call npm ci --no-audit --no-fund
      call npx vite build --logLevel warn
      popd
    )
    echo [OK] Node.js trouvé
  )
)
if not exist "backend\app\static\index.html" (
  echo [ERREUR] L'interface est introuvable. Installez Node.js LTS depuis https://nodejs.org puis relancez.
  goto :fin_erreur
)

REM ------------------------------------------------------------------ lancement
set "PORT=8000"
for /f "tokens=1,* delims==" %%a in ('findstr /b "PORT=" .env') do set "PORT=%%b"
"%VPY%" -c "import socket,sys; s=socket.socket(); sys.exit(0 if s.connect_ex(('127.0.0.1', int(sys.argv[1]))) == 0 else 1)" !PORT!
if not errorlevel 1 (
  echo [ERREUR] Le port !PORT! est déjà utilisé : FormyWork est peut-être déjà ouvert.
  echo   Ouvrez http://127.0.0.1:!PORT! dans votre navigateur, ou changez PORT dans .env
  goto :fin_erreur
)

echo.
echo === FormyWork démarre sur http://127.0.0.1:!PORT! ===
echo   Laissez cette fenêtre ouverte. Fermez-la pour arrêter FormyWork.
echo.
start "" cmd /c "timeout /t 3 >nul & start http://127.0.0.1:!PORT!"
cd backend
"..\%VPY%" -m uvicorn app.main:app --host 127.0.0.1 --port !PORT! --log-level warning
goto :eof

:fin_erreur
echo.
pause
exit /b 1
