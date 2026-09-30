// Construit index.html : UN seul fichier autonome (polices, librairies, images incluses)
// pour pouvoir présenter sans connexion internet.
//   npm install && npm run build
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname } from "node:path";

const read = (p) => readFileSync(new URL(p, import.meta.url));
const text = (p) => read(p).toString("utf8");
const nm = (p) => `./node_modules/${p}`;

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const dataUri = (p) => `data:${MIME[extname(p).toLowerCase()]};base64,${read(p).toString("base64")}`;

// ---------- Polices ----------
const fonts = [
  ["Anton", 400, "normal", nm("@fontsource/anton/files/anton-latin-400-normal.woff2")],
  ["Cormorant Garamond", 300, "normal", nm("@fontsource/cormorant-garamond/files/cormorant-garamond-latin-300-normal.woff2")],
  ["Cormorant Garamond", 400, "normal", nm("@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2")],
  ["Inter Variable", "100 900", "normal", nm("@fontsource-variable/inter/files/inter-latin-wght-normal.woff2")],
];
const fontCss = fonts
  .map(([family, weight, style, file]) => `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:swap;src:url(${dataUri(file)}) format("woff2");}`)
  .join("\n");

// ---------- Librairies ----------
const vendor = [
  nm("gsap/dist/gsap.min.js"),
  nm("gsap/dist/ScrollTrigger.min.js"),
  nm("gsap/dist/SplitText.min.js"),
  nm("gsap/dist/CustomEase.min.js"),
  nm("lenis/dist/lenis.min.js"),
]
  .map((f) => text(f).replace(/\/\/# sourceMappingURL=.*$/gm, ""))
  .join(";\n");

const safeScript = (s) => s.replace(/<\/script/gi, "<\\/script");

// ---------- Visuels optionnels (photo réelle à la place de l'illustration) ----------
const findAsset = (name) => [".png", ".webp", ".jpg", ".jpeg", ".svg"].map((e) => `./assets/${name}${e}`).find((p) => existsSync(new URL(p, import.meta.url)));

let html = text("./src/index.html");

const logo = findAsset("logo");
html = html.replace(/<!--LOGO-->([\s\S]*?)<!--\/LOGO-->/g, (_, svg) =>
  logo ? `<img class="logo-img" src="${dataUri(logo)}" alt="Mérova">` : svg.trim()
);

const visuals = { tshirt: findAsset("tshirt"), "tshirt-mini": findAsset("tshirt"), casquette: findAsset("casquette") };
html = html.replace(/<!--VISUAL:([\w-]+)-->([\s\S]*?)<!--\/VISUAL-->/g, (_, key, svg) =>
  visuals[key] ? `<img src="${dataUri(visuals[key])}" alt="${key.startsWith("tshirt") ? "T-shirt Mérova" : "Casquette Mérova"}">` : svg.trim()
);

html = html
  .replace("/*INLINE:fonts*/", () => fontCss)
  .replace("/*INLINE:styles.css*/", () => text("./src/styles.css"))
  .replace("/*INLINE:vendor*/", () => safeScript(vendor))
  .replace("/*INLINE:main.js*/", () => safeScript(text("./src/main.js")));

writeFileSync(new URL("./index.html", import.meta.url), html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`index.html généré (${kb} Ko) — logo: ${logo ? "image" : "SVG"}, t-shirt: ${visuals.tshirt ? "photo" : "illustration"}, casquette: ${visuals.casquette ? "photo" : "illustration"}`);
