// middleware/auth.js — Vérifie le token JWT d'un commerçant et son statut (actif/désactivé)
const jwt = require('jsonwebtoken');
const { db } = require('../db');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erreur: "Authentification requise." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    if (payload.role && payload.role !== 'commercant') {
      return res.status(401).json({ erreur: "Session invalide." });
    }

    // Vérifie que le compte n'a pas été désactivé par un administrateur depuis la création du token
    const resultat = await db.execute({
      sql: 'SELECT actif FROM commercants WHERE id = ?',
      args: [payload.id]
    });
    const commercant = resultat.rows[0];
    if (!commercant) {
      return res.status(401).json({ erreur: "Compte introuvable." });
    }
    if (Number(commercant.actif) !== 1) {
      return res.status(403).json({ erreur: "Votre accès a été désactivé. Contactez votre administrateur." });
    }

    req.commercantId = payload.id;
    next();
  } catch (e) {
    return res.status(401).json({ erreur: "Session invalide ou expirée, veuillez vous reconnecter." });
  }
}

module.exports = requireAuth;
