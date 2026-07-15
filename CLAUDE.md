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
- **Icônes** : famille outline homogène (~16px en ligne / ~18px sur boutons), icône de *type* en tête de chaque élément de liste, espace icône↔texte ~7px. **Jamais de `margin` sur un `<svg>`** (surtout pas `margin-right`) : l'espacement icône↔texte vient **toujours** du parent (`display:flex; gap:…`), jamais d'une marge sur l'icône — une marge sur l'icône « fuit » via des sélecteurs larges (ex. `.ok svg`) et crée des espacements parasites.
- **Boutons** : plats. Primaire = dégradé de marque, **désactivé si formulaire invalide**, état de chargement pendant l'opération, **micro-interaction flèche** `→` glissant au survol (~0,5 s, neutralisée si `prefers-reduced-motion`). Secondaires = outline/plat. **Action destructrice jamais en accès direct** → révélée au survol/focus + **confirmation par petite modale** (`confirmDanger({title,message,confirmLabel,onConfirm})`, modale générique réutilisable : focus-trap, Échap, clic overlay, retour du focus, fond `inert`). Le retrait de document (`.cnu-frm`) ouvre cette modale (plus de « 2 temps » inline). **Exception tactile** : sur écran sans survol (`@media (hover: none)`) les actions par fichier (`.cnu-frm` Retirer, `.cnu-frep` Remplacer) sont **toujours visibles** (sinon inaccessibles au doigt). **Remplacer** est sur la vignette pour **toutes** les pièces : générique = pose `_replace={key,id}` puis `trig` l'input → `onF` retire l'ancien + dépose le nouveau ; CNI (mono-fichier) = `trig` l'input → `onCniFace` remplace en `{single:true}` (via `prevId`).
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
- **Brouillons** : `buildDraftPayload()` → `saveDraft()` (upsert serveur sur `ID Brouillon`). Reprise : `hydrate(p)` restaure snapshot complet (`p.fields` + tableaux + `docs`). **Auto-enregistrement** : après chaque dépôt/retrait de fichier, `scheduleAutoSave()` (débounce ~1,2 s) ré-upsert le brouillon **silencieusement** (le dossier + le mapping des fichiers restent à jour côté serveur → tout revient après un refresh).
- **Reprise des documents = la table `Documents` fait foi** : à la reprise, `restoreDocVerdicts(draftId)` appelle `getdocverdicts` et **reconstruit `docs` depuis les lignes** (`{cle,filename,size,id,controles}`) au lieu de se fier au seul `Données JSON` — donc un fichier déposé mais dont le brouillon n'a pas été ré-enregistré **réapparaît quand même**. Fallback sur `Données JSON` si la table est injoignable. Ne relance l'IA que sur les pièces sans verdict stocké. **Aucune ré-analyse à l'hydratation** : un drapeau `_hydrating` (posé par `hydrateDraft`) neutralise les re-déclenchements des toggles rejoués pendant la reprise (`setProp`→`kbis-prop`, `toggleElecNewAcq`→`elec`/`elec-pro`) ; seul `recheck` relance l'IA, et uniquement pour les pièces sans verdict.
- **Documents — deux portées (scope)** : *(1)* **pièces du projet** (communes au dossier) = cartes multi-fichiers, `docs[key]` = tableau `[{filename,size,id}]`, upload en **append** via `onF(inp,key)` → `uploadFileFor(key,f)`. *(2)* **pièces d'abonné** = **CNI par personne**, deux slots mono-fichier `docs['cni-recto-<uid>']` / `docs['cni-verso-<uid>']` (`uid` = identité **stable** de l'abonné, dans `p.abonnes[].uid`). Section « Documents des abonnés » reconstruite par `renderAbonneDocs()` (une carte par abonné : nom + email + « X/2 »), slots bâtis par `_buildCniSlotCard`. Upload en **remplacement** : `uploadFileFor(key,f,{single:true})` (envoie `prevId`). Rendu : `renderDocZone(key)` dispatche `isCniKey(k)`→`renderCniSlot` sinon `renderDoc` ; `upgradeDocZones()` transforme les `.uz` statiques (projet) en cartes ; builders partagés `_docDropzone`/`_docChip`. Progression via classe `.ok` sur les `.uz` (total dynamique = pièces projet + 2 × abonnés). Snapshot : chaque fichier mémorise `scope` (+ `face`/`abo` pour les CNI) ; à la reprise, `renderAbonneDocs()` rebranche `docs['cni-…-<uid>']` sur l'abonné via son `uid`.
- **Création finale** : `slCreate()` (gardée par la case de certification `#sl-certify`).

