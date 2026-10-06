// Site vitrine BeatMind — script sans dépendance (fonctionne aussi en ouvrant index.html directement).
(function () {
  // Beates : même dessin que brand/beates.svg. Les ids sont suffixés pour pouvoir l'afficher plusieurs fois.
  var n = 0;
  function beatesSvg(mood) {
    var id = 'b' + (n++);
    var cls = mood === 'talking' ? 'bt-talking' : mood === 'happy' ? 'bt-happy' : '';
    return '<svg viewBox="0 0 120 140" class="' + cls + '" role="img" aria-label="Beates">' +
      '<defs><linearGradient id="body-' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1630"/><stop offset="1" stop-color="#121214"/></linearGradient>' +
      '<filter id="glow-' + id + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<ellipse class="bt-shadow" cx="60" cy="133" rx="24" ry="4" fill="#8b5cf6" opacity="0.3"/>' +
      '<g class="bt-float">' +
        '<g class="bt-antenna"><line x1="60" y1="24" x2="60" y2="11" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round"/><circle class="bt-tip" cx="60" cy="8" r="5" fill="#c4b5fd" filter="url(#glow-' + id + ')"/></g>' +
        '<rect x="13" y="40" width="10" height="24" rx="5" fill="#8b5cf6" filter="url(#glow-' + id + ')"/>' +
        '<rect x="97" y="40" width="10" height="24" rx="5" fill="#8b5cf6" filter="url(#glow-' + id + ')"/>' +
        '<rect x="21" y="23" width="78" height="58" rx="21" fill="url(#body-' + id + ')" stroke="#8b5cf6" stroke-width="3"/>' +
        '<rect x="31" y="34" width="58" height="35" rx="14" fill="#0a0a0a" stroke="#a78bfa" stroke-opacity="0.25"/>' +
        '<g filter="url(#glow-' + id + ')"><rect class="bt-eye" x="43" y="42" width="10" height="17" rx="5" fill="#ddd6fe"/><rect class="bt-eye" x="67" y="42" width="10" height="17" rx="5" fill="#ddd6fe"/></g>' +
        '<rect x="53" y="80" width="14" height="8" rx="3" fill="#2e2e33"/>' +
        '<rect x="36" y="87" width="48" height="33" rx="13" fill="url(#body-' + id + ')" stroke="#6d28d9" stroke-width="3"/>' +
        '<g fill="#a78bfa" filter="url(#glow-' + id + ')"><rect class="bt-bar" x="49" y="96" width="5" height="15" rx="2.5"/><rect class="bt-bar" x="57.5" y="96" width="5" height="15" rx="2.5"/><rect class="bt-bar" x="66" y="96" width="5" height="15" rx="2.5"/></g>' +
      '</g></svg>';
  }
  document.querySelectorAll('[data-beates-svg]').forEach(function (el) {
    el.innerHTML = beatesSvg(el.getAttribute('data-mood'));
  });

  // Forme d'onde du hero
  var wave = document.getElementById('hero-wave');
  if (wave) {
    var html = '';
    for (var i = 0; i < 64; i++) {
      var h = 25 + Math.abs(Math.sin(i * 0.41)) * 60 + (i % 5) * 3;
      html += '<i style="height:' + h + '%;animation-delay:' + ((i % 11) * 0.08) + 's;opacity:' + (0.4 + (i % 4) * 0.15) + '"></i>';
    }
    wave.innerHTML = html;
  }
  document.querySelectorAll('.art-beat i').forEach(function (b, i) {
    b.style.height = (30 + ((i * 37) % 65)) + '%';
    b.style.animationDelay = (i * 0.09) + 's';
  });

  // Apparition au scroll
  var targets = document.querySelectorAll('.feature, .trait, .download, .beates-stage, .section-title');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    targets.forEach(function (t) { t.classList.add('reveal'); io.observe(t); });
  }

  // Mini Beates : un conseil selon la section visible, mémorise la fermeture
  var STORE = 'bm_landing_beates';
  var TIPS = {
    top: ['Yo. Scroll un peu, je te montre ce que BeatMind sait faire.', 'Une phrase suffit pour lancer un beat. Sérieux.'],
    fonctionnalites: ['Beat AI, Voice AI, Community : de l\'idée au son publié, sans changer d\'outil.', 'Colle un lien YouTube en référence, j\'en tire le BPM et la vibe.', '15 secondes de voix parlée et ta voix est clonée. Pas besoin de chanter.'],
    beates: ['Ouais, c\'est moi. Je ne mords pas, promis.', 'Je retiens ce que t\'as déjà fait. Pas de conseil en double.'],
    telecharger: ['Extrais le zip, tape npm run dev, c\'est parti.', 'Pas de clé API ? Le mode démo marche direct.'],
  };
  var bubble = document.getElementById('mini-bubble');
  var text = document.getElementById('mini-text');
  var bot = document.getElementById('mini-bot');
  var botSvg = bot.querySelector('svg');
  var current = 'top';
  var idx = 0;
  var closed = false;
  try { closed = localStorage.getItem(STORE) === 'closed'; } catch (e) { /* stockage indisponible */ }
  if (closed) bubble.classList.add('hidden');

  function talk() {
    if (!botSvg) return;
    botSvg.classList.add('bt-talking');
    clearTimeout(talk.t);
    talk.t = setTimeout(function () { botSvg.classList.remove('bt-talking'); }, 1500);
  }
  function show(section, next) {
    var list = TIPS[section] || TIPS.top;
    if (section !== current) { current = section; idx = 0; } else if (next) idx = (idx + 1) % list.length;
    text.textContent = list[idx];
    bubble.classList.remove('hidden');
    talk();
    // Petit écran : la bulle se replie seule pour ne pas cacher la page (un tap sur Beates la rouvre)
    clearTimeout(show.t);
    if (window.innerWidth < 640) show.t = setTimeout(function () { bubble.classList.add('hidden'); }, 7000);
  }
  function setClosed(v) {
    closed = v;
    bubble.classList.toggle('hidden', v);
    try { localStorage.setItem(STORE, v ? 'closed' : 'open'); } catch (e) { /* ignore */ }
  }

  document.getElementById('mini-close').addEventListener('click', function () { setClosed(true); });
  document.getElementById('mini-next').addEventListener('click', function () { show(current, true); });
  bot.addEventListener('click', function () {
    if (closed) { setClosed(false); show(current, false); } else if (bubble.classList.contains('hidden')) show(current, false); else show(current, true);
  });

  if ('IntersectionObserver' in window) {
    var sections = ['fonctionnalites', 'beates', 'telecharger'].map(function (id) { return document.getElementById(id); });
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting && !closed) show(e.target.id, false); });
    }, { threshold: 0.35 });
    sections.forEach(function (s) { if (s) so.observe(s); });
  }

  // Lien de téléchargement : prévient si l'archive n'a pas encore été générée
  var dl = document.getElementById('download-btn');
  if (dl && location.protocol.indexOf('http') === 0 && window.fetch) {
    fetch(dl.getAttribute('href'), { method: 'HEAD' }).then(function (r) {
      if (!r.ok) throw new Error();
    }).catch(function () {
      dl.removeAttribute('download');
      dl.setAttribute('href', '#telecharger');
      dl.addEventListener('click', function (ev) {
        ev.preventDefault();
        if (closed) setClosed(false);
        text.textContent = 'L\'archive n\'est pas encore générée. Lance « npm run landing » dans le dossier beatmind.';
        talk();
      });
    });
  }
})();
