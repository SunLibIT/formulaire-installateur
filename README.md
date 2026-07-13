# formulaire-installateur

Formulaire de saisie de dossier abonné — **espace installateur partenaire SunLib**.

Widget web mono-fichier (HTML/CSS/JS vanilla, sans framework) intégré dans Softr via une iframe, avec une fonction serverless Vercel qui enregistre les dossiers (brouillons + documents) dans Airtable.

- **Production** : <https://formulaire-installateur.vercel.app>
- **Embarqué dans** : Softr (espace installateur), via un bloc *Custom Code* (iframe).
- **Doc Notion** : *Documentation Technique → Formulaire Saisie Abonné — Espace Installateur (Softr)*.

---

## Architecture

| Élément | Rôle |
|---|---|
| `index.html` | Tout le widget : UI, styles (scopés `#sl-root`, `!important`), logique JS. Chargé tel quel comme page d'iframe. |
| `api/drafts.js` | Fonction serverless Vercel : proxy Airtable (le token reste **côté serveur**). Lecture/écriture des brouillons, journal des sessions, upload des pièces jointes. |

Le widget est un assistant (wizard) multi-étapes :

- **Accueil** (`#sl-home`) : liste des dossiers en cours de l'installateur connecté + « Nouveau dossier ».
- **Étapes** : `FLOW_PART=[1,2,4,5,6]` (particulier) / `FLOW_PRO=[1,2,3,4,5,6]` (pro) → Type · Identité (abonnés/entreprise) · *(collaborateurs pro)* · Adresse (Google Maps) · Installation · Documents + Récapitulatif.