### Documents & contrôles par type (récap)

Toutes les pièces : obligatoires, multi-fichiers. **Contrôles génériques** (toute pièce) = format via `accept` (PDF seul, ou PDF/JPG/PNG — filtre natif, non revérifié) + poids **> 3 Mo refusé** (`uploadFileFor` → toast « Fichier trop lourd », limite non affichée). **Analyse de contenu uniquement sur les pièces marquées « IA » ci-dessous.**

| Document (clé `docs`) | Portée | Part. | Pro | Formats | Contenu |
|---|---|:--:|:--:|---|---|
| CNI **recto + verso** — par abonné (part.) / du **dirigeant** (pro, `uid='dir'`) (`cni-recto-<uid>` / `cni-verso-<uid>`) | abonné / dirigeant | ✅ | ✅ | PDF/JPG/PNG | **IA par face** (§ Feature CNI) — nom vs formulaire [CMP-FORM] |
| Google Maps toiture (`maps` / `map-pro`) | dossier | ✅ | ✅ | PDF/JPG/PNG | **IA** (§ docs génériques) — [CMP-ÉTUDE] vs calepinage |
| Étude + calepinage (`calep` / `cal-pro`) | dossier | ✅ | ✅ | PDF/JPG/PNG | **IA** (§ docs génériques) — présence prod/conso/taux/courbe/cash-flow |
| Devis abonnement (`devis` part. / `dev-pro` pro) | dossier | ✅ | ✅ | PDF | **IA** (§ docs génériques) — signature, total HT=0, montant/durée vs formulaire, matériel (identique part./pro) |
| Avis d'imposition (`impots`) ³ | dossier | ✅ | — | PDF | **IA** (§ docs génériques) — pages complètes + nom cohérent + solvabilité |
| Facture d'électricité (`elec` part. / `elec-pro` pro) | dossier | ✅ | ✅ | PDF/JPG/PNG | **IA** (§ docs génériques) — PDL vs formulaire + échéancier si « nouvelle acquisition » ; part. = conso annuelle, **pro = 12 factures mensuelles** (coût + conso) |
| Titre de propriété (`prop` part. / `prop-pro` pro) | dossier | ✅ | ✅ | PDF | **IA** (§ docs génériques) — acte/taxe + adresse vs formulaire ; **pro** : + adresse vs étude [CMP-ÉTUDE], sans contrôle de nom |
| Fiche technique batterie (`bat-tech`) ¹ | dossier | ✅ | — | PDF/JPG/PNG | — |
| Extrait Kbis exploitant (`kbis`) ² | dossier | — | ✅ | PDF | **IA** (§ docs génériques) — est un Kbis + raison sociale vs formulaire |
| Extrait Kbis **propriétaire des murs** (`kbis-prop`) ⁴ | dossier | — | ✅ | PDF | **IA** (§ docs génériques) — est un Kbis + raison sociale (propriétaire) vs formulaire |
| 3 derniers bilans (`bilans`) | dossier | — | ✅ | PDF | **IA** (§ docs génériques) — 3 exercices présents + durée 12 mois |

¹ Affichée si `iType` ∈ {`pvb`,`bat`} et `ct==='part'` (`tog('doc-bat',…)`). ² « < 3 mois » = consigne affichée, non contrôlée. ³ Portée **dossier** (1 seul) même en foyer multiple — dette technique (« par foyer fiscal »). ⁴ Affiché uniquement si l'entreprise **n'est pas** propriétaire des murs (`propT==='non'`, locataire) — `tog('doc-kbis-prop',…)` dans `setProp`.

