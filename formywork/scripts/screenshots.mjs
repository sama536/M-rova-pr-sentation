// Captures d'écran de FormyWork en mode démo (Playwright + Chromium).
// Usage : node scripts/screenshots.mjs [dossier_sortie] [url]   — l'application doit tourner.
// Si Playwright n'est pas installé : npm i -D playwright && npx playwright install chromium
import { mkdirSync } from "node:fs";

const playwrightPath = process.env.PLAYWRIGHT_MODULE ?? "playwright";
const { chromium } = await import(playwrightPath);

const out = process.argv[2] ?? "docs/screenshots";
const base = process.argv[3] ?? "http://127.0.0.1:8000";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

async function session(theme, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: theme, locale: "fr-FR", timezoneId: "Europe/Paris" });
  await ctx.addInitScript((t) => localStorage.setItem("fw-prefs", JSON.stringify({ theme: t, textSize: "normal" })), theme);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("Erreur page :", e.message));
  await page.goto(`${base}/connexion`);
  await page.getByRole("button", { name: "Remplir pour moi" }).click();
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(`${base}/`);
  return { ctx, page };
}

async function shot(page, name) {
  // Le flux temps réel (SSE) reste ouvert : on attend la fin des chargements visibles.
  await page.waitForFunction(() => !document.querySelector(".animate-pulse-soft, [aria-busy='true']"), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(`${out}/${name}.png`);
}

const { ctx, page } = await session("light");
await shot(page, "1-accueil");

// Liste d'offres d'une recherche enregistrée (résumés + badge Nouveau)
const searches = await page.evaluate(() => fetch("/api/searches").then((r) => r.json()));
const alt = searches.find((s) => s.params.contract === "alternance") ?? searches[0];
const offers = await page.evaluate((id) => fetch(`/api/searches/${id}/offers`).then((r) => r.json()), alt.id);
const fresh = offers.find((o) => o.is_new) ?? offers[0];
await page.goto(`${base}/offres?recherche=${alt.id}&offre=${fresh.id}`);
await page.evaluate(() => fetch("/api/dashboard"));
await shot(page, "2-offres-liste-resume");

// Détail d'une offre avec candidature par e-mail + bouton Postuler
const all = await page.evaluate(() => fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "comptable", location: "", radius_km: 20, contract: "", max_days: 0, remote: "" }) }).then((r) => r.json()));
const withEmail = all.offers.find((o) => o.apply_email) ?? all.offers[0];
await page.goto(`${base}/offres?q=comptable&offre=${withEmail.id}`);
await page.waitForTimeout(800);
await page.getByRole("button", { name: /^Postuler/ }).first().scrollIntoViewIfNeeded();
await shot(page, "3-offre-detail-postuler");

// Éditeur de CV + score ATS
const resumes = await page.evaluate(() => fetch("/api/resumes").then((r) => r.json()));
const baseCv = resumes.find((r) => r.is_base);
await page.goto(`${base}/cv/${baseCv.id}`);
await shot(page, "4-cv-editeur-score-ats");

// Kanban des candidatures
await page.goto(`${base}/candidatures`);
await shot(page, "5-candidatures-kanban");
await ctx.close();

// Thème sombre
const darkSession = await session("dark");
await darkSession.page.goto(`${base}/offres?recherche=${alt.id}&offre=${fresh.id}`);
await shot(darkSession.page, "6-theme-sombre-offres");
await darkSession.ctx.close();

// Mobile
const mobile = await session("light", { width: 390, height: 844 });
await shot(mobile.page, "7-mobile-accueil");
await mobile.ctx.close();

await browser.close();
