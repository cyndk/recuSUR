# 🧾 ReçuSûr — Preuves d'achat pour petits commerçants

Application SaaS simple permettant à un commerçant d'enregistrer une vente et de générer
instantanément un **ticket/reçu numérique fiable** (avec QR code de vérification), sans aucun
module de paiement en ligne. Conçue pour l'Afrique de l'Ouest : mobile-first, fonctionne
hors-ligne, interface ultra-simple.

---

## 1. Choix technique (et pourquoi)

| Composant | Choix | Justification |
|---|---|---|
| Frontend | **HTML/CSS/JavaScript vanilla** (aucun build) | Zéro compilation, se lance en ouvrant un simple fichier statique, très léger sur téléphones bas de gamme et connexions faibles. Pas besoin de Node côté client, pas de bundle à télécharger. |
| Stockage hors-ligne | **IndexedDB** | Fonctionne dans tous les navigateurs mobiles récents, capacité largement suffisante (contrairement à LocalStorage), permet une file d'attente de synchronisation. |
| Backend | **Node.js + Express** | Écosystème simple, un seul langage (JS) pour tout le projet, facile à déployer sur un petit VPS ou un hébergement gratuit (Render, Railway, Fly.io). |
| Base de données | **SQLite (better-sqlite3)** | Aucune installation de serveur de base de données requise, fichier unique, parfait pour un MVP et pour un hébergement à très faible coût. Migration vers PostgreSQL possible plus tard sans changer l'architecture (juste la couche `db.js`). |
| PDF | **jsPDF + html2canvas** | Génère un PDF à partir du rendu HTML du ticket, fonctionne côté client (pas de charge serveur). |
| QR Code | **qrcodejs** | Librairie légère, génération 100% côté client. |
| Authentification | **JWT (JSON Web Token) + bcrypt** | Simple, sans état côté serveur, chaque commerçant reste isolé (multi-tenant par `commercant_id`). |

**Architecture retenue : monolithe simple**, pas de microservices. À cette échelle (MVP, un
seul serveur, faible trafic), les microservices ajouteraient de la complexité opérationnelle
sans bénéfice réel. Un monolithe Express + SQLite est plus facile à déployer, déboguer et
maintenir par une petite équipe ou un développeur seul — ce qui correspond au contexte du projet.

---

## 2. Architecture du projet

```
ticket-saas/
├── backend/
│   ├── server.js              # Point d'entrée Express
│   ├── db.js                  # Connexion SQLite + schéma (commercants, ventes, compteurs_tickets)
│   ├── middleware/auth.js     # Vérification JWT
│   ├── routes/
│   │   ├── auth.js            # /api/auth/register, /api/auth/login
│   │   ├── ventes.js          # /api/ventes (CRUD, dashboard, historique)
│   │   └── public.js          # /api/verifier/:id (vérification publique du QR code)
│   └── package.json
├── frontend/
│   ├── index.html             # Application principale (SPA, templates HTML natifs)
│   ├── verifier.html          # Page publique ouverte lors du scan du QR code
│   ├── manifest.json          # Manifest PWA (installation sur écran d'accueil Android)
│   ├── css/style.css          # Design mobile-first, gros boutons, vert/blanc
│   └── js/
│       ├── api.js             # Appels au backend + logique de synchronisation hors-ligne
│       ├── db-offline.js      # Wrapper IndexedDB (file d'attente + cache)
│       ├── ticket.js          # Rendu du ticket, QR code, export PDF
│       └── app.js             # Routeur SPA + logique des formulaires
└── README.md
```

### Modèle de données

- **commercants** : `id, nom_entreprise, email, password_hash, telephone, pays`
- **ventes** : `id, commercant_id, numero_ticket, client_nom, client_telephone, produits_json,
  total, montant_recu, moyen_paiement, numero_transaction, date_heure, client_id_offline`
  — isolées par `commercant_id` (chaque commerçant ne voit que ses propres ventes)
- **compteurs_tickets** : compteur journalier par commerçant, utilisé pour générer le numéro de
  ticket au format `TKT-AAAA-MM-JJ-XXXX`

### Fonctionnement hors-ligne

1. Une vente est toujours **d'abord tentée** via l'API (`POST /api/ventes`).
2. Si la requête échoue pour une raison réseau, la vente est stockée dans IndexedDB avec un
   identifiant local unique (`client_id_offline`), et le ticket est affiché immédiatement avec la
   mention "EN ATTENTE".
