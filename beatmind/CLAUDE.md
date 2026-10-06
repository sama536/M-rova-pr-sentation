# BeatMind — mémo de reprise (à lire en début de session)

Studio de création musicale assisté par IA, en français. Ce fichier résume **tout ce qui existe** et
**pourquoi**, pour reprendre le travail sans re-découvrir le projet.

- **Dépôt** : `sama536/M-rova-pr-sentation`, branche `claude/beatmind-ai-music-studio-j00hzl`.
  Le dépôt contenait déjà le site Mérova (racine, non lié) ; BeatMind vit entièrement dans `beatmind/`.
  À la racine, seul `package.json` a reçu un script `dev` qui délègue à `beatmind/`.
- **Langue** : toute l'UI, les commentaires et les commits sont en français.
- **Utilisateur** : sur Windows, débutant côté outillage → privilégier les solutions « double-clic ».

## Démarrer

```bash
cd beatmind
npm run dev        # API :8787 + front Vite :5173 (vérifie Node ≥ 18.17 et lance npm install si besoin)
npm run landing    # site vitrine sur :4173 (+ génère landing/downloads/beatmind.zip)
npm run pack       # génère seulement le zip du projet
npm run build      # build du front (client/dist)
npm start          # prod : Express sert API + front sur :8787
npm run desktop    # app Electron en local
npm run desktop:win  # construit desktop/dist/beatmind-setup.exe
```

Sans aucune clé, **tout marche en mode démo** (voir plus bas). Les clés vont dans `beatmind/.env`
(modèle : `.env.example`).

## Stack

- **Front** : React 18 + Vite 5 + Tailwind 3, zustand (état), react-router 6, lucide-react, fflate (zip),
  @breezystack/lamejs (MP3). Alias `@shared` → `shared/`, `@brand` → `brand/`.
- **API** : Node + Express (ESM), multer, dotenv, `@anthropic-ai/sdk`, `@supabase/supabase-js`.
- **Données** : Supabase (auth email + Google, Postgres, Storage) ou mode démo local.
- **IA** : Claude (`claude-opus-5-5`, `fallbacks: "default"`, effort low/medium, sortie JSON parsée puis
  normalisée), Suno non officiel (format gcui-art/suno-api), ElevenLabs (clonage + TTS), YouTube Data API v3.
- **Desktop** : Electron 44 + electron-builder 26 (NSIS).

## Arborescence

```
beatmind/
├── package.json          workspaces client + server ; scripts dev/landing/pack/desktop…
├── .env.example          toutes les clés (toutes optionnelles)
├── CLAUDE.md             ce fichier
├── README.md             doc utilisateur (installation, Supabase, dépannage)
├── shared/               catalogue + générateurs, partagés client/serveur (ESM, "type": "module")
│   ├── catalog.js        15 styles, 12 instruments, 10 presets vocaux, 6 débits, backs par genre, coûts crédits, CC0
│   ├── styleProfiles.js  fiche de production par style (BPM, batterie, basse, accords, gammes, signature, à éviter, artistes) + alias d'instruments + indices d'artistes
│   └── generators.js     générateurs déterministes (beat, paroles, analyse de référence) + normalisation des réponses Claude
├── server/src/
│   ├── index.js          Express ; en prod sert client/dist et injecte window.__BEATMIND_CONFIG__ (Supabase, desktop)
│   ├── config.js         .env racine, server/.env, puis BEATMIND_ENV_FILE (desktop) ; détection des services
│   ├── lib/              supabase (JWT / x-demo-user), credits (RPC spend_credits + refund), storage (Supabase ou disque)
│   ├── services/         claude, suno, elevenlabs, youtube (oEmbed sans clé)
│   └── routes/           /api/beat (generate, suno/:ids, proxy), /youtube/analyze, /lyrics/generate, /voice (clone, synthesize), /credits,
│                         /settings/keys (GET état masqué, PUT enregistre dans le .env + rechargement à chaud)
├── client/src/
│   ├── audio/            arranger (notes), instruments (synthèse Web Audio), renderer (OfflineAudioContext),
│   │                     vocalfx (pitch WSOLA, autotune, harmonies, backs), exporter (WAV/MP3/zip), player, usePlayer
│   ├── components/       ui/, beat/, voice/, studio/, community/, beates/, Layout, TransportBar
│   ├── lib/              auth, api, db (Supabase OU localStorage+IndexedDB), idb, vocals, useSave, format
│   ├── store/            project (projet en cours, persisté), credits, beates (mémoire de l'assistant)
│   └── pages/            Home, Login, BeatAI, VoiceAI, Studio, Library, Community, Producer, Profile
├── supabase/schema.sql   8 tables + credit_events, RLS, triggers, RPC, vue producer_stats, buckets
├── brand/                logo B (SVG/PNG/ICO source), Beates (SVG/PNG/CSS)
├── landing/              site vitrine statique (index.html, styles.css, main.js, assets/)
├── scripts/              preflight.mjs (avant dev), pack.mjs (zip), landing.mjs (serveur du site)
└── desktop/              app Electron (main.cjs, splash.html, scripts/stage.mjs, build/ icônes + installer.nsh)
```