**Contrôle IA — CNI par abonné (particuliers) et du dirigeant (pro, `uid='dir'`)** : bloquant à la création (`cniBlockReason`) si, pour un abonné (ou le dirigeant), recto **ou** verso manquant, ou (sur une face déposée) illisible / pas une pièce / non française / > 75 ans / périmée ; avertissement (non bloquant) si face inversée (`face`≠slot) ou nom ≠ personne attendue (abonné ou dirigeant, résolue via `cniPersonFor(uid)` — [CMP-FORM]) ; par fichier (lisible + `estPiece` + `face`) → slot vert/rouge ; verdict indisponible/indéterminé → non bloquant. Détails : § *Feature vérification IA de la CNI*.

## Serverless `api/drafts.js`

Proxy Airtable. Base par défaut `appmroXyuCrYwDbM7`, tables `Particulier`/`Pro`, `Sessions`, **`Documents`** (`tblbXUlBAoQJBl21P`). `export const maxDuration = 60`.

**Stockage des documents (depuis 2026-07-13) = table `Documents` dédiée, 1 ligne par fichier** (fini le champ pièce jointe unique). Champs : `Nom`, `Fichier` (pièce jointe, id `fldx0yxmkJ90wRfxl`), `Type` (single-select, mappé depuis la clé via `typeForKey`), `Portée` (Dossier/Abonné), `Abonné`, `Clé` (clé `docs`), `Statut validation`, `Contrôles` (JSON), `Confiance`, `Dossier Particulier`/`Dossier Pro` (liens), `ID Brouillon`. **L'`id` renvoyé au front = l'id de la LIGNE** (`rec…`) — utilisé par `verifyid`/`removedoc`. *(Les anciens champs `Documents` (attachments) sur Particulier/Pro sont conservés mais plus utilisés — cutover propre, pas de migration : la base n'était pas en prod.)*

Actions (POST `body.action`) + GET/DELETE :
- `GET ?email=` → dossiers « En cours ».
- `POST` (payload) → upsert brouillon ; **si `p.validation`** écrit `Statut validation`/`Points bloquants`/`Rapport validation`/`Validé le` sur la fiche (C) ; **si `p.docStatuts`** met à jour le statut par ligne `Documents` (B).
- `POST {action:'upload'}` → **crée une ligne `Documents`** (liée au dossier) + y attache le fichier (`typeForKey`/`scope`/`abo`/`key`). `prevId` → supprime l'ancienne ligne (remplacement). Renvoie l'id de ligne.
- `POST {action:'verifyid'}` → vérification IA (voir plus bas) ; `filesFromIds` lit les fichiers **par id de ligne** `Documents`.
- `POST {action:'removedoc'}` → **supprime la ligne** `Documents` (par id).
- `POST {action:'docverdict', items:[{id,statut,controles,confiance}]}` → **écrit le verdict sur les lignes** `Documents` ; appelé par le front **dès qu'une analyse se termine** (`persistDocVerdict`), pour persister sans attendre la création.
- `POST {action:'getdocverdicts', draftId}` → relit les lignes `Documents` du dossier (`[{id,cle,filename,size,controles,statut}]`) ; à la reprise, `restoreDocVerdicts()` **reconstruit `docs` depuis ces lignes** (la table fait foi) + restaure les verdicts et **ne relance l'IA que sur les documents sans verdict stocké** (plus de re-trigger complet). `Contrôles` stocke le **verdict front complet** (JSON) pour permettre cette restauration.
- `DELETE ?id=&type=` → supprime un brouillon.

Verdict persisté (schéma dossier) : sur `Particulier`/`Pro` — `Statut validation` (Conforme/À vérifier/Non conforme), `Points bloquants`, `Rapport validation` (JSON), `Validé le` ; front `buildValidation()` + `buildDocStatuts()` (envoyés à la **création**). `sniffMedia` corrige le `media_type` (magic bytes) avant l'appel Claude.

Variables d'env Vercel : `AIRTABLE_TOKEN` (requis), `AIRTABLE_BASE_ID`, `ALLOW_ORIGIN`, `N8N_ID_WEBHOOK_URL`, `N8N_ID_WEBHOOK_SECRET`, `N8N_ID_WEBHOOK_HEADER` (défaut `x-sl-secret`).

## Feature : vérification IA de la CNI (par abonné, recto/verso, asynchrone)

Contrôle IA de la pièce d'identité **par abonné et par face**. Voir la mémoire projet `cni-ai-check` pour les IDs/état courant.

> **Portée pro (depuis 2026-07-15)** : la même infra couvre aussi la **CNI du dirigeant** en profil pro, via un `uid` stable **`'dir'`** (clés `cni-recto-dir`/`cni-verso-dir`). La carte est bâtie par `renderDirigeantDocs()` (hôte `#docs-dirigeant` dans `#docs-pro`), et la personne de référence (nom comparé, étiquette) est résolue par **`cniPersonFor(uid)`** — abonné (`abos[]`) pour un `uid` d'abonné, **dirigeant du formulaire** (`#sl-dir-prenom`/`#sl-dir-nom`) pour `uid='dir'`. `doCniFaceCheck`/`renderAboAggregate`/`docLabelFor`/`docAboFor` sont désormais agnostiques (part/pro) grâce à `cniPersonFor`. Blocage : `cniBlockReason()` gère les deux cas (elle s'auto-limite ; `slCreate` l'appelle sans garde `ct`).

- **Structure** : deux slots **mono-fichier** par abonné — `docs['cni-recto-<uid>']` et `docs['cni-verso-<uid>']` (`uid` = `p.abonnes[].uid`, stable). Le client dépose **recto et verso séparément** (pas de fichier « combiné »). Cartes bâties par `renderAbonneDocs()` → `_buildCniSlotCard` → `renderCniSlot(key)`. Helpers de clé : `cniKey(uid,face)`, `isCniKey(k)`, `cniFaceOf(k)`, `cniUidOf(k)`. Upload en **remplacement** (`uploadFileFor(key,f,{single:true})`, `prevId`). Le verdict d'une face est stocké **sur son fichier** : `docs[key][0]._verdict = {lisible, estPiece, face, probleme, full}`.
- **Analyse ASYNCHRONE par face** : à chaque ajout/remplacement d'une face → `scheduleCniFaceCheck(key)` (débounce par slot) → `doCniFaceCheck(key)` envoie **l'id de CE fichier** + **le seul abonné concerné** à `/api/drafts {action:'verifyid'}`. Les faces ne s'attendent pas ; chaque slot affiche son propre état (`empty → uploading → analyzing → conform/nonconform`). *(On envoie un id, pas de base64 — limite d'entrée 4,5 Mo des fonctions Vercel.)* Le proxy `handleVerifyId` télécharge la pièce et transmet `{files, abonnes}` au webhook n8n.
- **Workflow n8n** : `SunLib — Vérification documents (IA)` (id `6NQRl7XphYWBKA6u`, webhook `sunlib-verif-cni` inchangé). **Structure : un nœud par type de document.** `Reception du document` → **Switch `Aiguiller par type`** (sur `docType`) → `Extraction CNI` **ou** `Extraction Titre` → `Analyse Claude Vision` (Claude `claude-sonnet-4-5`, `anthropicApi`) → **Switch `Aiguiller le verdict`** → `Normaliser CNI` **ou** `Normaliser Titre` → `Renvoie le verdict`. `docType` absent ⇒ CNI. Front/proxy **agnostiques du fournisseur**.
- **Verdict** (pour la/les face(s) envoyée(s)) : `{ ok, estPieceIdentite, typeDocument, pays, estFrancaise, rectoVersoPresents, lisible, nomDetecte, prenomDetecte, dateNaissance, dateDelivrance, dateExpiration, dateExpirationEffective, perimee, age, ageMax75Respecte, correspondAbonne, confiance, raison, fichiers:[{lisible, estPiece, face, probleme}] }`. `face` ∈ `recto`/`verso`/`inconnu` (détecté sur le contenu : photo+état civil = recto ; MRZ/signature/adresse = verso). Le nœud « Normaliser le verdict » calcule `age` + `ageMax75Respecte` (**75 ans max**) et la **validité** (`perimee` + `dateExpirationEffective`). **Règle française** : une CNI plastifiée délivrée à un **majeur** entre le 02/01/2004 et le 31/12/2013 voit sa validité **prolongée de 5 ans** (`dateExpirationEffective` = imprimée + 5 ans) ; naissance inconnue → prolongation appliquée (cas majoritaire).
- **Fusion par abonné** (`aboCniVerdict`/`aboCniIssues`) : le front combine les verdicts des deux faces. `renderCniSlot` colore chaque slot (par fichier : `lisible`/`estPiece`) ; `renderAboAggregate` affiche la synthèse (« X/2 », encadré) — l'**absence** d'une face n'est pas affichée en rouge tant que rien n'est déposé (invitation neutre).
- **Blocage** (`cniBlockReason`, appelé dans `slCreate`, particuliers) : pour **chaque** abonné — bloquant si recto **ou** verso manquant, ou (sur une face déposée) `lisible`=false / `estPiece`=false / `estFrancaise`=false / `ageMax75Respecte`=false / `perimee`=true ; **avertissement** (non bloquant) si `face`≠slot (recto/verso inversés) ou `correspondAbonne`=false. Indéterminés (null) → non bloquant.
- **Dégradé** : verdict indisponible (`ok!==true` : n8n absent, 403, timeout…) → la présence (recto+verso) reste exigée, mais les contrôles de contenu **ne bloquent pas** (une panne ne casse pas le formulaire).

