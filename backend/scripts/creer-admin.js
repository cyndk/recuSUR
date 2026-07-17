// scripts/creer-admin.js — Crée (ou met à jour) un compte super-administrateur.
// À exécuter vous-même, une seule fois, jamais accessible depuis le site public.
//
// Utilisation en local (base de données locale) :
//   node scripts/creer-admin.js admin@exemple.com MonMotDePasse123
//
// Utilisation contre la base de production (Turso) :
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/creer-admin.js admin@exemple.com MonMotDePasse123
//
// (Les valeurs TURSO_DATABASE_URL / TURSO_AUTH_TOKEN sont les mêmes que celles utilisées sur Render.)

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db, initialiserSchema } = require('../db');

async function main() {
  const [, , email, password] = process.argv;

  if (!email || !password) {
    console.error('Usage : node scripts/creer-admin.js <email> <mot_de_passe>');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Le mot de passe doit contenir au moins 6 caractères.');
    process.exit(1);
  }

  await initialiserSchema();

  const emailNormalise = email.toLowerCase();
  const hash = bcrypt.hashSync(password, 10);

  const existant = await db.execute({
    sql: 'SELECT id FROM admins WHERE email = ?',
    args: [emailNormalise]
  });

  if (existant.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE admins SET password_hash = ? WHERE email = ?',
      args: [hash, emailNormalise]
    });
    console.log(`✅ Mot de passe mis à jour pour l'administrateur ${emailNormalise}`);
  } else {
    await db.execute({
      sql: 'INSERT INTO admins (email, password_hash) VALUES (?, ?)',
      args: [emailNormalise, hash]
    });
    console.log(`✅ Compte administrateur créé : ${emailNormalise}`);
  }

  console.log('Vous pouvez maintenant vous connecter sur /admin.html avec ces identifiants.');
  process.exit(0);
}

main().catch((erreur) => {
  console.error('❌ Erreur :', erreur);
  process.exit(1);
});
