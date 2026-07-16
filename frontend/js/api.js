// api.js — Communication avec le backend + gestion de la synchronisation hors-ligne

const API = (() => {
  // En développement local, le frontend est servi par le même serveur Express (voir README).
  const BASE_URL = window.location.origin + '/api';

  function token() {
    return localStorage.getItem('token');
  }

  async function requete(chemin, options = {}) {
    const entetes = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token()) entetes.Authorization = `Bearer ${token()}`;

    const reponse = await fetch(BASE_URL + chemin, { ...options, headers: entetes });
    const donnees = await reponse.json().catch(() => ({}));

    if (!reponse.ok) {
      throw new Error(donnees.erreur || 'Une erreur est survenue.');
    }
    return donnees;
  }

  // ---- Authentification ----
  function inscription(payload) {
    return requete('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  }
  function connexion(payload) {
    return requete('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
  }

  // ---- Ventes ----
  function resumeDashboard() {
    return requete('/ventes/dashboard/resume');
  }
  function listerVentes(filtres = {}) {
    const params = new URLSearchParams(filtres).toString();
    return requete('/ventes' + (params ? `?${params}` : ''));
  }

  // Crée une vente. Si la requête réseau échoue (hors-ligne), la vente est mise en file
  // d'attente locale et sera synchronisée automatiquement plus tard.
  async function creerVente(payload) {
    const clientIdOffline = payload.client_id_offline || crypto.randomUUID();
    const donneesCompletes = { ...payload, client_id_offline: clientIdOffline };

    try {
      const resultat = await requete('/ventes', { method: 'POST', body: JSON.stringify(donneesCompletes) });
      return { ...resultat, horsLigne: false };
    } catch (erreur) {
      // Si l'erreur vient du réseau (pas du serveur), on passe en mode hors-ligne
      const estErreurReseau = erreur instanceof TypeError || erreur.message === 'Failed to fetch';
      if (!estErreurReseau) throw erreur;

      await DBOffline.ajouterVenteEnAttente(donneesCompletes);
      const total = donneesCompletes.produits.reduce((s, p) => s + p.quantite * p.prix_unitaire, 0);
      return {
        vente: { ...donneesCompletes, total, numero_ticket: 'EN ATTENTE', id: null },
        horsLigne: true
      };
    }
  }

  // Tente de synchroniser toutes les ventes en attente stockées localement.
  async function synchroniserVentesEnAttente() {
    const enAttente = await DBOffline.listerVentesEnAttente();
    let succes = 0;
    for (const vente of enAttente) {
      try {
        await requete('/ventes', { method: 'POST', body: JSON.stringify(vente) });
        await DBOffline.supprimerVenteEnAttente(vente.client_id_offline);
        succes++;
      } catch (e) {
        // On arrête dès qu'une requête échoue encore (probablement toujours hors-ligne)
        break;
      }
    }
    return succes;
  }

  return {
    inscription, connexion, resumeDashboard, listerVentes, creerVente,
    synchroniserVentesEnAttente, token
  };
})();
