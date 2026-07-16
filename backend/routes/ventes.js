// routes/ventes.js — Gestion des ventes / tickets (multi-tenant : chaque commerçant ne voit que ses ventes)
const express = require('express');
const { db } = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// Génère le prochain numéro de ticket au format TKT-AAAA-MM-JJ-XXXX pour un commerçant donné
async function genererNumeroTicket(commercantId) {
  const jour = new Date().toISOString().slice(0, 10); // AAAA-MM-JJ

  const tx = await db.transaction('write');
  try {
    const existant = await tx.execute({
      sql: 'SELECT dernier_numero FROM compteurs_tickets WHERE commercant_id = ? AND jour = ?',
      args: [commercantId, jour]
    });

    let prochain = 1;
    if (existant.rows.length > 0) {
      prochain = Number(existant.rows[0].dernier_numero) + 1;
      await tx.execute({
        sql: 'UPDATE compteurs_tickets SET dernier_numero = ? WHERE commercant_id = ? AND jour = ?',
        args: [prochain, commercantId, jour]
      });
    } else {
      await tx.execute({
        sql: 'INSERT INTO compteurs_tickets (commercant_id, jour, dernier_numero) VALUES (?, ?, 1)',
        args: [commercantId, jour]
      });
    }
    await tx.commit();
    const suffixe = String(prochain).padStart(4, '0');
    return `TKT-${jour}-${suffixe}`;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

// POST /api/ventes — Enregistrer une nouvelle vente et générer le ticket
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      client_nom, client_telephone, produits,
      montant_recu, moyen_paiement, numero_transaction,
      client_id_offline
    } = req.body;

    if (!client_nom || !Array.isArray(produits) || produits.length === 0 || !moyen_paiement) {
      return res.status(400).json({ erreur: "Nom du client, au moins un produit, et moyen de paiement sont obligatoires." });
    }

    const moyensMobile = ['Orange Money', 'Moov Money', 'MTN Mobile Money', 'Wave', 'Free Money'];
    if (moyensMobile.includes(moyen_paiement) && !numero_transaction) {
      return res.status(400).json({ erreur: "Le numéro de transaction est obligatoire pour un paiement mobile money." });
    }

    const total = produits.reduce((somme, p) => somme + (Number(p.quantite) * Number(p.prix_unitaire)), 0);

    // Évite les doublons si le client re-soumet la même vente hors-ligne (idempotence simple)
    if (client_id_offline) {
      const dejaExistant = await db.execute({
        sql: 'SELECT * FROM ventes WHERE commercant_id = ? AND client_id_offline = ?',
        args: [req.commercantId, client_id_offline]
      });
      if (dejaExistant.rows.length > 0) {
        return res.status(200).json({ vente: formatVente(dejaExistant.rows[0]) });
      }
    }

    const numeroTicket = await genererNumeroTicket(req.commercantId);
    const dateHeure = new Date().toISOString();

    const resultat = await db.execute({
      sql: `INSERT INTO ventes (
              commercant_id, numero_ticket, client_nom, client_telephone,
              produits_json, total, montant_recu, moyen_paiement,
              numero_transaction, date_heure, client_id_offline
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        req.commercantId, numeroTicket, client_nom, client_telephone || null,
        JSON.stringify(produits), total, montant_recu || null, moyen_paiement,
        numero_transaction || null, dateHeure, client_id_offline || null
      ]
    });

    const vente = await db.execute({
      sql: 'SELECT * FROM ventes WHERE id = ?',
      args: [Number(resultat.lastInsertRowid)]
    });

    res.status(201).json({ vente: formatVente(vente.rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erreur: "Erreur serveur lors de l'enregistrement de la vente." });
  }
});

// GET /api/ventes — Historique des ventes du commerçant connecté (filtres optionnels)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { date, client, numero_ticket } = req.query;
    let sql = 'SELECT * FROM ventes WHERE commercant_id = ?';
    const args = [req.commercantId];

    if (date) {
      sql += ' AND date(date_heure) = date(?)';
      args.push(date);
    }
    if (client) {
      sql += ' AND client_nom LIKE ?';
      args.push(`%${client}%`);
    }
    if (numero_ticket) {
      sql += ' AND numero_ticket LIKE ?';
      args.push(`%${numero_ticket}%`);
    }
    sql += ' ORDER BY date_heure DESC';

    const resultat = await db.execute({ sql, args });
    res.json({ ventes: resultat.rows.map(formatVente) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erreur: "Erreur serveur lors de la récupération de l'historique." });
  }
});

// GET /api/ventes/dashboard/resume — Statistiques du jour
router.get('/dashboard/resume', requireAuth, async (req, res) => {
  try {
    const aujourdHui = new Date().toISOString().slice(0, 10);

    const stats = await db.execute({
      sql: `SELECT COUNT(*) AS nombre_ventes, COALESCE(SUM(total), 0) AS chiffre_affaires
            FROM ventes WHERE commercant_id = ? AND date(date_heure) = date(?)`,
      args: [req.commercantId, aujourdHui]
    });

    const dernieresVentes = await db.execute({
      sql: 'SELECT * FROM ventes WHERE commercant_id = ? ORDER BY date_heure DESC LIMIT 5',
      args: [req.commercantId]
    });

    res.json({
      nombre_ventes_jour: Number(stats.rows[0].nombre_ventes),
      chiffre_affaires_jour: Number(stats.rows[0].chiffre_affaires),
      dernieres_ventes: dernieresVentes.rows.map(formatVente)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erreur: "Erreur serveur lors du chargement du tableau de bord." });
  }
});

// GET /api/ventes/:numero_ticket — Détail d'un ticket (accès du commerçant, pour ré-impression/PDF)
router.get('/:numero_ticket', requireAuth, async (req, res) => {
  try {
    const resultat = await db.execute({
      sql: 'SELECT * FROM ventes WHERE commercant_id = ? AND numero_ticket = ?',
      args: [req.commercantId, req.params.numero_ticket]
    });

    if (resultat.rows.length === 0) return res.status(404).json({ erreur: "Ticket introuvable." });
    res.json({ vente: formatVente(resultat.rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

function formatVente(v) {
  return {
    id: Number(v.id),
    numero_ticket: v.numero_ticket,
    client_nom: v.client_nom,
    client_telephone: v.client_telephone,
    produits: JSON.parse(v.produits_json),
    total: v.total,
    montant_recu: v.montant_recu,
    moyen_paiement: v.moyen_paiement,
    numero_transaction: v.numero_transaction,
    date_heure: v.date_heure
  };
}

module.exports = router;
