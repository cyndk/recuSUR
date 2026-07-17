// routes/admin.js — Gestion des comptes commerçants par le super-administrateur
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const requireAdminAuth = require('../middleware/authAdmin');

const router = express.Router();
router.use(requireAdminAuth);

// GET /api/admin/commercants — Liste de tous les commerçants
router.get('/commercants', async (req, res) => {
  try {
    const resultat = await db.execute(`
      SELECT id, nom_entreprise, email, telephone, pays, actif, created_at
      FROM commercants ORDER BY created_at DESC
    `);
    res.json({
      commercants: resultat.rows.map(c => ({
        id: Number(c.id),
        nom_entreprise: c.nom_entreprise,
        email: c.email,
        telephone: c.telephone,
        pays: c.pays,
        actif: Number(c.actif) === 1,
        created_at: c.created_at
      }))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

// POST /api/admin/commercants/:id/desactiver — Révoque l'accès d'un commerçant
router.post('/commercants/:id/desactiver', async (req, res) => {
  try {
    await db.execute({
      sql: 'UPDATE commercants SET actif = 0 WHERE id = ?',
      args: [Number(req.params.id)]
    });
    res.json({ message: "Accès désactivé." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

// POST /api/admin/commercants/:id/activer — Rétablit l'accès d'un commerçant
router.post('/commercants/:id/activer', async (req, res) => {
  try {
    await db.execute({
      sql: 'UPDATE commercants SET actif = 1 WHERE id = ?',
      args: [Number(req.params.id)]
    });
    res.json({ message: "Accès rétabli." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

// POST /api/admin/commercants/:id/reinitialiser-mot-de-passe
// Génère (ou reçoit) un nouveau mot de passe pour un commerçant qui a oublié le sien.
router.post('/commercants/:id/reinitialiser-mot-de-passe', async (req, res) => {
  try {
    const nouveauMotDePasse = req.body.nouveau_mot_de_passe || genererMotDePasseTemporaire();

    if (nouveauMotDePasse.length < 6) {
      return res.status(400).json({ erreur: "Le mot de passe doit contenir au moins 6 caractères." });
    }

    const hash = bcrypt.hashSync(nouveauMotDePasse, 10);
    const resultat = await db.execute({
      sql: 'UPDATE commercants SET password_hash = ? WHERE id = ?',
      args: [hash, Number(req.params.id)]
    });

    if (resultat.rowsAffected === 0) {
      return res.status(404).json({ erreur: "Commerçant introuvable." });
    }

    // Le mot de passe en clair n'est jamais stocké : il est renvoyé une seule fois ici,
    // à l'administrateur, pour qu'il le communique lui-même au commerçant.
    res.json({ message: "Mot de passe réinitialisé.", nouveau_mot_de_passe: nouveauMotDePasse });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

function genererMotDePasseTemporaire() {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let motDePasse = '';
  for (let i = 0; i < 10; i++) {
    motDePasse += caracteres[Math.floor(Math.random() * caracteres.length)];
  }
  return motDePasse;
}

module.exports = router;