## Feature : vérification IA des autres documents (générique, par `docType`)

Même infra que la CNI, généralisée aux **autres pièces** (1ᵉʳ document couvert : **titre de propriété**). Le principe des comparaisons est **[CMP-FORM]** : on compare la donnée lue sur le document aux **champs déjà saisis dans le formulaire** (source de vérité ; pas de CRM externe), transmis à l'upload.

- **Front** : registre `DOC_VERIFY` (clé document → `docType`) — actuellement `{ prop/'prop-pro':'TITRE_PROPRIETE', maps/'map-pro':'GOOGLE_MAPS', calep/'cal-pro':'ETUDE_INSTALLATEUR', devis:'DEVIS', impots:'AVIS_IMPOT', bilans:'BILANS', elec:'FACTURE_ELEC', kbis:'KBIS', 'kbis-prop':'KBIS' }`. `docFormContext(key)` inclut désormais `profil` (`'part'`/`'pro'`) — les nœuds n8n branchent dessus (ex. `TITRE_PROPRIETE` : pro ⇒ pas de nom + `adresse_etude`). À l'ajout/retrait → `scheduleDocCheck(key)` → `doDocCheck(key)` POST `/api/drafts {action:'verifyid', docType, ids, refIds, form}` où `form` = `docFormContext(key)` (`{adresse, abonnes, duree, mensualite, batteriePhysique, pdl, nouvelleAcquisition}` + en **pro** `{raisonSociale, dirigeant, estProprietaire, proprietaireNom, raisonSocialeAttendue}` — `batteriePhysique` = `iType ∈ {pvb,bat}` pour le seuil de solvabilité ; `pdl` = `#sl-pdl` ; `nouvelleAcquisition` = case `#sl-elec-newacq` ; `raisonSocialeAttendue` = raison sociale attendue **selon la clé** (`kbis` → exploitant `#sl-pro-nom` ; `kbis-prop` → propriétaire `#prop-nom`), pour le contrôle KBIS). Verdict dans `docVerdicts[key]` ; `renderDoc` **colore chaque vignette de fichier + affiche le motif dessus** (`_docChip(key,item,idx,vinfo)` + `docFileVinfo(key)` → tone `ok`/`warn`/`bad`), comme la CNI (`cniFileVinfo`). Coloration par fichier valable pour **tous** les documents. Blocage à la création (`slCreate`) : **(1) complétude** `docsMissingReason()` — toute zone `.uz` **visible** (donc requise) sans fichier bloque, hors CNI (parcours de visibilité identique à `updateDocProgress`, exclut `isCniKey`) ; **(2)** `cniBlockReason()` (CNI) ; **(3) conformité** `docsBlockReason()` si un verdict `statut==='ko'`. Les trois alimentent aussi `buildValidation().pointsBloquants`.
- **Contrôle croisé [CMP-DOC]/[CMP-ÉTUDE]** : `DOC_REFS` (ex. `{ maps:['calep'] }`) → `doDocCheck` joint les `refIds` (fichiers de la pièce de référence) ; le proxy les résout en `refFiles` transmis à l'IA. `scheduleDependents(key)` re-déclenche les docs qui référencent `key` (maj du calepinage → re-vérifie Google Maps).
- **Verrou de séquence** : `DOC_GATE = { maps:'calep', 'map-pro':'cal-pro' }` — la copie **Google Maps est vérifiée par rapport à l'étude** ([CMP-ÉTUDE]) — elle **reste obligatoire** —, donc l'étude est placée **avant** dans le markup et la pièce Google Maps est **verrouillée** (carte grisée via `.is-locked`) (`renderDoc` état `locked` : pastille « Verrouillé » + encadré ambre, dépôt désactivé, `uploadFileFor` refuse) tant que l'étude n'est pas déposée **et** analysée sans rejet. `docGateState(key)` : verrouillé si source absente / en cours d'analyse / en attente / `ko` ; débloqué dès `ok`/`a_verifier`, **ou** si l'IA est indisponible après tentative (`_docTried` → dégradé, ne bloque jamais). `refreshGatedBy(gateKey)` (appelé dans `doDocCheck`) re-rend la pièce verrouillée quand la source change.
- **Proxy** : `handleVerifyId` transmet `docType` + `form` + `refFiles` (résolus depuis `refIds`) au webhook. `docType` absent ⇒ `'CNI'` (rétrocompat).
- **Workflow n8n** (même workflow que la CNI, **un nœud par type**, cf. § précédent) : le Switch `Aiguiller par type` route vers `Extraction Titre` (outil `extraction_doc` par type) ; `Normaliser Titre` produit un verdict au **format « document » du schéma dossier** : `{ ok, type, statut:'ok'|'ko'|'a_verifier', confianceExtraction, donneesExtraites, controles:[{regle,libelle,type,statut,bloquant,valeurAttendue,valeurConstatee,detail,confiance}], raison }`. Le `form` est transporté jusqu'au normalize via `$('Extraction Titre').item.json.form` ; `docType` (pour le 2ᵉ Switch) via `$('Reception du document').item.json.body.docType`.
- **Types couverts & contrôles** (tous bloquants sauf mention ; `a_verifier` / IA indisponible → non bloquant) :
  - `TITRE_PROPRIETE` (clé `prop` **particulier** / `prop-pro` **pro** ; branche via `form.profil`) : `type_document` (acte notarié OU taxe foncière) · `nom_form` [CMP-FORM] (**particulier seulement** — omis en pro) · `adresse_form` [CMP-FORM] · `adresse_etude` [CMP-ÉTUDE] (**pro seulement**, **non bloquant** `a_verifier` — l'étude `cal-pro` est jointe en `refFiles` via `DOC_REFS['prop-pro']=['cal-pro']`, comparaison visuelle floue ; `etudeFournie=false` → `a_verifier`) · `pages_completes` (si taxe foncière) · `lisible`.
  - `GOOGLE_MAPS` : `vue_aerienne` · `toiture_ciblee` · `coherence_calepinage` [CMP-ÉTUDE] (**non bloquant** : `a_verifier`, comparaison visuelle floue) · `lisible`. Reçoit le calepinage via `refFiles`.
  - `ETUDE_INSTALLATEUR` (clé `calep`/`cal-pro`) : `calepinage` (présent + lisible) · `production_kwh` · `consommation_kwh` · `taux_autoconso` · `courbe_charge` · `cash_flow` · `lisible` (présence + extraction).
  - `DEVIS` (clé `devis` **particulier** / `dev-pro` **pro** — identiques, nœud agnostique du profil) : `signature` · `total_ht_zero` **[BLOQUANT-DUR]** (total HT doit valoir 0, modèle abonnement) · `duree_abonnement` [CMP-FORM] · `materiel` (panneaux + onduleurs + quantités) · `lisible` = bloquants ; `montant_abonnement` [CMP-FORM] = **avertissement** (mensualité du formulaire = estimation ; le montant du devis est comparé à **HT ou TTC** — pro paie en HT, particulier en TTC). `docFormContext` fournit `duree` + `mensualite` {ht,ttc}.
  - `AVIS_IMPOT` (clé `impots`, **particulier**) : `est_avis` (est un avis d'imposition sur le revenu) · `pages_cles` [PRÉSENCE] (**au moins les 2 pages clés**, pas l'avis complet : page « résumé de la situation fiscale » avec RFR/nombre de parts **et** page « détail des revenus » — l'IA extrait `pageResumePresente`/`pageDetailRevenusPresente` ; bloquant si l'une manque, `a_verifier` non bloquant si indéterminé) · `nom_coherent` [CMP-FORM] (au moins un nom du foyer fiscal = un abonné) · `solvabilite` [RÈGLE] · `lisible` = tous bloquants. **Solvabilité** : `ratio = (mensualité TTC × 12) / revenus déclarés avant abattement 10%` (l'IA extrait `revenusAvantAbattement`, `Normaliser Avis` calcule le ratio **en dur**), bloquant si `ratio ≥ seuil` avec **seuil 4 %** (ou **7 %** si `form.batteriePhysique`). Revenus non lus ou mensualité absente → `a_verifier` (non bloquant). *(Avis au niveau **dossier**, 1 seul même en foyer multiple — cf. note ³.)*
  - `BILANS` (clé `bilans`, **pro**) : `est_bilans` (comptes annuels d'entreprise) · `presence_3` [PRÉSENCE] (**≥ 3 exercices** distincts présents — l'IA compte `nbBilans`) · `duree_12` [RÈGLE] (chaque exercice couvre **12 mois** ; tolérance 11–13, calcul **en dur** dans `Normaliser Bilans` sur `exercices[].dureeMois`) · `lisible` = tous bloquants. Nombre/durées non lus → `a_verifier` (non bloquant). *Nuance métier* : un 1ᵉʳ/dernier exercice légitime peut ≠ 12 mois → si trop bloquant, basculer `duree_12` en avertissement.
  - `FACTURE_ELEC` (clé `elec` **particulier** / `elec-pro` **pro** ; branche `form.profil`) : `est_doc` (facture d'électricité **ou** échéancier) · `conso_annuelle` [PRÉSENCE] (consommation annuelle en kWh visible) · `pdl_coherent` [CMP-FORM] (PDL du document = `#sl-pdl`, comparaison **en dur** sur les chiffres ; PDL absent du doc ou du formulaire → `a_verifier`) · `lisible` = tous bloquants. **Case « nouvelle acquisition »** (`#sl-elec-newacq`, injectée dans la carte par `upgradeDocZones`, togglée par `toggleElecNewAcq`) : pas d'historique de factures → la pièce devient un **échéancier** (l'IA y lit la conso annuelle estimée) ; la pièce reste requise (facture **ou** échéancier), seuls le libellé (`applyElecLabels(key,checked)`) + le contexte IA changent. État persisté via `collectAllFields` (case standard). **Pro** (`elec-pro`) : hors nouvelle acquisition, `conso_annuelle` est remplacé par **`factures_12`** [PRÉSENCE][EXTRACTION] (**12 factures mensuelles** avec coût + consommation — l'IA renvoie `nbFacturesMensuelles` + `facturesAvecCoutEtConso`) ; `est_doc`/`pdl_coherent`/`lisible` inchangés. Case pro propre = `#sl-elec-newacq-pro` ; `_elecAcqRow`/`applyElecLabels`/`toggleElecNewAcq` + `docFormContext` prennent la clé pour cibler la bonne carte/case.
  - `KBIS` (clés `kbis` exploitant / `kbis-prop` propriétaire des murs, **pro**) : `est_kbis` (est un extrait Kbis / RCS — bloquant) · `raison_sociale` [CMP-FORM] (raison sociale lue = attendue selon la clé — **avertissement**, tolère les formes juridiques SARL/SAS/SCI… via `norm()` dans `Normaliser Kbis`) · `nom_dirigeant` [CMP-DOC] (**exploitant `kbis` seulement**, **avertissement**) : représentant légal du Kbis = nom lu sur la **CNI du dirigeant** — le front passe `form.dirigeantCni` = `cniDetectedName('dir')` et **re-déclenche `kbis`** quand la CNI du dirigeant vient d'être analysée (dans `doCniFaceCheck`) · `lisible` (bloquant). Présence : `kbis` toujours ; `kbis-prop` seulement si **locataire** (`propT==='non'`). *(La CNI recto/verso du dirigeant reste gérée par le nœud **CNI** — pas par KBIS — via `cniBlockReason`/`renderDirigeantDocs`.)*
  - **Aide UX** : la pièce Google Maps affiche un bouton « i » + info-bulle d'exemple (`mapsTipHTML(key)` injecté dans le titre de carte par `upgradeDocZones`, styles `.sun-tip*`).
- **Schéma dossier agrégé** (cible, non encore assemblé) : `{ dossierId, profil, statutGlobal, documents:[…], documentsManquants, pointsBloquants, syntheseHumaine }` — les verdicts par document (`docVerdicts` + CNI) en sont les briques.
- **Étendre (ajouter un type de document)** : *(front)* ajouter la clé dans `DOC_VERIFY` (+ `DOC_REFS` si contrôle croisé) ; *(n8n)* ajouter 2 nœuds Code (`Extraction <Type>` + `Normaliser <Type>`) et 1 branche à chacun des 2 Switch (`updateNodeParameters replace:true` avec toutes les règles), puis relier `Extraction <Type>` → `Analyse Claude Vision` (sortie du 1ᵉʳ Switch) et `Normaliser <Type>` → `Renvoie le verdict` (sortie du 2ᵉ Switch). Travailler sur le **brouillon**, vérifier via `get_workflow_details`, puis `publish_workflow`. Webhook/secret/proxy inchangés.
- **Texte des verdicts (n8n) = français correct, avec accents + apostrophes** : les chaînes **utilisateur** des nœuds `Normaliser *` (`libelle`, `detail`, `valeurAttendue`, `valeurConstatee`, `raison` de repli) doivent être accentuées (elles s'affichent sur les vignettes via `docFileVinfo`) — l'UTF-8 passe sans souci par `update_workflow` (le nom du workflow contient déjà des accents). **Restent en ASCII** (identifiants, jamais affichés) : les codes `regle` (`nom_form`, `pdl_coherent`…), les valeurs `type`/`statut`, et les littéraux comparés au modèle (`"taxe_fonciere"`, `"acte_notarie"`). Les **prompts d'extraction** (system) peuvent rester ASCII (non affichés). *(Correction 2026-07-13 : anciens nœuds passés en ASCII sans apostrophes — désormais tous accentués.)*

## Pièges connus

- **Webhook n8n** : doit être **actif** (sinon 404) et le secret Header Auth (`x-sl-secret`) doit correspondre **exactement** à `N8N_ID_WEBHOOK_SECRET` sur Vercel (sinon 403 « Authorization data is wrong »).
- **Variables Vercel** : prises en compte au **prochain build** → *Redeploy* après ajout.
- **Appel Claude (n8n)** : le nœud HTTP doit envoyer l'en-tête `anthropic-version: 2023-06-01` (le credential `anthropicApi` n'ajoute que `x-api-key`), sinon **400 « anthropic-version header is required »**. *(Historique : Gemini free tier bloquait en 429 quota=0.)*
- **Limite Vercel** : corps de requête entrant ≤ 4,5 Mo (d'où l'approche par ids pour `verifyid`).
- **Upload** : `onF` limite chaque fichier à 3 Mo (base64 ≈ 4 Mo).
