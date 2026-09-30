# Mérova — site de présentation

Site de soutenance du chef d'œuvre Bac Pro MCV : **Mérova**, marque de streetwear solidaire
(Sam Aboulkheir, Corentin Guillard, Lucas Fournier). Chaque vente finance **Le Petit Monde**.

## Présenter le jour J

**`index.html` est un fichier unique et autonome** : polices, librairies d'animation et visuels sont
inclus dedans. Il marche **sans internet**.

1. Copier `index.html` sur une clé USB (et sur le bureau du PC de la salle).
2. Double-cliquer dessus pour l'ouvrir dans Chrome, Edge ou Firefox.
3. Appuyer sur **F** pour passer en plein écran.

| Touche | Action |
| --- | --- |
| `→` / `Page suiv.` / `Espace` | étape suivante (compatible télécommande de présentation) |
| `←` / `Page préc.` / `Maj+Espace` | étape précédente |
| `F` | plein écran |
| `M` | sommaire (accès direct à une section) |
| `Début` / `Fin` | tout début / page Merci |

La molette et le trackpad fonctionnent aussi. En bas de l'écran, un compteur affiche la section en
cours (`05 / 16 — Eux vs Nous`).

**Accessibilité :** si le système a « réduire les animations » activé, ou si on ajoute `?reduced` à
l'adresse, le site s'affiche sans animations de mouvement : tout le contenu reste lisible.

## Déroulé (16 sections)

Mérova (hero) → Le projet en 5 temps (Équipe / Produit / Mission / Objectifs / Planning, avec
défilement épinglé et changement de fond) → L'équipe → QQOQCP (défilement horizontal) → Eux vs
Nous (cartes qui se retournent) → Le Petit Monde → Objectifs (compteurs animés, calcul
15 × 10€ + 35 × 25€ = 1 025€) → Besoins → SMART → SWOT → Compétences MCV → Rétro-planning →
Plan de communication → En pratique → FAQ (accordéon) → Merci et footer.

## Remplacer le logo ou utiliser les vraies photos produit

Le monogramme est redessiné en SVG (étoile à 4 branches + « MÉROVA »), en attendant le vrai fichier.
Pour utiliser les vrais fichiers, les déposer dans `assets/` avec ces noms, puis reconstruire :

| Fichier | Effet |
| --- | --- |
| `assets/logo.png` (ou `.svg`, `.webp`) | remplace le logo dans la nav et le footer |
| `assets/tshirt.png` (ou `.jpg`, `.webp`) | photo du t-shirt à la place de l'illustration (hero + section Produit) |
| `assets/casquette.png` (ou `.jpg`, `.webp`) | photo de la casquette à la place de l'illustration |

Un PNG détouré (fond transparent) rend le mieux. Les images sont intégrées dans `index.html`, qui
reste un fichier unique.

## Modifier le site

Les sources sont dans `src/` (`index.html`, `styles.css`, `main.js`). Après une modification :

```bash
npm install     # une seule fois
npm run build   # régénère index.html
```

Stack : [GSAP](https://gsap.com) (ScrollTrigger, SplitText, CustomEase) +
[Lenis](https://lenis.darkroom.engineering) pour le défilement fluide. Polices : Anton (titres),
Cormorant Garamond (logo), Inter (texte), toutes incluses dans le fichier.

## Mettre en ligne (optionnel)

Le dépôt peut être publié tel quel avec GitHub Pages (Settings → Pages → branche, dossier `/`) :
`index.html` est à la racine. Pour la soutenance, garder quand même le fichier sur clé USB.

## Référence visuelle

Inspiré de [ciaoenergy.com](https://www.ciaoenergy.com/) (Webflow + Three.js) : loader avec
compteur en %, hero produit sur typographie géante, liste qui défile avec fond qui change selon
la section, cartes « eux vs nous » qui se retournent, FAQ en accordéon. La palette de base reprend
leurs deux couleurs, `#EEEEEE` et `#191917`, complétées pour Mérova par sable `#C9B99F`,
lin `#E4DDCF`, brique `#B5452B` et forêt `#2F3B2E`.
