// routes/adminAuth.js — Connexion des super-administrateurs.
// Il n'y a volontairement AUCUNE route d'inscription publique ici : les comptes admin se créent
// uniquement via le script scripts/creer-admin.js, exécuté par vous-même (voir README).
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ erreur: "Email et mot de passe requis." });
    }

    const resultat = await db.execute({
      sql: 'SELECT * FROM admins WHERE email = ?',
      args: [email.toLowerCase()]
    });
    const admin = resultat.rows[0];

    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      return res.status(401).json({ erreur: "Email ou mot de passe incorrect." });
    }

    const token = jwt.sign({ id: Number(admin.id), role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, admin: { id: Number(admin.id), email: admin.email } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erreur: "Erreur serveur lors de la connexion." });
  }
});

module.exports = router;
