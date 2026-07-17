// routes/auth.js — Inscription et connexion des commerçants
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { nom_entreprise, email, password, telephone, pays } = req.body;

    if (!nom_entreprise || !email || !password) {
      return res.status(400).json({ erreur: "Nom de l'entreprise, email et mot de passe sont obligatoires." });
    }
    if (password.length < 6) {
      return res.status(400).json({ erreur: "Le mot de passe doit contenir au moins 6 caractères." });
    }

    const emailNormalise = email.toLowerCase();
    const existant = await db.execute({
      sql: 'SELECT id FROM commercants WHERE email = ?',
      args: [emailNormalise]
    });
    if (existant.rows.length > 0) {
      return res.status(409).json({ erreur: "Un compte existe déjà avec cet email." });
    }

    const hash = bcrypt.hashSync(password, 10);
    const resultat = await db.execute({
      sql: `INSERT INTO commercants (nom_entreprise, email, password_hash, telephone, pays)
            VALUES (?, ?, ?, ?, ?)`,
      args: [nom_entreprise, emailNormalise, hash, telephone || null, pays || 'Togo']
    });

    const commercant = { id: Number(resultat.lastInsertRowid), nom_entreprise, email: emailNormalise };
    const token = jwt.sign({ id: commercant.id, role: 'commercant' }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({ token, commercant });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erreur: "Erreur serveur lors de l'inscription." });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ erreur: "Email et mot de passe requis." });
    }

    const resultat = await db.execute({
      sql: 'SELECT * FROM commercants WHERE email = ?',
      args: [email.toLowerCase()]
    });
    const commercant = resultat.rows[0];

    if (!commercant || !bcrypt.compareSync(password, commercant.password_hash)) {
      return res.status(401).json({ erreur: "Email ou mot de passe incorrect." });
    }
    if (Number(commercant.actif) !== 1) {
      return res.status(403).json({ erreur: "Votre accès a été désactivé. Contactez votre administrateur." });
    }

    const token = jwt.sign({ id: Number(commercant.id), role: 'commercant' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      commercant: {
        id: Number(commercant.id),
        nom_entreprise: commercant.nom_entreprise,
        email: commercant.email,
        telephone: commercant.telephone,
        pays: commercant.pays
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erreur: "Erreur serveur lors de la connexion." });
  }
});

module.exports = router;
