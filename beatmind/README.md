# BeatMind — studio de création musicale assisté par IA

Écris ce que tu entends dans ta tête : BeatMind génère le beat, clone ta voix, écrit et place les paroles
section par section, puis t'ouvre un studio (mixer, piano roll, effets) pour tout retoucher et exporter.

**Stack** : React + Vite + Tailwind (front) · Node.js + Express (API) · Supabase (auth, base, stockage)
· Claude · Suno (API non officielle) · ElevenLabs · YouTube Data API v3.

---

## Démarrage en 30 secondes (mode démo, zéro configuration)

Prérequis : **Node.js 18.17+** (20 ou 22 recommandé).

```bash
cd beatmind
npm run dev
```

Ouvre **http://localhost:5173**. C'est tout : au premier lancement, `npm run dev` vérifie ta version de Node
et lance `npm install` tout seul si les dépendances manquent. Ça marche aussi depuis la racine du dépôt
(`npm run dev` y délègue à `beatmind/`).

### En cas de problème au démarrage

| Message | Cause | Solution |
| --- | --- | --- |
| `Missing script: "dev"` | Lancé depuis un autre dossier que la racine du dépôt ou `beatmind/` | `cd beatmind` puis `npm run dev` |
| `concurrently: not found` / `vite: not found` | Dépendances non installées (ancienne version) | `npm install` dans `beatmind/` |
| `ERR_FEATURE_UNAVAILABLE_ON_PLATFORM … watch recursively` | Ancienne version du script avec Node 18 sous Linux | Corrigé : mets à jour le dépôt (`git pull`) |
| `BeatMind nécessite Node.js 18.17…` | Node trop ancien | Installe Node LTS depuis nodejs.org |
| `Le port 8787 est déjà utilisé` | Une autre instance tourne | Ferme-la, ou mets `PORT=8788` dans `.env` |

Sans aucune clé, l'app tourne en **mode démo complet** :

| Service absent | Ce qui se passe |
| --- | --- |
| Supabase | Comptes, projets, versions, voix, Community, likes et commentaires sont stockés dans le navigateur (localStorage + IndexedDB). 8 prods d'exemple sont pré-chargées dans Community. |
| Claude | Les paramètres de prod, paroles et analyses sont produits par un générateur musical local déterministe (`shared/generators.js`). |
| Suno | Le beat est rendu par le moteur audio BeatMind (synthèse Web Audio, aucun sample). |
| ElevenLabs | Ton enregistrement est sauvegardé ; la prévisualisation des paroles utilise la voix de synthèse du navigateur. |
| YouTube | Titre et chaîne via oEmbed public, analyse heuristique (BPM / style / mood détectés dans le titre et les tags). |

Au lancement, le terminal affiche l'état de chaque service (● actif, ○ démo).

---

## Configuration complète

```bash
cp .env.example .env   # puis remplis les clés que tu as
npm run dev
```

Chaque clé ajoutée active le service correspondant, indépendamment des autres.

### 1. Supabase