### Fonctionnalités clés
- **Brouillons** : enregistrement serveur (upsert sur `ID Brouillon`) ; reprise qui restaure **l'intégralité** des champs (snapshot complet), le type d'installation, l'adresse/carte, les abonnés/collaborateurs et les documents fournis.
- **Documents** : uploadés directement en pièces jointes Airtable (champ `Documents`), ≤ 3 Mo/fichier (au-delà : « Fichier trop lourd »). Deux portées — **documents du projet** (communs) et **documents des abonnés** (CNI **recto + verso par personne**, vérifiée par IA face par face). Liste complète et contrôles → [Documents & contrôles](#documents--contrôles).
- **Adresse** : autocomplétion BAN (`api-adresse.data.gouv.fr`) + carte Google Maps satellite avec marqueur déplaçable.
- **Pro** : recherche SIREN (préremplissage entreprise/dirigeant).
- **Resize iframe** : la hauteur réelle est postée au parent (`postMessage({iframeHeight})`), anti-boucle.

---

## Documents & contrôles

Deux **portées** de documents :
- **Documents du projet** (communs au dossier) — cartes multi-fichiers (« Ajouter un document »).
- **Documents des abonnés** — la **CNI de chaque personne**, en **deux emplacements séparés : recto et verso** (un fichier chacun). L'étape affiche une carte par abonné (nom + email + progression « X/2 »).

**Contrôles génériques (toutes les pièces) :**
- **Format** : filtré par l'attribut `accept` du sélecteur — **PDF seul** ou **PDF / JPG / PNG** selon la pièce (filtre natif du navigateur, non revérifié ensuite).
- **Poids** : refusé si **> 3 Mo** → message « Fichier trop lourd » (la limite n'est pas affichée).
- **Aucune analyse de contenu, sauf la CNI.**

**Documents demandés, par type de client :**

| Document | Portée | Particulier | Pro | Formats | Contrôle du contenu |
|---|---|:---:|:---:|---|---|
| CNI de chaque abonné — **recto + verso séparés** | abonné | ✅ | — | PDF/JPG/PNG | **IA par face** (voir ci-dessous) |
| Copie d'écran Google Maps — toiture | dossier | ✅ | ✅ | PDF/JPG/PNG | — |
| Étude personnalisée + calepinage PV | dossier | ✅ | ✅ | PDF/JPG/PNG | — |
| Devis d'abonnement — Modèle SunLib | dossier | ✅ | ✅ | PDF | — |
| Avis d'imposition — 4 pages ³ | dossier | ✅ | — | PDF | — |
| Facture d'énergie de référence | dossier | ✅ | — | PDF/JPG/PNG | — |
| Titre de propriété | dossier | ✅ | — | PDF | **IA** (voir ci-dessous) |
| Fiche technique batterie ¹ | dossier | ✅ | — | PDF/JPG/PNG | — |
| Extrait Kbis (moins de 3 mois) ² | dossier | — | ✅ | PDF | — |

¹ Uniquement pour une installation « PV + batterie physique » ou « batterie seule ».
² « moins de 3 mois » est une consigne affichée, pas un contrôle automatique.
³ Un seul avis au niveau du dossier (le regroupement par foyer fiscal n'est pas modélisé).

**Contrôle IA de la CNI** (particuliers uniquement — workflow n8n + Claude vision) :

- **Analyse asynchrone par face** : le recto et le verso sont analysés indépendamment, dès leur dépôt (chaque emplacement affiche son propre statut : *en analyse* → *vérifié* / *à revoir*).
- **Bloque la création du dossier si**, pour un abonné : recto **ou** verso manquant · un fichier illisible/flou · ce n'est pas une pièce d'identité · pièce non française · personne de **plus de 75 ans** · pièce **périmée** (avec la règle FR : CNI délivrée à un majeur entre 2004 et 2013 = validité + 5 ans).
- **Avertissement non bloquant si** : recto et verso **inversés** (l'emplacement ne correspond pas à la face détectée) · nom détecté ≠ abonné.
- **Dégradé** : si l'IA est indisponible, le recto + verso restent exigés mais les contrôles de contenu **ne bloquent pas**.

**Contrôle IA des autres documents** (généralisé, 1ᵉʳ couvert : le **titre de propriété**) :

- Chaque document concerné est analysé **à son dépôt** ; la carte affiche *en analyse → conforme / à vérifier / à revoir* + le détail des points à corriger.
- Les données lues sont comparées aux **informations déjà saisies dans le formulaire** (nom de l'abonné, adresse du bien) — pas de CRM externe.
- **Titre de propriété** — bloque la création si : ce n'est pas un **acte notarié** ou une **taxe foncière** · le **nom** ne correspond pas à l'abonné · l'**adresse** ne correspond pas au dossier · (taxe foncière) **pages manquantes** · document **illisible**. IA indisponible → non bloquant.

---

## Déploiement (Vercel)

Vercel **redéploie automatiquement** à chaque push sur `main`.

> Le remote `origin` est en **SSH** (`git@github.com:SunLibIT/formulaire-installateur.git`) — le compte qui pousse doit avoir les droits Write sur l'org `SunLibIT`.

### Variables d'environnement (Vercel → Settings → Environment Variables)
| Variable | Obligatoire | Description |
|---|---|---|
| `AIRTABLE_TOKEN` | ✅ | Personal Access Token Airtable, scopes `data.records:read` + `data.records:write`, accès à la base. |
| `AIRTABLE_BASE_ID` | ❌ | Défaut : `appmroXyuCrYwDbM7`. |
| `ALLOW_ORIGIN` | ❌ | Origine Softr autorisée (CORS) ; défaut `*`. |

> ⚠️ Une nouvelle variable n'est prise en compte qu'au **build suivant** → relancer un *Redeploy* après l'avoir ajoutée.

---

## Airtable

Base `appmroXyuCrYwDbM7` :

| Table | Contenu |
|---|---|
| `Particulier` / `Pro` | 1 ligne par dossier, upsert sur `ID Brouillon`. Champs métier (email installateur, statut, étape, adresse, type d'installation, mensualité…), snapshot JSON complet dans `Données JSON`, et pièces jointes dans `Documents`. |
| `Sessions` | 1 ligne par email installateur : `Date accès`, `Device`, liens vers les brouillons (Particulier/Pro). |

### API `/api/drafts`
| Méthode | Action |
|---|---|
| `GET ?email=` | Liste les dossiers « En cours » de l'installateur (Particulier + Pro), payload complet inclus pour la reprise. |
| `POST` (body = payload) | Upsert du brouillon dans la bonne table. |
| `POST` (`action:"upload"`) | Upload d'un document dans le champ `Documents`. |
| `DELETE ?id=&type=` | Supprime un brouillon. |

---

## Intégration Softr

Coller dans un bloc **Custom Code** (page protégée, réservée aux utilisateurs connectés). L'iframe se charge immédiatement (aperçu OK) et reçoit l'email de l'installateur connecté par `postMessage`, sans rechargement :

```html
<div style="width:100%;">
  <iframe id="sl-iframe" src="https://formulaire-installateur.vercel.app/"
          style="width:100%;border:0;display:block;height:900px;"
          scrolling="no" allow="geolocation" title="Formulaire installateur SunLib"></iframe>
</div>
<script>
(function () {
  var f = document.getElementById("sl-iframe");
  function getEmail(){ var u = window.logged_in_user; return (u && u.softr_user_email) ? u.softr_user_email : ""; }
  function pushEmail(){ var e = getEmail(); if (e && f.contentWindow) f.contentWindow.postMessage({ slEmail: e }, "*"); }
  var last = 0, tries = 0;
  window.addEventListener("message", function (e) {
    var d = e && e.data; if (!d) return;
    if (d.slReady) pushEmail();
    var h = d.iframeHeight;
    if (typeof h === "number" && isFinite(h) && h >= 200 && h <= 6000 && Math.abs(h - last) > 1) { last = h; f.style.height = h + "px"; }
  }, false);
  var t = setInterval(function () { tries++; if (getEmail()) { pushEmail(); clearInterval(t); } if (tries > 40) clearInterval(t); }, 250);
})();
</script>
```

L'email Softr provient de `window.logged_in_user.softr_user_email`. Le garde-fou de hauteur ignore les valeurs aberrantes et ne réagit qu'aux vrais changements.

---

## Développement

Pas de build : `index.html` s'ouvre directement dans un navigateur. Sans `?email=`, un email de repli (`romain@sunlib.fr`) est utilisé en local.

Vérifier la syntaxe du bloc JS avant un commit :
```bash
# extraire le <script> de index.html et le passer à node --check
node --check api/drafts.js
```

Conventions : tout le CSS est scopé sous `#sl-root` avec `!important` (résiste aux styles injectés par Softr) ; aucune dépendance externe (hors Google Maps chargé à la demande).