3. Dès que le navigateur détecte le retour de la connexion (`window.addEventListener('online', …)`),
   toutes les ventes en attente sont renvoyées au serveur automatiquement.
4. Le champ `client_id_offline` (unique par commerçant) évite les doublons si une synchronisation
   est tentée deux fois.

### Vérification du QR code

Le QR code n'encode pas le numéro de ticket lisible (qui pourrait se répéter d'un commerçant à
l'autre) mais un lien vers `verifier.html?id=<id_interne>` — `id` étant l'identifiant unique en
base de la vente. Cette page appelle une route **publique** (`/api/verifier/:id`, sans
authentification) qui confirme l'authenticité du ticket sans exposer les autres ventes du
commerçant.

---

## 3. Installation et test en local

### Prérequis
- Node.js ≥ 18

### Étapes

```bash
cd ticket-saas/backend
npm install
cp .env.example .env      # puis modifier JWT_SECRET pour la production
npm start
```

Le serveur démarre sur **http://localhost:3000** et sert à la fois l'API (`/api/...`) et le
frontend (fichiers du dossier `frontend/`), donc il suffit d'ouvrir cette adresse dans un
navigateur (ou sur le téléphone, si le téléphone est sur le même réseau que l'ordinateur —
remplacer `localhost` par l'adresse IP locale de l'ordinateur, ex: `http://192.168.1.20:3000`).

### Scénario de test rapide
1. Ouvrir `http://localhost:3000`, onglet **Créer un compte**, remplir et valider.
2. Cliquer sur **➕ Nouvelle vente**, ajouter un ou plusieurs produits, choisir un moyen de
   paiement, valider.
3. Le ticket s'affiche avec QR code → tester **Imprimer**, **Télécharger PDF**, **Partager WhatsApp**.
4. Pour tester le mode hors-ligne : couper le Wi-Fi/données de l'appareil, créer une nouvelle
   vente (elle sera marquée "hors-ligne"), puis rétablir la connexion : elle se synchronise
   automatiquement (visible dans le tableau de bord).
5. Scanner le QR code d'un ticket avec un autre téléphone pour vérifier son authenticité.

---

## 4. Déploiement

- **Hébergement recommandé pour un MVP** : Render, Railway ou Fly.io (offres gratuites/faible coût,
  déploiement direct depuis Git, HTTPS automatique — indispensable pour la sécurité).
- Pour un usage 100% local (sans dépendre d'internet pour le commerçant), le serveur peut tourner
  sur un petit boîtier local (Raspberry Pi) connecté au même Wi-Fi que le téléphone du commerçant ;
  la synchronisation cloud peut alors se faire une fois par jour via un job planifié.
- Pensez à définir un `JWT_SECRET` fort en production (voir `.env.example`) et à toujours servir
  l'application en HTTPS.
- Les icônes PWA (`frontend/icons/icone-192.png`, `icone-512.png`) sont à fournir pour permettre
  l'installation sur l'écran d'accueil Android ; elles ne sont pas incluses dans ce MVP.

---

## 5. Suggestions d'amélioration (V2)

- **Multilingue** : ajouter des traductions locales (ex. Ewé, Wolof, Bambara, Mooré) en plus du
  français.
- **Impression Bluetooth directe** : intégration avec les imprimantes thermiques 80mm via
  Web Bluetooth, pour éviter de passer par un PDF.
- **Statistiques avancées** : ventes par semaine/mois, produits les plus vendus, export comptable.
- **Multi-utilisateurs par boutique** : permettre à un commerçant d'ajouter des employés avec des
  droits limités (ex: saisir des ventes sans voir les statistiques globales).
- **Notifications SMS** : envoyer automatiquement le lien du ticket par SMS si le client n'a pas
  WhatsApp (utile en zone rurale).
- **Vérification par SMS/USSD** : permettre de vérifier un ticket en envoyant son numéro par SMS,
  pour les clients sans smartphone.

---

## 6. Sécurité — rappel

- Aucune donnée bancaire n'est stockée ; les paiements se font entièrement hors système
  (espèces, mobile money) — seul le **numéro de transaction** est enregistré comme preuve.
- Chaque commerçant est isolé : toutes les requêtes de vente et d'historique sont filtrées par
  `commercant_id`, extrait du token JWT (jamais fourni par le client).
- Les mots de passe sont hashés avec bcrypt (jamais stockés en clair).
- En production, HTTPS est **obligatoire** (le trafic contient des numéros de téléphone).
