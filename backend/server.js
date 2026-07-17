// server.js — Point d'entrée de l'API
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initialiserSchema } = require('./db');

const authRoutes = require('./routes/auth');
const ventesRoutes = require('./routes/ventes');
const publicRoutes = require('./routes/public');
const adminAuthRoutes = require('./routes/adminAuth');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Sert le frontend statique (utile pour un déploiement simple, tout-en-un)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use('/api/auth', authRoutes);
app.use('/api/ventes', ventesRoutes);
app.use('/api/verifier', publicRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/sante', (req, res) => res.json({ statut: 'ok' }));

initialiserSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
    });
  })
  .catch((erreur) => {
    console.error("❌ Impossible d'initialiser la base de données :", erreur);
    process.exit(1);
  });
