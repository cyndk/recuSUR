// routes/public.js — Vérification publique d'un ticket via QR code (aucune authentification requise)
// Le QR code encode l'identifiant interne (unique dans toute la base) pour permettre
// à n'importe qui de vérifier l'authenticité d'un ticket sans connaître le commerçant.
const express = require('express');
const { db } = require('../db');

const router = express.Router();

// GET /api/verifier/:id
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ valide: false, erreur: "Identifiant de ticket invalide." });
    }

    const resultat = await db.execute({
      sql: `SELECT v.numero_ticket, v.total, v.date_heure, v.moyen_paiement, c.nom_entreprise
            FROM ventes v JOIN commercants c ON c.id = v.commercant_id
            WHERE v.id = ?`,
      args: [id]
    });

    const vente = resultat.rows[0];
    if (!vente) {
      return res.status(404).json({ valide: false, message: "Aucun ticket correspondant. Ce document pourrait ne pas être authentique." });
    }

    res.json({
      valide: true,
      numero_ticket: vente.numero_ticket,
      entreprise: vente.nom_entreprise,
      date_heure: vente.date_heure,
      total: vente.total,
      moyen_paiement: vente.moyen_paiement,
      message: "Ce ticket est authentique et a été enregistré dans le système."
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ valide: false, erreur: "Erreur serveur." });
  }
});

module.exports = router;
