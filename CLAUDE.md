# CLAUDE.md

Guide pour agents (Claude Code) travaillant sur ce dépôt. Voir aussi `README.md` (doc produit).

## Vue d'ensemble

Widget web **mono-fichier** (HTML/CSS/JS vanilla, **sans framework ni build**) intégré dans Softr via iframe, + une fonction **serverless Vercel** qui persiste les dossiers (brouillons + documents) dans **Airtable**. Formulaire de saisie de dossier abonné pour l'espace installateur SunLib.

- Prod : <https://formulaire-installateur.vercel.app> (embarqué dans Softr).
- Déploiement : Vercel **redéploie automatiquement à chaque push sur `main`**. Remote `origin` en SSH (`git@github.com:SunLibIT/formulaire-installateur.git`).

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | **Tout** le widget : UI, styles, logique. Un gros `<script>` IIFE. ~3000 lignes. |
| `api/drafts.js` | Fonction serverless Vercel : proxy Airtable (token **côté serveur**) + proxy de vérification IA. |
| `README.md` | Doc produit (architecture, Airtable, intégration Softr). |

## Commandes (pas de build, pas de tests)

Vérifier la syntaxe avant tout commit :

```bash
node --check api/drafts.js
```

`index.html` n'est pas un module Node → extraire le `<script>` inline puis vérifier :

```bash
node -e 'const fs=require("fs");const h=fs.readFileSync("index.html","utf8");const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;let m,c="";while((m=re.exec(h)))c+=";(function(){"+m[1]+"})();";fs.writeFileSync(process.argv[1],c)' /tmp/inline.js && node --check /tmp/inline.js
```

Pas d'ouverture de PR ni de commit sans demande explicite de l'utilisateur.

## Conventions (à respecter impérativement)

- **Vanilla only** : aucune dépendance externe (hormis Google Maps chargé à la demande). Pas de framework, pas d'étape de build.
- **CSS scopé** sous `#sl-root` avec `!important` (résiste aux styles injectés par Softr). Les styles dynamiques JS utilisent `el.style.setProperty(prop, val, 'important')`.
- **JS** : ES5-ish, `var`, fonctions nommées dans l'IIFE (hoisting). Fonctions exposées au HTML via `window.xxx = function(){}` (appelées par `onclick=`/`onchange=`).
- **Français** partout, **avec accents** (é è ê à ç…). Ne jamais remplacer par l'ASCII.
- Écrire du code qui ressemble à l'existant (densité de commentaires, nommage, idiomes).

## Charte UI/UX (design) — fait autorité pour toute UI

> Standard de conception SunLib : **réutiliser ces patterns avant d'en inventer** ; une même notion garde partout la même couleur et la même icône. Charte d'origine pensée pour React/`lucide-react` — **ici la sortie est 100 % vanilla** (voir §Sortie technique).

### Sortie technique (adaptation à ce dépôt) — prioritaire

- **Pas de React, pas de `lucide-react`, pas de build.** Tout dans `index.html` : CSS scopé `#sl-root` + `!important`, JS vanilla dans l'IIFE, styles dynamiques via `el.style.setProperty(prop,val,'important')`.
- **Icônes = SVG inline style Lucide** (outline, `stroke="currentColor"`, `stroke-width` ~2, `aria-hidden="true"`), jamais de composants. Réutiliser les constantes existantes (`CHECK_SVG_SM`, `ALERT_SVG`, `SPIN_SVG_SM`, `XCIRCLE_SVG_SM`, `ICO_X`…). **Aucun emoji** (déjà purgés — ne pas en réintroduire).
- Toujours `var(--…)`, **jamais de hex en dur**. `prefers-reduced-motion` respecté (cf. `@keyframes sl-spin` + son media query).

### Tokens (déjà définis sous `#sl-root` — réutiliser, ne pas dupliquer)

Correspondance charte → dépôt : `--teal #0EA3B4` = `--color-teal` · `--teal-deep #13A3AC` = `--teal`/`--color-teal-deep` · `--teal-ink #0B7880` · `--teal-soft #E3F4F6` · `--green #3CAE68` · `--green-soft #EAF8EF` · **ambre** `--amber #B45309` + `--amber-bg #FEF3C7` + `--amber-border #FCE8B2` · **rouge** `--danger #dc2626` + `--red-bg #FEF2F2` + `--red-border #FBD0D0` · `--ink #1f2937` · gris lisible = `--ink-soft #6b7280` (rôle du `--muted` de la charte) · `--line #e6e9ec` · rayons `--rl 14px` / `--r 10px` · focus `--focus 0 0 0 3px rgba(14,163,180,.30)`. Dégradé de marque `--brand-gradient`/`--grad` **réservé à l'action principale**.

### Principes

