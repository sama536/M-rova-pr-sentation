// Ce que dit Beates. Ton : chill, direct, phrases courtes.

export const TUTORIAL = [
  {
    id: 'welcome',
    title: 'Yo, moi c\'est Beates.',
    text: 'Je t\'aide à sortir ton premier son. 3 étapes, 2 minutes chrono. On y va ?',
    cta: 'C\'est parti',
  },
  {
    id: 'beat',
    route: '/beat',
    target: 'generate',
    doneWhen: 'beat',
    title: 'Étape 1/3 · Ton premier beat',
    away: 'Direction Beat AI, c\'est là que tout commence.',
    text: 'Écris ton idée en une phrase, choisis un ou deux styles, puis clique sur « Générer le beat ». Le reste, je gère.',
    success: 'Propre. Ton beat tourne.',
  },
  {
    id: 'voice',
    route: '/voice',
    target: 'add-voice',
    doneWhen: 'voice',
    title: 'Étape 2/3 · Une voix sur ta prod',
    away: 'Maintenant on pose une voix. Passe sur Voice AI.',
    text: 'Ajoute une voix. Pas encore clonée ? Pas grave, la prévisualisation marche direct. Le clonage, tu le fais quand tu veux.',
    success: 'Ça prend forme.',
  },
  {
    id: 'publish',
    route: '/studio',
    target: 'publish',
    doneWhen: 'published',
    title: 'Étape 3/3 · Partage ton son',
    away: 'Dernière ligne droite : le Studio.',
    text: 'Clique sur « Publier sur Community ». Licence CC0 : les autres peuvent utiliser ta prod librement, et toi la leur.',
    success: 'Publié. Bienvenue dans la Community.',
  },
  {
    id: 'end',
    title: 'T\'as tout vu.',
    text: 'Je reste dans le coin avec des conseils selon la page. Réduis-moi ou ferme-moi quand tu veux, je ne me vexe pas.',
    cta: 'Merci Beates',
  },
];

// when(done) : le conseil n'apparaît que s'il est utile vu ce que l'utilisateur a déjà fait.
export const TIPS = {
  '/beat': [
    { id: 'beat-refs', when: (d) => !d.references, text: 'Colle 1 ou 2 liens YouTube de sons que t\'aimes. J\'en tire BPM, vibe et structure, ça cadre la génération.' },
    { id: 'beat-mix', text: 'Mélanger deux styles, ça marche bien : drill × jazz, afro × house. Teste.' },
    { id: 'beat-edit', when: (d) => d.beat, text: 'Rien n\'est figé : BPM, tonalité, structure… tout se règle sous le résultat, et le son se recalcule tout seul.' },
    { id: 'beat-save', when: (d) => d.beat && !d.saved, text: 'Pense à sauvegarder. Chaque sauvegarde = une version que tu peux restaurer.' },
  ],
  '/voice': [
    { id: 'voice-clone', when: (d) => !d.cloned, text: '15 secondes de voix parlée suffisent pour te cloner. Pas besoin de chanter, parle normal.' },
    { id: 'voice-flow', text: 'Rap rapide dans les couplets, chanté dans le refrain : c\'est là que les punchlines et les mélodies tapent le mieux.' },
    { id: 'voice-feat', when: (d) => d.voice, text: 'Tu peux empiler jusqu\'à 3 voix. Une en grave saturé, une en mélodique aigu : contraste garanti.' },
    { id: 'voice-density', when: (d) => d.lyrics, text: 'Surveille le compteur syllabes/mesure. Trop haut, le débit sature. Trop bas, ça fait des trous.' },
  ],
  '/studio': [
    { id: 'studio-advanced', when: (d) => !d.advanced, text: 'Ouvre le mode avancé : pistes, mixer, piano roll. Clic sur une note = effacée, clic sur une case vide = ajoutée.' },
    { id: 'studio-solo', when: (d) => d.advanced, text: 'Le bouton S isole une piste. Parfait pour régler un son sans le reste autour.' },
    { id: 'studio-stems', when: (d) => !d.exported, text: 'Export stems = une piste WAV par instrument. Idéal pour finir le mix dans un autre logiciel.' },
    { id: 'studio-publish', when: (d) => !d.published, text: 'Ton son est prêt ? « Publier sur Community » et il est en ligne, en CC0.' },
  ],
  '/community': [
    { id: 'com-cc0', text: 'Tout ici est en CC0 : tu télécharges, tu utilises, tu monétises. Zéro droit d\'auteur.' },
    { id: 'com-filters', text: 'Filtre par BPM et tonalité pour trouver une prod qui colle à ta voix.' },
    { id: 'com-save', text: 'Le marque-page range une prod dans « Mes sauvegardes ». Pratique pour plus tard.' },
  ],
  '/library': [
    { id: 'lib-versions', text: 'Chaque sauvegarde crée une version. « Restaurer » te ramène en arrière sans rien perdre.' },
  ],
  '/profile': [
    { id: 'prof-username', text: 'Choisis un nom d\'utilisateur : c\'est l\'adresse de ton profil producteur public.' },
  ],
};

export const IDLE = [
  'Rien à signaler. Je suis là si besoin.',
  'Tranquille. Clique-moi si tu bloques.',
  'Tout roule. Continue comme ça.',
];