## Fonctionnalités livrées

### Beat AI (`/beat`)
Prompt + exemples, liens YouTube (analyse BPM / flow / vibe / structure / mood, source affichée),
15 styles combinables, 12 instruments + instruments libres (timbre deviné par `guessInstrumentRole`).
Claude renvoie BPM, tonalité, gamme, swing, rythme, progression (degrés 0–6), structure (sections, mesures,
énergie), pistes + FX, notes de mix/prod, prompt Suno. **Tout est éditable** (`BeatParamsEditor`) ;
changer tonalité/gamme/progression/structure réarrange les pistes non éditées à la main.
Suno : génération asynchrone, polling 5 s, piste « Beat IA (Suno) » ajoutée (les pistes synthé sont alors coupées).

### Fidélité au style et aux références (refonte)
- `shared/styleProfiles.js` est la source de vérité par style. Claude reçoit pour chaque style choisi une fiche
  chiffrée (plage de BPM, `drums.pattern` imposé, `arrangement.bass` / `arrangement.chords`, gammes, signature,
  « à éviter », artistes) ; `normalizeBeatParams` **force** ces contraintes (BPM ramené dans la plage, motif de
  batterie inconnu → celui du style ; avant, tout motif inconnu retombait sur « trap »).
- Fusion de styles (`blendStyles`) : le 1er style donne le groove, plages de BPM croisées.
- Références : les liens collés sont analysés automatiquement à la génération (avant, ceux non « analysés »
  étaient ignorés). Analyse Claude : identification artiste/morceau, BPM/tonalité connus, `drumPattern`,
  instruments, traits de production. Sans Claude : `ARTIST_HINTS`. `referenceTarget` combine les références
  (fiabilité ≥ 0,45 seulement) ; curseur « Influence des références » (`referenceWeight`) ; le résultat affiche
  « Repris de tes références » (`params.referenceNotes`). Sans style choisi, le style vient des références.
  Instruments repris seulement s'ils sont compatibles avec le style (pas de 808 dans un jazz).
- Arrangeur : basse et accords selon `params.arrangement` (walking, offbeat, 808glide avec slides, log drum,
  dembow, reese / comp, stabs, pluck, arp, halfbar).

### Moteur audio (navigateur)
- `arranger.js` : grille 16 pas/mesure, motifs de batterie par style (trap, drill, four, boombap, swing, afro,
  dembow, rnb, phonk, hyperpop, amapiano, rage), 808/basse sur les kicks, accords, pads, arpèges, mélodie
  (tessiture ~C5–C6). Pistes actives selon le type/énergie de section.
- `instruments.js` : piano, keys, cordes, violon, pad, chœur, synthé, cuivres, sax, flûte, guitare, cloche,
  basse, 808, batterie (kick, snare, clap, hats, shaker, rim, cowbell, log drum) — 100 % synthèse, aucun sample.
- `renderer.js` : rendu OfflineAudioContext, chaîne par piste (volume → distorsion → compresseur → pan →
  envois reverb/delay), limiteur master. **Les notes sont créées au fil du rendu (`ctx.suspend` par fenêtres
  d'1 s)** : sans ça, 95 s de morceau prenaient 25 s à rendre (4,6 s après).
- `vocalfx.js` : pitch à durée constante (rééchantillonnage + WSOLA — une 1re version par grains donnait
  des hauteurs fausses), autotune (autocorrélation décimée + correction vers la gamme), harmonies (tierce
  selon la gamme, quinte, octave), backs par genre, timbre, normalisation.
- Export : MP3 192k, WAV 16 bits, stems (ZIP de WAV), voix seule, beat seul.

### Voice AI (`/voice`)
Enregistrement 15 s (vu-mètre, texte à lire) → clonage ElevenLabs (sans clé : voix enregistrée localement,
prévisualisation via `speechSynthesis`). Jusqu'à 3 voix (feat), 10 presets, réglages fins (pitch ±12,
autotune, saturation, reverb, harmonies 0–3, énergie, timbre, backs). Paroles : saisie, collage (placé par
Claude ou réparti sans IA), génération par thème/style. **Timeline vocale** : par section, débit (6 modes),
voix actives, réglages propres, compteur syllabes/mesure vs cible, punchlines surlignées, génération et
écoute des prises (placées sur la timeline du studio comme pistes audio `vox_1..3`).