1. **Cohérence avant invention** : réutiliser onglets, pastilles, cartes, boutons, chips existants.
2. **La couleur porte le sens** : gris = neutre/brouillon · **ambre = en attente / en cours** · **teal/vert = fait / validé** · **rouge = problème réel**. Un traitement en cours (analyse IA, contrôle) reste **ambre** tant qu'il n'est pas confirmé ; le vert n'apparaît qu'après validation réelle ; le rouge ne sort que pour un vrai problème. Ne pas confondre couleur de *catégorie* et couleur d'*urgence*.
3. **Jamais de sens par la couleur seule** : doubler couleur + icône + texte. Contraste AA (teal en texte → `--teal-ink`). Clavier + focus visible systématiques.
4. **Zéro redondance** : ne jamais afficher deux fois la même donnée.
5. **Temps relatif et actionnable** : « dans 10 j », « en retard de X j » ; date absolue en tooltip.
6. **Divulgation progressive & échelle** : sections repliables, pagination / « voir plus », lazy. Penser « 100 éléments » dès le départ.
7. **Flat** : dégradé de marque réservé à l'action principale, jamais en décoration ; ombres quasi nulles.

### Conventions visuelles

- **Échelle de statuts** (double-codée couleur + icône + texte) : gris = brouillon · ambre = à faire / à payer / en cours · teal/vert = payé / accepté / actif / conforme · rouge = en retard / problème. Badge temporel : vert > 14 j, ambre 3–14 j, rouge < 3 j ou dépassé.
- **Typo** : Plus Jakarta Sans (repli `system-ui`), corps 16px, interligne ~1,6. Une métrique « reine » par bloc (plus grande). Une seule couleur de libellé par formulaire. Aide en `--ink-soft` **lisible**, jamais délavée.
- **Icônes** : famille outline homogène (~16px en ligne / ~18px sur boutons), icône de *type* en tête de chaque élément de liste, espace icône↔texte ~7px.
- **Boutons** : plats. Primaire = dégradé de marque, **désactivé si formulaire invalide**, état de chargement pendant l'opération, **micro-interaction flèche** `→` glissant au survol (~0,5 s, neutralisée si `prefers-reduced-motion`). Secondaires = outline/plat. **Action destructrice jamais en accès direct** → révélée au survol/focus + **confirmation** (cf. retrait de document : icône X + confirmation en 2 temps).
- **Nav & état actif** : l'actif se marque **par la couleur (teal)**, jamais par bordure/liseré/barre. Onglets = **soulignement teal** seul. Sidebar éventuelle = fond `--teal-soft` + texte `--teal-ink` gras.
- **Segmented control** (choix unique exclusif 2–5 options) : rail gris, thumb blanc glissant (~0,28 s), actif `--teal-ink` gras (cf. `.adr-seg`). Multi-sélection → chips. Onglets de contenu → soulignement teal. **Ne pas confondre les trois.**
- **Cartes** : fond blanc, bordure 1px `--line`, coins `--rl`, padding confortable ; bordure accentuée (ambre/vert/rouge) **seulement** quand l'état le justifie. Aide → encadré info (bleu + icône) ; alerte → bannière ambre + icône.
- **Alignements** : labels gris à gauche, valeurs en colonne régulière ; **montants alignés à droite**.

### Patterns récurrents

- **Collecte de documents** : eyebrow teal en capitales + **barre « X document(s) fourni(s) sur Y »** (`updateDocProgress`) + ligne d'aide formats/poids ; zones `.uz` dont la bordure/le statut suivent l'**état réel** (jamais « toujours vert »).
- **Uploader avec analyse IA** (CNI) : états `vide → envoi (ambre + spinner) → analyse (ambre + aria-live) → conforme (vert) → non conforme (rouge, raison actionnable) → incomplet (ambre)`. Fichiers en **chips** (icône + nom + statut + retrait confirmé). Erreur = ce qui ne va pas **et** comment corriger, voix de l'interface (sans excuse).
- **Modales** : `role=dialog`/`alertdialog`, `aria-modal`, focus trap, Échap + clic overlay, retour du focus. Icône = pastille ronde + SVG (`.modal-ico-alert`/`.modal-dico`), pas d'emoji. La modale de récap est **réservée à la création finale** — pour un retrait ponctuel, préférer une confirmation inline.
- **Chips PJ** : icône + nom + taille + retirer (confirmé).

### A11y (checklist)

