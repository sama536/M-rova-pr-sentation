// BeatMind — application de bureau (Electron).
// Démarre l'API BeatMind dans le processus principal (Node est embarqué : rien à installer),
// puis ouvre le studio dans une fenêtre. Les données de l'utilisateur vivent dans son dossier AppData.
const { app, BrowserWindow, Menu, shell, dialog, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const http = require('node:http');
const { pathToFileURL } = require('node:url');

const PREFERRED_PORTS = Array.from({ length: 10 }, (_, i) => 47800 + i);
const bundle = path.join(__dirname, 'bundle');
let win = null;
let baseUrl = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
}

// Google refuse les connexions OAuth depuis un navigateur « intégré » : on retire la mention Electron.
app.userAgentFallback = app.userAgentFallback.replace(/\s?(Electron|beatmind-desktop|BeatMind)\/\S+/gi, '');

function portIsFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)));
  });
}

async function pickPort() {
  // Port fixe de préférence : l'origine (et donc les données locales du mode démo) reste la même d'un lancement à l'autre.
  for (const p of PREFERRED_PORTS) if (await portIsFree(p)) return p;
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  });
}

function waitForApi(url, timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get(`${url}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retry();
      }).on('error', retry);
    };
    const retry = () => (Date.now() - started > timeoutMs ? reject(new Error('Le serveur BeatMind ne répond pas.')) : setTimeout(tick, 150));
    tick();
  });
}

function ensureEnvFile() {
  const envFile = path.join(app.getPath('userData'), '.env');
  if (!fs.existsSync(envFile)) {
    const example = fs.readFileSync(path.join(bundle, '.env.example'), 'utf8');
    const header = '# Fichier de configuration de BeatMind (application de bureau).\n'
      + '# Remplis les clés que tu as, enregistre, puis redémarre BeatMind.\n'
      + '# Sans clé, tout fonctionne en mode démo.\n'
      + '# Supabase / Google : ajoute http://127.0.0.1:47800 aux Redirect URLs de ton projet.\n\n';
    fs.mkdirSync(path.dirname(envFile), { recursive: true });
    fs.writeFileSync(envFile, header + example.replace(/^PORT=.*$/m, '# PORT est choisi automatiquement par l\'application'));
  }
  return envFile;
}

async function startServer() {
  const port = await pickPort();
  process.env.NODE_ENV = 'production';
  process.env.PORT = String(port);
  process.env.HOST = '127.0.0.1';
  process.env.BEATMIND_DATA_DIR = app.getPath('userData');
  process.env.BEATMIND_ENV_FILE = ensureEnvFile();
  await import(pathToFileURL(path.join(bundle, 'server', 'src', 'index.js')).href);
  baseUrl = `http://127.0.0.1:${port}`;
  await waitForApi(baseUrl);
  return baseUrl;
}

function isInternal(url) {
  return baseUrl && url.startsWith(baseUrl);
}

function buildMenu() {
  const envFile = path.join(app.getPath('userData'), '.env');
  const template = [
    {
      label: 'BeatMind',
      submenu: [
        {
          label: 'Clés API (Claude, ElevenLabs, Suno)…',
          accelerator: 'CmdOrCtrl+,',
          click: () => win?.webContents.executeJavaScript("window.dispatchEvent(new Event('beatmind:open-keys'))"),
        },
        { label: 'Ouvrir le fichier de configuration (.env)', click: () => shell.openPath(envFile) },
        { label: 'Ouvrir le dossier des données', click: () => shell.openPath(app.getPath('userData')) },
        { type: 'separator' },
        { label: 'Redémarrer BeatMind', click: () => { app.relaunch(); app.exit(0); } },
        { role: 'quit', label: 'Quitter' },
      ],
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' }, { role: 'redo', label: 'Rétablir' }, { type: 'separator' },
        { role: 'cut', label: 'Couper' }, { role: 'copy', label: 'Copier' }, { role: 'paste', label: 'Coller' },
        { role: 'selectAll', label: 'Tout sélectionner' },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { role: 'togglefullscreen', label: 'Plein écran' },
        { role: 'resetZoom', label: 'Taille réelle' }, { role: 'zoomIn', label: 'Zoom avant' }, { role: 'zoomOut', label: 'Zoom arrière' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Outils de développement' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'BeatMind',
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    icon: path.join(bundle, 'brand', 'logo.png'),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
  });
  win.once('ready-to-show', () => win.show());

  // Liens externes (Creative Commons, nodejs.org…) dans le navigateur par défaut
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isInternal(url) && /^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  await win.loadFile(path.join(__dirname, 'splash.html'));
  try {
    const url = await startServer();
    await win.loadURL(`${url}/beat`);
  } catch (err) {
    dialog.showErrorBox('BeatMind n\'a pas pu démarrer', `${err.message}\n\nRelance l'application. Si le problème continue, supprime le fichier .env dans le dossier des données.`);
    app.quit();
  }
}

app.whenReady().then(() => {
  // Micro (clonage de voix), presse-papiers, plein écran : uniquement pour le studio local
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    const allowed = ['media', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen'];
    callback(isInternal(wc.getURL()) && allowed.includes(permission));
  });
  buildMenu();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
