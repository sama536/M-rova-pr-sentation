/* =========================================================
   MÉROVA — motion (GSAP + ScrollTrigger + SplitText + Lenis)
   ========================================================= */
(() => {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  document.body.classList.add("is-loading");
  const params = new URLSearchParams(location.search);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || params.has("reduced");
  if (reduced) root.classList.add("reduced");

  const hasGsap = typeof window.gsap !== "undefined";
  if (!hasGsap) {
    // Mode de secours absolu : tout est visible, pas d'animation.
    document.body.classList.remove("is-loading");
    const l = $("#loader"); if (l) l.remove();
    return;
  }

  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  CustomEase.create("merova", "0.76, 0, 0.24, 1");
  gsap.defaults({ ease: "expo.out", duration: 1.1 });

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (!reduced && typeof window.Lenis !== "undefined") {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  const scrollToY = (y, immediate = false) => {
    y = Math.max(0, Math.round(y));
    if (lenis) lenis.scrollTo(y, { duration: immediate ? 0 : 1.5, immediate, easing: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2), force: true });
    else window.scrollTo({ top: y, behavior: immediate || reduced ? "auto" : "smooth" });
  };

  /* ---------- Thème (fond qui change selon la section) ---------- */
  let currentTheme = "";
  const setTheme = (bg, fg) => {
    const key = bg + fg;
    if (key === currentTheme) return;
    currentTheme = key;
    gsap.to(root, { "--bg": bg, "--fg": fg, duration: reduced ? 0 : 0.9, ease: "power2.out", overwrite: "auto" });
    const meta = $('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", bg);
  };

  const slides = $$("[data-slide]");

  // Découpe en lignes + masque qui laisse la place aux accents (É, À…)
  const maskLines = (self) => {
    self.lines.forEach((l) => {
      const w = document.createElement("span");
      w.className = "sl-mask";
      l.parentNode.insertBefore(w, l);
      w.appendChild(l);
    });
    return self.lines;
  };
  const outerOf = (el) => el.closest(".pin-spacer") || el;

  /* =========================================================
     LOADER — compteur 0 → 100 %, puis rideau
     ========================================================= */
  const loader = $("#loader");
  const loaderNum = $("#loaderNum");
  const loaderBar = $("#loaderBar");
  const counter = { v: 0 };
  const renderCount = () => {
    const v = Math.round(counter.v);
    loaderNum.textContent = v;
    loaderBar.style.transform = `scaleX(${v / 100})`;
  };

  const starStroke = $(".loader__star-stroke");
  const len = starStroke.getTotalLength();
  gsap.set(starStroke, { strokeDasharray: len, strokeDashoffset: len });
  gsap.set(".loader__word .wm-l", { y: 120 });

  const ready = Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    document.readyState === "complete" ? Promise.resolve() : new Promise((r) => window.addEventListener("load", r, { once: true })),
  ]);

  const loaderIn = gsap.timeline();
  if (reduced) {
    loaderIn.to(counter, { v: 100, duration: 0.5, ease: "none", onUpdate: renderCount });
  } else {
    loaderIn
      .to(starStroke, { strokeDashoffset: 0, duration: 1.9, ease: "merova" }, 0)
      .to(".loader__word .wm-l", { y: 0, stagger: 0.07, duration: 1.1 }, 0.35)
      // progression par paliers, comme un vrai chargement
      .to(counter, { v: 24, duration: 0.55, ease: "power3.out", onUpdate: renderCount }, 0.1)
      .to(counter, { v: 51, duration: 0.45, ease: "power3.out", onUpdate: renderCount }, "+=0.12")
      .to(counter, { v: 73, duration: 0.4, ease: "power3.out", onUpdate: renderCount }, "+=0.08")
      .to(counter, { v: 88, duration: 0.35, ease: "power3.out", onUpdate: renderCount }, "+=0.12");
  }

  Promise.all([ready, new Promise((r) => loaderIn.eventCallback("onComplete", r))]).then(() => {
    initSite();
    const done = () => {
      loader.remove();
      document.body.classList.remove("is-loading");
      if (lenis) lenis.start();
      ScrollTrigger.refresh();
    };
    const out = gsap.timeline();
    if (reduced) {
      out.to(loader, { autoAlpha: 0, duration: 0.3 }).call(done);
      introHero(out, 0);
      return;
    }
    out
      .to(counter, { v: 100, duration: 0.4, ease: "power2.inOut", onUpdate: renderCount })
      .to(".loader__star-fill", { opacity: 1, duration: 0.4, ease: "power2.out" }, "-=0.2")
      .to(".loader__count", { yPercent: -110, duration: 0.7, ease: "expo.in" }, "+=0.05")
      .to(".loader__word .wm-l", { y: -120, stagger: 0.04, duration: 0.6, ease: "expo.in" }, "<")
      .to(".loader__star", { scale: 0.2, rotate: 90, autoAlpha: 0, duration: 0.7, ease: "expo.in" }, "<")
      .to(".loader__meta", { autoAlpha: 0, duration: 0.4 }, "<")
      .addLabel("curtain", "-=0.2")
      .to(loader, { clipPath: "inset(0% 0% 100% 0%)", duration: 1.1, ease: "merova" }, "curtain")
      .call(done, null, "curtain+=1.1");
    introHero(out, "curtain+=0.4");
  });

  /* =========================================================
     HERO
     ========================================================= */
  // tracé d'un contour SVG (le monogramme se dessine)
  const prepDraw = (el) => { const l = el.getTotalLength(); gsap.set(el, { strokeDasharray: l, strokeDashoffset: l }); return l; };
  const heroLetters = $$("[data-hero-word] .wm-l");
  let heroTitleSplit;
  function introHero(tl, at) {
    if (reduced) {
      tl.to("#hud", { opacity: 1, duration: 0.3 }, at);
      return;
    }
    prepDraw($(".hero__star-line"));
    prepDraw($(".hero__mono-line"));
    gsap.set(".hero__mono-fill", { opacity: 0 });
    heroTitleSplit = SplitText.create(".hero__title", { type: "lines", linesClass: "sl" });
    maskLines(heroTitleSplit);
    tl.to(".hero__star-line", { strokeDashoffset: 0, duration: 2.6, ease: "merova" }, at)
      .from(heroLetters, { y: 120, duration: 1.4, stagger: 0.08, ease: "expo.out" }, "<0.1")
      .from(".hero__visual", { y: "30vh", rotate: -45, scale: 0.6, duration: 1.9, ease: "expo.out" }, "<0.15")
      .to(".hero__mono-line", { strokeDashoffset: 0, duration: 1.6, ease: "merova" }, "<")
      .to(".hero__mono-fill", { opacity: 1, duration: 0.9, ease: "power2.out" }, "<1.1")
      .from(heroTitleSplit.lines, { yPercent: 110, stagger: 0.1, duration: 1.2 }, "<0.4")
      .from([".hero__copy .eyebrow", ".hero__sub", ".hero__corner span", ".hero__scroll"], { y: 24, autoAlpha: 0, stagger: 0.06, duration: 1 }, "<0.1")
      .from(".nav", { yPercent: -100, autoAlpha: 0, duration: 1 }, "<")
      .to("#hud", { opacity: 1, duration: 0.8 }, "<0.3");
  }

  function initHeroScroll() {
    if (reduced) return;
    const product = $("#heroProduct");
    // flottement permanent
    gsap.to(product, { y: -14, duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
    gsap.to(".hero__star-line", { rotate: 360, svgOrigin: "158 185", duration: 90, ease: "none", repeat: -1 });
    // parallaxe au scroll
    gsap.timeline({ scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: 0.8 } })
      .to(heroLetters, { x: (i) => (i - 2.5) * 70, ease: "none" }, 0)
      .to("[data-hero-word]", { yPercent: 40, ease: "none" }, 0)
      .to(".hero__star", { rotate: 45, scale: 1.25, ease: "none" }, 0)
      .to(product, { yPercent: -10, rotation: 90, scale: 0.8, ease: "none" }, 0)
      .to([".hero__copy", ".hero__corner"], { y: -80, autoAlpha: 0, ease: "none" }, 0);
    // suit légèrement la souris
    const art = product.firstElementChild;
    if (art && window.matchMedia("(hover: hover)").matches) {
      gsap.set(art, { transformPerspective: 900 });
      const rx = gsap.quickTo(art, "rotationX", { duration: 1.2, ease: "power3.out" });
      const ry = gsap.quickTo(art, "rotationY", { duration: 1.2, ease: "power3.out" });
      window.addEventListener("pointermove", (e) => {
        ry((e.clientX / innerWidth - 0.5) * 36);
        rx((e.clientY / innerHeight - 0.5) * -14);
      });
    }
  }

  /* =========================================================
     MOMENTS — liste qui défile, visuel + fond qui changent
     ========================================================= */
  const momentsSec = $("#moments");
  const moments = $$(".moment", momentsSec);
  const mtexts = $$(".mtext", momentsSec);
  const mItems = $$("#momentsList li");
  let momentIdx = 0;
  let missionLen = 0;
  let momentsST = null;

  function showMoment(i, dir = 1) {
    if (i === momentIdx) return;
    const prev = momentIdx;
    momentIdx = i;
    mItems.forEach((li, k) => li.classList.toggle("is-active", k === i));
    const m = moments[i];
    setTheme(m.dataset.bg, m.dataset.fg);
    if (reduced) return;
    if (m.querySelector(".mission-line")) {
      gsap.fromTo(".mission-line", { strokeDashoffset: missionLen }, { strokeDashoffset: 0, duration: 1.8, ease: "merova", overwrite: true });
      gsap.fromTo(".mission-fill", { opacity: 0 }, { opacity: 1, duration: 1, delay: 1.1, ease: "power2.out", overwrite: true });
    }
    gsap.killTweensOf([moments[prev], moments[i], mtexts[prev], mtexts[i]]);
    gsap.to(moments[prev], { yPercent: -40 * dir, rotate: -12 * dir, scale: 0.8, autoAlpha: 0, duration: 0.8, ease: "expo.out" });
    gsap.fromTo(moments[i], { yPercent: 45 * dir, rotate: 12 * dir, scale: 0.8, autoAlpha: 0 }, { yPercent: 0, rotate: 0, scale: 1, autoAlpha: 1, duration: 1.2, ease: "expo.out" });
    gsap.to(mtexts[prev], { y: -40 * dir, autoAlpha: 0, duration: 0.6, ease: "expo.out" });
    gsap.fromTo(mtexts[i], { y: 50 * dir, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, delay: 0.1, ease: "expo.out" });
  }

  function initMoments() {
    if (reduced) return;
    missionLen = prepDraw($(".mission-line"));
    gsap.set(moments, { autoAlpha: 0 });
    gsap.set(mtexts, { autoAlpha: 0 });
    gsap.set([moments[0], mtexts[0]], { autoAlpha: 1 });
    const n = moments.length;
    momentsST = ScrollTrigger.create({
      trigger: momentsSec,
      pin: true,
      start: "top top",
      end: () => "+=" + innerHeight * (n - 0.2),
      onUpdate: (self) => {
        const i = Math.min(n - 1, Math.floor(self.progress * n));
        showMoment(i, i > momentIdx ? 1 : -1);
      },
    });
    // le monogramme en filigrane tourne pendant tout le pin
    gsap.to(".watermark--moments", { rotate: 180, ease: "none", scrollTrigger: { trigger: momentsSec, start: "top top", end: () => "+=" + innerHeight * (n - 0.2), scrub: 1 } });
  }

  /* =========================================================
     QQOQCP — défilement horizontal épinglé
     ========================================================= */
  let qqST = null;
  function initQQ() {
    if (reduced) return;
    const sec = $("#qqoqcp");
    const track = $("#qqTrack");
    const dots = $$("#qqDots i");
    const cards = $$(".qcard", track);
    const dist = () => Math.max(0, track.scrollWidth - (innerWidth - track.getBoundingClientRect().left + gsap.getProperty(track, "x")));
    const tween = gsap.to(track, {
      x: () => -dist(),
      ease: "none",
      scrollTrigger: {
        trigger: sec,
        pin: true,
        start: "top top",
        end: () => "+=" + Math.max(dist(), innerHeight * 0.5),
        scrub: 0.8,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const i = Math.round(self.progress * (dots.length - 1));
          dots.forEach((d, k) => d.classList.toggle("is-on", k <= i));
        },
      },
    });
    qqST = tween.scrollTrigger;
    cards.forEach((card) => {
      gsap.from(card.querySelector(".qcard__q"), {
        xPercent: 30, autoAlpha: 0, ease: "power2.out",
        scrollTrigger: { trigger: card, containerAnimation: tween, start: "left 95%", end: "left 55%", scrub: true },
      });
    });
    dots[0].classList.add("is-on");
  }

  /* =========================================================
     EUX vs NOUS — cartes qui se retournent
     ========================================================= */
  function initFlips() {
    const cards = $$("[data-flip]");
    const flip = (card, toBack) => {
      const inner = card.querySelector(".flip__inner");
      card.setAttribute("aria-pressed", String(toBack));
      card.dataset.state = toBack ? "back" : "front";
      gsap.to(inner, { rotateY: toBack ? 180 : 0, duration: reduced ? 0 : 1.3, ease: "merova", overwrite: true });
      if (!reduced) {
        gsap.fromTo(inner, { scale: 1 }, { scale: 0.92, duration: 0.65, ease: "power2.in", yoyo: true, repeat: 1 });
        const icon = card.querySelector(toBack ? ".flip__icon--ok" : ".flip__icon--x");
        gsap.fromTo(icon, { rotate: -180, scale: 0.4 }, { rotate: 0, scale: 1, duration: 1, delay: 0.55, ease: "back.out(2)" });
      }
    };
    cards.forEach((c) => c.addEventListener("click", () => flip(c, c.dataset.state !== "back")));
    ScrollTrigger.create({
      trigger: "#eux-vs-nous",
      start: "top 35%",
      once: true,
      onEnter: () => cards.forEach((c, i) => gsap.delayedCall(reduced ? 0 : 0.5 + i * 0.35, () => c.dataset.state !== "back" && flip(c, true))),
    });
    if (!reduced) {
      gsap.from(cards, { y: 80, autoAlpha: 0, rotate: (i) => (i % 2 ? 4 : -4), stagger: 0.1, duration: 1.2, scrollTrigger: { trigger: ".vs__grid", start: "top 85%" } });
    }
  }

  /* =========================================================
     Titres découpés, apparitions, compteurs
     ========================================================= */
  function initReveals() {
    if (reduced) return;
    $$("[data-split]").forEach((el) => {
      if (el.classList.contains("hero__title")) return;
      SplitText.create(el, {
        type: "lines", linesClass: "sl", autoSplit: true,
        onSplit: (self) => gsap.from(maskLines(self), { yPercent: 110, stagger: 0.09, duration: 1.2, scrollTrigger: { trigger: el, start: "top 86%" } }),
      });
    });
    $$(".section__head .eyebrow").forEach((el) => gsap.from(el, { y: 20, autoAlpha: 0, duration: 1, scrollTrigger: { trigger: el, start: "top 90%" } }));

    const items = $$("[data-reveal]");
    gsap.set(items, { y: 60, autoAlpha: 0 });
    ScrollTrigger.batch(items, {
      start: "top 90%",
      once: true,
      onEnter: (els) => gsap.to(els, { y: 0, autoAlpha: 1, stagger: 0.09, duration: 1.2, overwrite: true }),
    });

    // grande typo du Petit Monde et du Merci
    gsap.from(".thanks__word span", { yPercent: 100, stagger: 0.07, duration: 1.4, scrollTrigger: { trigger: ".thanks", start: "top 60%" } });
    gsap.from(".srow__l", { xPercent: -60, autoAlpha: 0, stagger: 0.08, duration: 1.2, scrollTrigger: { trigger: ".smart__rows", start: "top 80%" } });
    gsap.from(".sw__l", { yPercent: 40, autoAlpha: 0, duration: 1.4, stagger: 0.1, scrollTrigger: { trigger: ".swot__grid", start: "top 80%" } });

    // filigranes qui tournent au scroll
    $$(".watermark:not(.watermark--moments)").forEach((wm) => {
      if (wm.classList.contains("watermark--thanks")) gsap.set(wm, { x: 0, y: 0, xPercent: -50, yPercent: -50 });
      gsap.fromTo(wm, { rotate: -30 }, { rotate: 60, ease: "none", scrollTrigger: { trigger: wm.parentElement, start: "top bottom", end: "bottom top", scrub: 1 } });
    });
  }

  const fmt = (n, spaced) => (spaced ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : String(n));
  function initCounters() {
    $$("[data-count]").forEach((el) => {
      const end = +el.dataset.count;
      const spaced = el.dataset.format === "space";
      if (reduced) { el.textContent = fmt(end, spaced); return; }
      const o = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: "top 88%", once: true,
        onEnter: () => gsap.to(o, { v: end, duration: 2.2, ease: "power3.out", onUpdate: () => (el.textContent = fmt(Math.round(o.v), spaced)) }),
      });
    });
  }

  /* ---------- Marquee piloté par la vitesse de scroll ---------- */
  function initMarquee() {
    const track = $(".marquee__track");
    track.innerHTML += track.innerHTML;
    if (reduced) return;
    const loop = gsap.to(track, { xPercent: -50, duration: 28, ease: "none", repeat: -1 });
    let dir = 1;
    ScrollTrigger.create({
      onUpdate: (self) => {
        dir = self.direction;
        const v = Math.min(5, 1 + Math.abs(self.getVelocity()) / 600);
        gsap.to(loop, { timeScale: v * dir, duration: 0.2, overwrite: true });
        gsap.to(loop, { timeScale: dir, duration: 1.2, delay: 0.25, overwrite: false });
      },
    });
  }

  /* ---------- Rétro-planning : la ligne se dessine ---------- */
  function initTimeline() {
    const items = $$("[data-tl]");
    if (reduced) { items.forEach((t) => t.classList.add("is-on")); gsap.set("#timelineFill", { scaleY: 1 }); return; }
    gsap.to("#timelineFill", { scaleY: 1, ease: "none", scrollTrigger: { trigger: "#timeline", start: "top 60%", end: "bottom 60%", scrub: 0.6 } });
    items.forEach((t) => {
      ScrollTrigger.create({ trigger: t, start: "top 62%", onToggle: (s) => t.classList.toggle("is-on", s.progress > 0 || s.isActive), onLeaveBack: () => t.classList.remove("is-on") });
      gsap.from(t.querySelectorAll(".tl__when, .tl__what li"), { x: 40, autoAlpha: 0, stagger: 0.07, duration: 1.1, scrollTrigger: { trigger: t, start: "top 80%" } });
    });
  }

  /* ---------- FAQ accordéon + compétences ---------- */
  function initAccordions() {
    const qas = $$(".qa");
    const setQA = (qa, open) => {
      qa.classList.toggle("is-open", open);
      qa.querySelector(".qa__q").setAttribute("aria-expanded", String(open));
      gsap.to(qa.querySelector(".qa__a"), { height: open ? "auto" : 0, duration: reduced ? 0 : 0.8, ease: "expo.out", onComplete: () => ScrollTrigger.refresh() });
    };
    qas.forEach((qa) => qa.querySelector(".qa__q").addEventListener("click", () => {
      const open = !qa.classList.contains("is-open");
      qas.forEach((o) => o !== qa && o.classList.contains("is-open") && setQA(o, false));
      setQA(qa, open);
    }));

    $$(".skill").forEach((d) => {
      const body = d.querySelector(".skill__body");
      d.querySelector("summary").addEventListener("click", (e) => {
        e.preventDefault();
        if (d.open) {
          gsap.to(body, { height: 0, duration: reduced ? 0 : 0.6, ease: "expo.out", onComplete: () => { d.open = false; gsap.set(body, { clearProps: "height" }); ScrollTrigger.refresh(); } });
        } else {
          d.open = true;
          gsap.fromTo(body, { height: 0 }, { height: "auto", duration: reduced ? 0 : 0.9, ease: "expo.out", onComplete: () => ScrollTrigger.refresh() });
        }
      });
    });
  }

  /* =========================================================
     MODE PRÉSENTATION — arrêts, HUD, sommaire, clavier
     ========================================================= */
  let stops = [];
  function buildStops() {
    stops = [];
    const sy = window.scrollY;
    const vh = innerHeight;
    slides.forEach((el, idx) => {
      const name = el.dataset.slide;
      const outer = outerOf(el);
      const top = outer.getBoundingClientRect().top + sy;
      const h = outer.offsetHeight;
      if (el === momentsSec && momentsST) {
        const n = moments.length;
        for (let i = 0; i < n; i++) stops.push({ y: momentsST.start + ((i + 0.5) / n) * (momentsST.end - momentsST.start), idx, name });
      } else if (el.id === "qqoqcp" && qqST) {
        const n = 6;
        stops.push({ y: qqST.start, idx, name });
        for (let i = 1; i < n; i++) stops.push({ y: qqST.start + (i / (n - 1)) * (qqST.end - qqST.start), idx, name });
      } else {
        stops.push({ y: idx === 0 ? 0 : top, idx, name });
        // sections plus hautes que l'écran : arrêts intermédiaires
        let y = top + vh * 0.8;
        while (y < top + h - vh * 1.05) { stops.push({ y, idx, name }); y += vh * 0.8; }
        if (h > vh * 1.2) stops.push({ y: top + h - vh, idx, name });
      }
    });
    const max = document.documentElement.scrollHeight - vh;
    stops.forEach((s) => (s.y = Math.min(max, Math.round(s.y))));
    stops.sort((a, b) => a.y - b.y);
  }
  const currentY = () => (lenis ? lenis.targetScroll ?? lenis.scroll : window.scrollY);
  const next = () => { const y = currentY(); const s = stops.find((s) => s.y > y + 8); if (s) scrollToY(s.y); };
  const prev = () => { const y = currentY(); const s = [...stops].reverse().find((s) => s.y < y - 8); scrollToY(s ? s.y : 0); };
  const gotoSlide = (el) => {
    if (!el) return;
    if (el === momentsSec && momentsST) return scrollToY(momentsST.start + (0.5 / moments.length) * (momentsST.end - momentsST.start));
    scrollToY(el === slides[0] ? 0 : outerOf(el).getBoundingClientRect().top + window.scrollY);
  };

  // HUD + thème : quelle section occupe le milieu de l'écran ?
  const hudIdx = $("#hudIdx"), hudTotal = $("#hudTotal"), hudName = $("#hudName"), hudBar = $("#hudBar");
  hudTotal.textContent = String(slides.length).padStart(2, "0");
  let activeSlide = -1;
  function onScroll() {
    const mid = innerHeight * 0.5;
    let found = 0;
    for (let i = 0; i < slides.length; i++) {
      const r = outerOf(slides[i]).getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) { found = i; break; }
      if (r.top <= mid) found = i;
    }
    const el = slides[found];
    if (el === momentsSec) { const m = moments[momentIdx]; setTheme(m.dataset.bg, m.dataset.fg); }
    else setTheme(el.dataset.bg, el.dataset.fg);
    if (found !== activeSlide) {
      activeSlide = found;
      hudIdx.textContent = String(found + 1).padStart(2, "0");
      hudName.textContent = el.dataset.slide;
      $$("#menuList a").forEach((a, k) => a.classList.toggle("is-current", k === found));
    }
    const max = document.documentElement.scrollHeight - innerHeight;
    hudBar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  }

  // Sommaire plein écran
  const menu = $("#menu"), menuBtn = $("#menuBtn"), menuList = $("#menuList");
  slides.forEach((el, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<a href="#${el.id}"><small>${String(i + 1).padStart(2, "0")}</small>${el.dataset.slide}</a>`;
    li.firstChild.addEventListener("click", (e) => { e.preventDefault(); toggleMenu(false); gotoSlide(el); });
    menuList.appendChild(li);
  });
  let menuOpen = false;
  const menuTl = gsap.timeline({ paused: true })
    .set(menu, { visibility: "visible" })
    .to(".menu__bg", { clipPath: "inset(0% 0% 0% 0%)", duration: reduced ? 0 : 0.9, ease: "merova" })
    .from("#menuList a", { yPercent: 110, stagger: 0.03, duration: reduced ? 0 : 0.9 }, reduced ? 0 : "-=0.35")
    .from(".menu__foot", { autoAlpha: 0, duration: 0.4 }, "<0.2");
  function toggleMenu(force) {
    menuOpen = typeof force === "boolean" ? force : !menuOpen;
    document.body.classList.toggle("menu-open", menuOpen);
    menuBtn.setAttribute("aria-expanded", String(menuOpen));
    menu.setAttribute("aria-hidden", String(!menuOpen));
    if (menuOpen) { menuTl.timeScale(1).play(); lenis && lenis.stop(); }
    else { menuTl.timeScale(1.6).reverse(); lenis && lenis.start(); }
  }
  menuBtn.addEventListener("click", () => toggleMenu());

  $$("[data-goto]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); gotoSlide(document.getElementById(a.dataset.goto)); }));

  window.addEventListener("keydown", (e) => {
    if (document.body.classList.contains("is-loading")) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (e.target.tagName || "").toLowerCase();
    const interactive = tag === "button" || tag === "summary" || tag === "a" || tag === "input";
    switch (e.key) {
      case "ArrowRight": case "PageDown": e.preventDefault(); if (!menuOpen) next(); break;
      case "ArrowLeft": case "PageUp": e.preventDefault(); if (!menuOpen) prev(); break;
      case " ": if (interactive) return; e.preventDefault(); if (!menuOpen) (e.shiftKey ? prev() : next()); break;
      case "Home": e.preventDefault(); scrollToY(0); break;
      case "End": e.preventDefault(); scrollToY(document.documentElement.scrollHeight); break;
      case "f": case "F":
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
        else document.exitFullscreen?.();
        break;
      case "m": case "M": toggleMenu(); break;
      case "Escape": if (menuOpen) toggleMenu(false); break;
    }
  });

  /* ---------- Init ---------- */
  let inited = false;
  function initSite() {
    if (inited) return;
    inited = true;
    initHeroScroll();
    initMoments();
    initQQ();
    initFlips();
    initReveals();
    initCounters();
    initMarquee();
    initTimeline();
    initAccordions();
    ScrollTrigger.addEventListener("refresh", () => { buildStops(); onScroll(); });
    ScrollTrigger.refresh();
    if (lenis) lenis.on("scroll", onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    // si la page est rechargée au milieu, on se place sur la bonne section
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => gotoSlide(t), 50); }
  }
})();
