// middleware/authAdmin.js — Vérifie le token JWT d'un super-admin
const jwt = require('jsonwebtoken');

function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erreur: "Authentification administrateur requise." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    if (payload.role !== 'admin') {
      return res.status(403).json({ erreur: "Accès réservé aux administrateurs." });
    }
    req.adminId = payload.id;
    next();
  } catch (e) {
    return res.status(401).json({ erreur: "Session administrateur invalide ou expirée." });
  }
}

module.exports = requireAdminAuth;
