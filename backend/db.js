// db.js — Connexion à la base de données (libSQL : compatible SQLite).
// En local : utilise un simple fichier (aucune configuration nécessaire).
// En production : utilise Turso (base SQLite hébergée gratuitement et de façon permanente),
// simplement en définissant TURSO_DATABASE_URL et TURSO_AUTH_TOKEN dans les variables d'environnement.
const { createClient } = require('@libsql/client');
const path = require('path');

const url = process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, 'database.sqlite')}`;
const authToken = process.env.TURSO_AUTH_TOKEN; // absent en local, requis avec Turso

const db = createClient(authToken ? { url, authToken } : { url });

// Crée les tables si elles n'existent pas encore (appelé une fois au démarrage du serveur)
async function initialiserSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS commercants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom_entreprise TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      telephone TEXT,
      pays TEXT DEFAULT 'Togo',
      actif INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration : ajoute la colonne "actif" si la table existait déjà avant cette fonctionnalité
  // (échoue silencieusement si la colonne existe déjà, ce qui est normal sur une base neuve).
  try {
    await db.execute(`ALTER TABLE commercants ADD COLUMN actif INTEGER NOT NULL DEFAULT 1`);
  } catch (e) {
    // "duplicate column name" attendu si la colonne existe déjà — on l'ignore
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ventes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commercant_id INTEGER NOT NULL,
      numero_ticket TEXT NOT NULL,
      client_nom TEXT NOT NULL,
      client_telephone TEXT,
      produits_json TEXT NOT NULL,
      total REAL NOT NULL,
      montant_recu REAL,
      moyen_paiement TEXT NOT NULL,
      numero_transaction TEXT,
      date_heure TEXT NOT NULL,
      client_id_offline TEXT,
      FOREIGN KEY (commercant_id) REFERENCES commercants(id),
      UNIQUE (commercant_id, numero_ticket)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS compteurs_tickets (
      commercant_id INTEGER NOT NULL,
      jour TEXT NOT NULL,
      dernier_numero INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (commercant_id, jour)
    );
  `);
}

module.exports = { db, initialiserSchema };