Aucun sens par la couleur seule · contraste AA (`--teal-ink` pour le texte teal) · `aria-hidden` sur décoratif, `aria-label` sur icône-seule · `label` associé (`for`/`id`) · `disabled` réels · focus visible (`--focus`, ne jamais retirer l'outline sans le remplacer) · zones dynamiques `aria-live` · modales complètes.

### Copy

Sentence case, verbes actifs (« Enregistrer », pas « Soumettre »). Un bouton garde le même libellé dans tout le flux (« Publier » → toast « Publié »). Nommer côté utilisateur, pas côté système. Erreurs jamais vagues ni excusantes. Écran/état vide = invitation à agir.

## Architecture du widget (`index.html`)

Assistant (wizard) multi-étapes. Variables d'état clés dans l'IIFE : `ct` (`'part'`/`'pro'`), `iType` (type install), `abos[]`/`collabs[]`, `docs` (documents uploadés), `geo`, `simResult`.

- **Flux** : `FLOW_PART=[1,2,4,5,6]` / `FLOW_PRO=[1,2,3,4,5,6]` → Type · Identité · *(collab pro)* · Adresse (Google Maps) · Installation · Documents + Récap.
- **Brouillons** : `buildDraftPayload()` → `saveDraft()` (upsert serveur sur `ID Brouillon`). Reprise : `hydrate(p)` restaure snapshot complet (`p.fields` + tableaux + `docs`).
- **Documents** : chaque zone `.uz` = 1 `<input type=file>`, uploadée immédiatement via `onF(inp,key)` → `/api/drafts {action:'upload'}` → pièce jointe Airtable (champ `Documents`). `docs[key] = {filename,id}`. Progression via classe `.ok` sur les `.uz`.
- **Création finale** : `slCreate()` (gardée par la case de certification `#sl-certify`).

## Serverless `api/drafts.js`

Proxy Airtable. Base par défaut `appmroXyuCrYwDbM7`, tables `Particulier`/`Pro`, table `Sessions`. `export const maxDuration = 60`.

Actions (POST `body.action`) + GET/DELETE :
- `GET ?email=` → dossiers « En cours ».
- `POST` (payload) → upsert brouillon.
- `POST {action:'upload'}` → ajoute une pièce jointe (append).
- `POST {action:'verifyid'}` → vérification IA de la CNI (voir plus bas).
- `POST {action:'removedoc'}` → retire une pièce jointe (par id).
- `DELETE ?id=&type=` → supprime un brouillon.

Variables d'env Vercel : `AIRTABLE_TOKEN` (requis), `AIRTABLE_BASE_ID`, `ALLOW_ORIGIN`, `N8N_ID_WEBHOOK_URL`, `N8N_ID_WEBHOOK_SECRET`, `N8N_ID_WEBHOOK_HEADER` (défaut `x-sl-secret`).

## Feature : vérification IA de la CNI (multi-fichiers)

Contrôle IA de la pièce d'identité à l'upload. Voir la mémoire projet `cni-ai-check` pour les IDs/état courant.

- **CNI = multi-fichiers** (particuliers uniquement) : `docs.cni` est un **tableau** `[{filename,id}]` (les autres clés restent des objets). UI : liste + « Retirer » + « Ajouter un document ». Fonctions : `onCni`, `uploadCniFile`, `removeCniFile`, `renderCniList`, `getCniList`/`setCniList`.
- **Check** : après ajout/retrait → `scheduleCniCheck()` (débounce) → `doCniCheck()` envoie les **ids** (pas le base64) à `/api/drafts {action:'verifyid'}`. Le proxy `handleVerifyId` télécharge les pièces depuis Airtable et transmet `{files:[{dataBase64,contentType,filename}], abonnes}` au webhook n8n. *(On envoie des ids, pas des base64, à cause de la limite d'entrée de 4,5 Mo des fonctions Vercel.)*
- **Workflow n8n** : `SunLib — Vérification CNI (IA)` — webhook → construit la requête (boucle sur `files[]`) → appel modèle vision (**actuellement Anthropic Claude**, `claude-sonnet-4-5`, tool use forcé `verdict_cni`, credential n8n `anthropicApi`) → normalise → renvoie un verdict JSON. Le front/proxy sont **agnostiques du fournisseur**.
- **Verdict** : `{ ok, estPieceIdentite, typeDocument, pays, estFrancaise, rectoVersoPresents, lisible, nomDetecte, prenomDetecte, correspondAbonne, confiance, raison }`.
- **Blocage** (`cniBlockReason`, appelé dans `slCreate`) : bloquant si `estPieceIdentite`/`estFrancaise`/`lisible` = false ; avertissement non bloquant si recto-verso incomplet ou nom ≠ abonnés.
- **Dégradé** : si le verdict est indisponible (`ok!==true` : n8n absent, 403, timeout…), la création **n'est pas bloquée** (une panne ne doit pas casser le formulaire).

## Pièges connus

- **Webhook n8n** : doit être **actif** (sinon 404) et le secret Header Auth (`x-sl-secret`) doit correspondre **exactement** à `N8N_ID_WEBHOOK_SECRET` sur Vercel (sinon 403 « Authorization data is wrong »).
- **Variables Vercel** : prises en compte au **prochain build** → *Redeploy* après ajout.
- **Appel Claude (n8n)** : le nœud HTTP doit envoyer l'en-tête `anthropic-version: 2023-06-01` (le credential `anthropicApi` n'ajoute que `x-api-key`), sinon **400 « anthropic-version header is required »**. *(Historique : Gemini free tier bloquait en 429 quota=0.)*
- **Limite Vercel** : corps de requête entrant ≤ 4,5 Mo (d'où l'approche par ids pour `verifyid`).
- **Upload** : `onF` limite chaque fichier à 3 Mo (base64 ≈ 4 Mo).