### Studio (`/studio`)
Mode simple (prompt de variation, lecteur + forme d'onde, réglages essentiels, volumes) et mode avancé
(timeline multipistes, mixer faders/pan/M/S + master, piano roll : clic ajoute/supprime, glisser déplace,
effets par piste, son, octave, ajout de pistes). Panneau d'export + « Publier sur Community ».

### Clés API (bouton « ⚙️ Clés API »)
En haut de la barre latérale (et dans l'en-tête mobile, et le menu de l'app de bureau) : modal pour Claude,
ElevenLabs, Suno (adresse de l'API au format gcui-art + clé optionnelle) et YouTube. Enregistre dans le `.env`
(`ENV_FILE` : `%APPDATA%\BeatMind\.env` en desktop, `beatmind/.env` en dev) et recharge la config à chaud
(`loadConfig()` mute `config`/`services` en place ; client Anthropic recréé si la clé change).
Sécurité : modification seulement depuis la machine elle-même (loopback) ET en dev ou desktop ; jamais de clé
renvoyée en clair. Erreurs Claude/Suno traduites en messages clairs (`friendlyError`).
Les fournisseurs Suno « à clé seule » (ex. sunoapi.org) ne sont pas gérés : leur doc était inaccessible.

### Comptes, bibliothèque, crédits, Community
Auth email + Google (Supabase) ou comptes locaux (démo). Profil (nom, username, bio, avatar).
Bibliothèque avec **historique des versions** (chaque sauvegarde = version restaurable, 30 max).
Crédits : 100 à l'inscription ; beat 5, analyse 1, paroles 2, clonage 10, prise vocale 3 ; débit atomique
côté serveur (`spend_credits`), remboursement en cas d'échec ; en démo, solde dans localStorage.
Community : CC0 imposé par trigger SQL, filtres style/BPM/tonalité/mood/instruments, tris, lecteur inline,
téléchargement, like/save (table `likes` avec `kind`), commentaires, profil producteur public + stats.
En démo, 8 prods d'exemple rendues à la volée depuis leurs paramètres.

### Beates (assistant)
Robot violet néon (`components/beates/BeatesBot.jsx`, même dessin que `brand/beates.svg`, animations
`brand/beates.css` : flotte, cligne, antenne, égaliseur quand il parle, yeux plissés quand content).
- Tutoriel auto pour un nouveau compte connecté : bienvenue → beat → voix → publication → fin.
  Étapes ciblées par `data-beates="generate" | "add-voice" | "publish"` + anneau néon (`Spotlight`) ;
  validation automatique via `beatesTrack(event)` / abonnement au store projet ; « Y aller », « Passer l'étape », « Skip le tuto ».
- Conseils par page (`script.js` → `TIPS`), filtrés par `when(done)` et jamais répétés (`seen`).
- Mémoire par utilisateur dans `localStorage` (`bm_beates_<uid>`) : mode (open/min/closed), tutoriel, done, seen.
- Réduire / fermer / « Rappeler Beates » (menu latéral). Ton : chill et direct.

### Site vitrine (`landing/`)
Statique, sans build : hero (« Ta prod. Ta voix. En une idée. »), cartes Beat AI / Voice AI / Community,
section Beates (grand Beates + bulles + 3 humeurs), téléchargement (zip + 4 étapes), mini-Beates fixe avec
bulle de conseil selon la section visible (fermeture mémorisée, repli auto sur mobile). Non déployé.

### Logo (`brand/`)
B néon (dégradé violet, halo) avec une onde sonore dans la boucle basse, fond noir arrondi.
`logo.svg` + PNG 1024/512/192, `logo-mark.*` transparent, `desktop/build/icon.ico`.
⚠️ Le dégradé est en `gradientUnits="userSpaceOnUse"` : en `objectBoundingBox`, le fût vertical
(largeur nulle) disparaissait et le B se lisait « 3 ».

### App de bureau Windows (`desktop/`)
- `main.cjs` : choisit un port libre (47800–47809, fixe de préférence pour garder la même origine et donc
  les données locales), crée `%APPDATA%\BeatMind\.env` depuis `.env.example`, positionne
  `BEATMIND_DATA_DIR` / `BEATMIND_ENV_FILE` / `HOST=127.0.0.1` / `NODE_ENV=production`, importe l'API
  dans le processus principal, attend `/api/health`, puis charge `http://127.0.0.1:<port>/beat`
  (écran de chargement `splash.html` avant). Instance unique, liens externes dans le navigateur, permissions
  limitées (micro, presse-papiers, plein écran), user-agent sans « Electron » (OAuth Google).
  Menu : Configurer les clés API… / Ouvrir le dossier des données / Redémarrer / Édition / Affichage.
- `scripts/stage.mjs` : build du front puis copie dans `desktop/bundle/` (server/src + server/package.json,
  shared, client/dist, logo, .env.example) en conservant l'arborescence ; vérifie que les dépendances de
  l'API sont identiques dans `desktop/package.json`.
- Build : `npm run dist:win` → `desktop/dist/beatmind-setup.exe` (NSIS one-click, par utilisateur, sans
  droits admin, raccourcis Bureau + Menu Démarrer avec l'icône BeatMind, lancement en fin d'install).
  Depuis Linux il faut **wine64 + wine32:i386** (désinstallateur NSIS 32 bits, rcedit pour l'icône de l'exe).
- CI : `.github/workflows/beatmind-windows.yml` (racine du dépôt) construit l'installeur sur
  `windows-latest`, lance l'app et vérifie `/api/health` + la page, teste l'installation silencieuse,
  publie `beatmind-setup.exe` en artefact.
- Non signé → avertissement SmartScreen au 1er lancement (« Informations complémentaires → Exécuter quand même »).

## Mode démo (aucune clé)

| Service | Repli |
| --- | --- |
| Supabase | comptes, projets, versions, voix, Community, likes, commentaires : localStorage (`bm_db_v1`) + IndexedDB (audio, URLs `idb:clé`) |
| Claude | `shared/generators.js` (déterministe) ; si Claude échoue → repli local + crédits remboursés |
| Suno | moteur de synthèse intégré |
| ElevenLabs | voix enregistrée, prévisualisation `speechSynthesis` |
| YouTube | oEmbed + heuristique (BPM/tonalité/style dans le titre et les tags) |

## Décisions et pièges connus

- Les modales passent par un **portail** (`createPortal` → `body`) : dans un panneau `backdrop-blur`, leur
  `z-index` était confiné et Beates / la barre de lecture passaient dessus (bouton « Publier » inaccessible).
- Notifications en **haut à droite** (Beates occupe le bas droit).
- `.grid > * { min-width: 0 }` global : évite les débordements horizontaux sur mobile.
- Serveur de dev : `node --watch` (pas `--watch-path`, qui plante sous Node 18/Linux).
- `predev` (`scripts/preflight.mjs`) : version de Node + `npm install` automatique.
- Proxy Vite → `PORT` du `.env`. En prod, la config Supabase est injectée à l'exécution (pas besoin de rebuild).
- Échantillons de voix : bucket privé `voice-samples` ; audio publié : bucket public `audio`.
- Compteurs Community non modifiables par les clients (`revoke update` + `grant update (colonnes)`).

## Vérification (comment c'a été testé)

Playwright (Chromium dans `/opt/pw-browsers`, `PLAYWRIGHT_BROWSERS_PATH` déjà configuré) piloté par des
scripts Node jetables : inscription démo → génération → paroles → studio avancé → export MP3/stems →
sauvegarde → publication → Community/Bibliothèque/Profil ; tutoriel Beates complet + mémoire ;
débordements mobile (390 px) ; site vitrine ; app Electron lancée sous `xvfb-run` (dev et empaquetée
Linux). Aucune erreur console sur ces parcours. **Non testé** avec de vraies clés (Claude, Suno,
ElevenLabs, YouTube, Supabase) ni sur un vrai Windows hors CI.

## Pistes pour la suite

- Signer l'installeur (certificat de signature de code) pour supprimer l'avertissement SmartScreen.
- Mise à jour automatique (electron-updater + `publish` GitHub Releases).
- Tester avec de vraies clés API et un projet Supabase réel.
- Découper le bundle front (≈ 545 Ko) avec des imports dynamiques par page.
