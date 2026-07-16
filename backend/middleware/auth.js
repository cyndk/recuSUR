// middleware/auth.js — Vérifie le token JWT et attache le commerçant à la requête
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erreur: "Authentification requise." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.commercantId = payload.id;
    next();
  } catch (e) {
    return res.status(401).json({ erreur: "Session invalide ou expirée, veuillez vous reconnecter." });
  }
}

module.exports = requireAuth;