1. Crée un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor** → colle le contenu de [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   Le script est idempotent (relançable) et crée :
   - les tables `users`, `projects`, `project_versions`, `community_beats`, `likes`, `comments`, `credits`, `voice_profiles` (+ journal `credit_events`) ;
   - les politiques RLS (projets et voix privés, Community en lecture publique) ;
   - les triggers : profil + **100 crédits** créés à l'inscription, compteurs de likes/saves/commentaires, licence **CC0 forcée** sur chaque post ;
   - les fonctions `spend_credits` / `add_credits` (réservées au serveur) et `increment_beat_stat` ;
   - la vue `producer_stats` (prods, téléchargements, likes, écoutes) ;
   - les buckets de stockage `audio` (public) et `voice-samples` (privé).
3. **Project Settings → API** : copie `Project URL` → `VITE_SUPABASE_URL`, `anon public` → `VITE_SUPABASE_ANON_KEY`,
   `service_role` → `SUPABASE_SERVICE_ROLE_KEY`.
4. **Authentication → URL Configuration** : ajoute `http://localhost:5173` aux *Redirect URLs*.
5. **Connexion Google** : *Authentication → Providers → Google* → active-le avec un Client ID / Secret OAuth
   Google (console Google Cloud, type « Application Web », URI de redirection autorisée :
   `https://<ton-projet>.supabase.co/auth/v1/callback`).

### 2. Claude

`ANTHROPIC_API_KEY` depuis la [console Anthropic](https://console.anthropic.com/settings/keys).
Modèle par défaut : `claude-opus-5-5` (modifiable via `CLAUDE_MODEL`). Claude génère : BPM, tonalité,
gamme, progression d'accords, structure, pistes, effets, conseils de mix, prompt Suno, paroles placées
selon le débit de chaque section, et l'analyse des références YouTube. En cas d'erreur, l'API bascule
automatiquement sur le générateur local et rembourse les crédits.

### 3. Suno (non officiel)

Suno n'a pas d'API publique. BeatMind parle au format de [gcui-art/suno-api](https://github.com/gcui-art/suno-api)
(`POST /api/custom_generate`, `GET /api/get`). Lance cette API avec ton cookie Suno, puis :

```
SUNO_API_URL=http://localhost:3000
```

L'audio Suno arrive en 1–3 minutes ; BeatMind interroge le statut toutes les 5 s, ajoute la piste
« Beat IA (Suno) » au studio et coupe les pistes synthétisées (réactivables pour superposer).
⚠️ Usage soumis aux conditions de Suno : à toi de vérifier que ton utilisation est autorisée.

### 4. ElevenLabs

`ELEVENLABS_API_KEY` ([réglages ElevenLabs](https://elevenlabs.io/app/settings/api-keys)).
- **Clonage** : 15 s de voix parlée → *Instant Voice Cloning* (`/v1/voices/add`).
- **Synthèse** : chaque section est générée avec ta voix clonée (`/v1/text-to-speech`), avec une vitesse adaptée
  au débit choisi et des `voice_settings` dérivés de l'énergie et de l'autotune.
- Le plan gratuit limite le nombre de voix clonées et de caractères par mois.

### 5. YouTube Data API v3

`YOUTUBE_API_KEY` : Google Cloud Console → active *YouTube Data API v3* → *Credentials → API key*.
Gratuit (quota 10 000 unités/jour, 1 unité par analyse).
Note : l'API ne donne pas accès à l'audio. BPM, flow, vibe, structure et mood sont **déduits** par Claude
à partir des métadonnées (titre, tags, description, durée) et de sa connaissance des artistes — c'est une
estimation, affichée avec sa source.

---

## Fonctionnalités

### Beat AI (`/beat`)
Prompt libre · références YouTube multiples analysées · 15 styles combinables · 12 instruments + instruments
libres · génération des paramètres complets par Claude · audio Suno · tout est éditable ensuite (titre, BPM,
tonalité, gamme, swing, rythme, rolls, densité, progression d'accords, structure, énergie par section).

### Voice AI (`/voice`)
- Enregistrement 15 s avec vu-mètre et texte à lire → clonage ElevenLabs.
- Jusqu'à **3 voix** (feat), chacune avec ses réglages : 10 presets (Grave saturé, Mélodique aigu, Drill froid,
  Cloud doux, Autotune maximal, Jazz chaud, Afro melodic, Phonk dark, House chœurs, Vocoder), pitch ±12,
  autotune 0–100, saturation, reverb, harmonies (0–3), énergie, timbre, backs automatiques.
- Backs adaptés au genre : trap (courts saturés), house (chœurs larges), jazz (contre-chant doux),
  afro (call & response), drill (graves secs), phonk, cloud, boom bap.
- Paroles : écrites à la main, collées (placées par Claude ou réparties sans IA) ou générées par thème/style.
- **Timeline vocale** : par section, débit (chanté lent/rapide, rap posé/rapide/ultra rapide, spoken word),
  voix qui chantent, réglages propres, densité syllabique vs cible, punchlines surlignées, génération des prises.

Le traitement vocal tourne dans le navigateur (`client/src/audio/vocalfx.js`) : pitch shift à durée constante
(rééchantillonnage + WSOLA), autotune (détection de hauteur par autocorrélation + correction vers la gamme
du morceau, vitesse de correction liée au réglage), harmonies empilées dans la gamme, backs par genre, timbre.

### Studio (`/studio`)
- **Mode simple** : prompt de variation, lecteur avec forme d'onde, réglages essentiels, volumes.
- **Mode avancé** : timeline multi-pistes avec règle des sections, mixer (faders, pan, mute, solo, master
  avec limiteur), piano roll (ajout / suppression / déplacement de notes), effets par piste (reverb, delay,
  distortion, compressor), choix du son, octave, ajout de pistes.
- **Export** : MP3 192 kbps, WAV 16 bits, stems (ZIP de WAV par piste), voix seule, beat seul.
- Publication sur Community.

### Comptes, bibliothèque, crédits
Auth email + Google · profil (nom d'artiste, username, bio, avatar) · bibliothèque de projets avec
**historique des versions** (chaque sauvegarde = une version restaurable) · crédits débités côté serveur
de façon atomique et remboursés en cas d'échec.

| Action | Crédits |
| --- | --- |
| Générer un beat | 5 |
| Analyser des références | 1 |
| Écrire / placer des paroles | 2 |
| Cloner une voix | 10 |
| Générer une prise vocale | 3 |

### Beates, l'assistant
Petit robot violet néon animé (repos, parle, content) qui vit en bas à droite de l'app.
- **Tutoriel interactif** pour les nouveaux comptes : premier beat → première voix → publication sur Community.
  Il indique la page où aller et entoure d'un anneau néon le bouton à cliquer ; chaque étape se valide toute
  seule quand l'action est faite.
- **Conseils selon la page** (Beat AI, Voice AI, Studio, Community, Bibliothèque, Profil), uniquement s'ils sont
  utiles vu ce que tu as déjà fait.
- **Mémoire** par utilisateur (`localStorage`) : actions déjà faites et conseils déjà lus — il ne se répète pas.
- **Skip** du tuto, **réduire** (petit robot) ou **fermer** à tout moment ; « Rappeler Beates » dans le menu.
- Code : `client/src/components/beates/` (textes dans `script.js`), mémoire dans `client/src/store/beates.js`.

### Community (`/community`)
Prods publiques sous **Creative Commons CC0** (licence imposée par la base) · filtres style, BPM, tonalité,
mood, instruments · tri récents / populaires / téléchargés / écoutés · lecteur inline · téléchargement
gratuit · like, sauvegarde, commentaires · profil producteur public avec statistiques.

---

## Site vitrine (`landing/`)

Site statique (HTML / CSS / JS, sans build) : hero, Beat AI / Voice AI / Community, présentation de Beates,
bouton de téléchargement, et Beates en version réduite avec une bulle de conseil qui suit la section affichée.

```bash
npm run landing   # → http://localhost:4173
```

Cette commande synchronise le logo et Beates depuis `brand/`, génère `landing/downloads/beatmind.zip`
(le projet complet, sans `node_modules`, builds ni `.env`) puis sert le site en local. Le site n'est pas déployé.
`npm run pack` génère seulement le zip. On peut aussi ouvrir `landing/index.html` directement
(le bouton de téléchargement nécessite alors d'avoir lancé `npm run pack` une fois).

## Identité visuelle (`brand/`)

| Fichier | Usage |
| --- | --- |
| `logo.svg`, `logo.png` (1024 px), `logo-512.png`, `logo-192.png` | Logo B néon sur fond noir (favicon, app, site) |
| `logo-mark.svg`, `logo-mark.png` | Le B seul, fond transparent |
| `beates.svg`, `beates.png`, `beates.css` | Beates et ses animations (partagées app + site) |

## Structure

```
beatmind/
├── package.json            # workspaces + `npm run dev` (API + front en parallèle)
├── .env.example
├── shared/                 # catalogue musical + générateurs, partagés client/serveur
├── supabase/schema.sql     # schéma complet, RLS, triggers, buckets
├── brand/                  # logo B (SVG + PNG) et Beates
├── landing/                # site vitrine statique
├── scripts/                # vérif. avant démarrage, zip, serveur du site
├── server/src/
│   ├── index.js            # Express
│   ├── config.js           # lecture du .env, détection des services
│   ├── lib/                # supabase (auth JWT), crédits, stockage
│   ├── services/           # claude, suno, elevenlabs, youtube
│   └── routes/             # /api/beat, /youtube, /lyrics, /voice, /credits
└── client/src/
    ├── audio/              # arrangeur, synthés, rendu, traitement vocal, export, lecteur
    ├── components/         # UI, beat, voice, studio, community
    ├── lib/                # auth, api, couche de données (Supabase ou locale)
    ├── store/              # projet en cours (zustand, persisté)
    └── pages/              # Home, Login, BeatAI, VoiceAI, Studio, Library, Community, Producer, Profile
```

## Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | API (port 8787, rechargement auto) + front Vite (port 5173, proxy `/api`) |
| `npm run build` | Build de production du front dans `client/dist` |
| `npm run landing` | Site vitrine sur http://localhost:4173 (+ génère le zip à télécharger) |
| `npm run pack` | Génère seulement `landing/downloads/beatmind.zip` |
| `npm start` | Serveur de production : Express sert l'API **et** le front compilé sur le port 8787 |

## Limites connues

- Le moteur audio intégré synthétise tous les instruments (pas de banque de samples) : idéal pour maquetter
  et exporter des stems, moins réaliste qu'un rendu Suno.
- L'analyse des références YouTube est une estimation à partir des métadonnées, pas une analyse du signal.
- Pitch, autotune et harmonies sont calculés dans le navigateur : la qualité est bonne sur la voix parlée/chantée
  d'ElevenLabs, mais n'égale pas un plugin pro.
- Le mode démo stocke tout dans le navigateur : vider les données du site efface comptes et projets.
