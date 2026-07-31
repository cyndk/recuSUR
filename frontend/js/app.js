// app.js — Logique principale de l'application (routage, formulaires, état)

const App = (() => {
  const zoneApp = document.getElementById('app');
  const navConnecte = document.getElementById('nav-connecte');
  const fabNouvelleVente = document.getElementById('fab-nouvelle-vente');
  const toastConteneur = document.getElementById('toast-conteneur');
  let commercant = JSON.parse(localStorage.getItem('commercant') || 'null');
  let derniereVenteAffichee = null;
  let derniereVenteVientDetreCreee = false;

  // ---------------- Routage ----------------
  function naviguer(route) {
    if (!API.token() && route !== 'login') route = 'login';
    window.location.hash = route;
  }

  function routeActuelle() {
    return (window.location.hash || '#login').replace('#', '');
  }

  async function rendre() {
    const route = routeActuelle();
    const connecte = API.token() && route !== 'login';
    navConnecte.style.display = connecte ? 'flex' : 'none';
    document.getElementById('btn-theme-deconnecte').style.display = connecte ? 'none' : 'flex';

    // Le bouton flottant "Nouvelle vente" n'est utile que sur Accueil et Historique
    fabNouvelleVente.classList.toggle('cache', !(connecte && (route === 'dashboard' || route === 'historique')));

    if (!API.token() && route !== 'login') {
      zoneApp.innerHTML = '';
      afficherTemplate('tpl-login');
      brancherFormulairesAuth();
      return;
    }

    switch (route) {
      case 'login':
        afficherTemplate('tpl-login');
        brancherFormulairesAuth();
        break;
      case 'dashboard':
        afficherTemplate('tpl-dashboard');
        await chargerDashboard();
        break;
      case 'nouvelle-vente':
        afficherTemplate('tpl-nouvelle-vente');
        brancherFormulaireVente();
        break;
      case 'historique':
        afficherTemplate('tpl-historique');
        brancherHistorique();
        await chargerHistorique();
        break;
      case 'ticket':
        afficherTemplate('tpl-ticket');
        if (derniereVenteAffichee) {
          Ticket.afficher(derniereVenteAffichee, commercant);
          brancherActionsTicket(derniereVenteAffichee);
          document.getElementById('confirmation-vente').classList.toggle('cache', !derniereVenteVientDetreCreee);
          derniereVenteVientDetreCreee = false;
        } else {
          naviguer('dashboard');
        }
        break;
      default:
        naviguer('dashboard');
    }
  }

  function afficherTemplate(idTemplate) {
    const tpl = document.getElementById(idTemplate);
    zoneApp.innerHTML = '';
    zoneApp.appendChild(tpl.content.cloneNode(true));
    // Boutons de navigation génériques présents dans le template affiché
    zoneApp.querySelectorAll('[data-route]').forEach(bouton => {
      bouton.addEventListener('click', () => naviguer(bouton.dataset.route));
    });
  }

  // ---------------- Thème (clair / sombre) ----------------
  function appliquerTheme(theme) {
    if (theme === 'sombre') {
      document.documentElement.setAttribute('data-theme', 'sombre');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', theme);
    document.querySelectorAll('.btn-theme').forEach(b => b.textContent = theme === 'sombre' ? '☀️' : '🌙');
  }

  function brancherBoutonsTheme() {
    const themeActuel = localStorage.getItem('theme') === 'sombre' ? 'sombre' : 'clair';
    appliquerTheme(themeActuel);
    document.querySelectorAll('.btn-theme').forEach(bouton => {
      bouton.addEventListener('click', () => {
        const nouveauTheme = document.documentElement.getAttribute('data-theme') === 'sombre' ? 'clair' : 'sombre';
        appliquerTheme(nouveauTheme);
      });
    });
  }

  // ---------------- Toast (confirmation animée) ----------------
  function afficherToast(message, icone = '✅') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-icone">${icone}</span><span>${escapeHtml(message)}</span>`;
    toastConteneur.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  // ---------------- Authentification ----------------
  function brancherFormulairesAuth() {
    const onglets = zoneApp.querySelectorAll('.onglet');
    const formConnexion = document.getElementById('form-connexion');
    const formInscription = document.getElementById('form-inscription');

    onglets.forEach(onglet => {
      onglet.addEventListener('click', () => {
        onglets.forEach(o => o.classList.remove('actif'));
        onglet.classList.add('actif');
        if (onglet.dataset.onglet === 'connexion') {
          formConnexion.classList.remove('cache');
          formInscription.classList.add('cache');
        } else {
          formInscription.classList.remove('cache');
          formConnexion.classList.add('cache');
        }
      });
    });

    formConnexion.addEventListener('submit', async (e) => {
      e.preventDefault();
      const donnees = Object.fromEntries(new FormData(formConnexion));
      const erreurEl = document.getElementById('erreur-connexion');
      erreurEl.textContent = '';
      try {
        const resultat = await API.connexion(donnees);
        connecter(resultat);
      } catch (err) {
        erreurEl.textContent = err.message;
      }
    });

    formInscription.addEventListener('submit', async (e) => {
      e.preventDefault();
      const donnees = Object.fromEntries(new FormData(formInscription));
      const erreurEl = document.getElementById('erreur-inscription');
      erreurEl.textContent = '';
      try {
        const resultat = await API.inscription(donnees);
        connecter(resultat, true);
      } catch (err) {
        erreurEl.textContent = err.message;
      }
    });
  }

  function connecter({ token, commercant: c }, estNouveauCompte = false) {
    localStorage.setItem('token', token);
    localStorage.setItem('commercant', JSON.stringify(c));
    commercant = c;
    naviguer('dashboard');
    rendre();

    const cleTutoriel = `tutoriel_vu_${c.id}`;
    if (estNouveauCompte || !localStorage.getItem(cleTutoriel)) {
      setTimeout(() => afficherTutoriel(cleTutoriel), 400);
    }
  }

  document.getElementById('btn-deconnexion').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('commercant');
    commercant = null;
    naviguer('login');
  });

  // ---------------- Tutoriel de bienvenue (3 étapes) ----------------
  const etapesTutoriel = [
    { icone: '➕', titre: 'Enregistrez une vente', texte: "Appuyez sur « Nouvelle vente », ajoutez les produits achetés et choisissez le moyen de paiement du client." },
    { icone: '🧾', titre: 'Un ticket fiable, instantané', texte: "Un ticket avec QR code est généré aussitôt. Partagez-le par WhatsApp, imprimez-le, ou téléchargez-le en PDF." },
    { icone: '📴', titre: 'Même sans connexion', texte: "Pas de réseau ? Aucun problème : la vente est enregistrée sur votre téléphone et se synchronise automatiquement au retour d'internet." }
  ];

  function afficherTutoriel(cleTutoriel) {
    const tpl = document.getElementById('tpl-tutoriel');
    const noeud = tpl.content.cloneNode(true);
    document.body.appendChild(noeud);

    const fond = document.getElementById('tutoriel-fond');
    const icone = document.getElementById('tutoriel-icone');
    const titre = document.getElementById('tutoriel-titre');
    const texte = document.getElementById('tutoriel-texte');
    const points = fond.querySelectorAll('.tutoriel-point');
    const btnSuivant = document.getElementById('tutoriel-suivant');
    const btnPasser = document.getElementById('tutoriel-passer');

    let etape = 0;
    function afficherEtape() {
      const e = etapesTutoriel[etape];
      icone.textContent = e.icone;
      titre.textContent = e.titre;
      texte.textContent = e.texte;
      points.forEach((p, i) => p.classList.toggle('actif', i === etape));
      btnSuivant.textContent = etape === etapesTutoriel.length - 1 ? 'Terminer' : 'Suivant';
    }

    function fermer() {
      localStorage.setItem(cleTutoriel, '1');
      fond.remove();
    }

    btnSuivant.addEventListener('click', () => {
      if (etape < etapesTutoriel.length - 1) {
        etape++;
        afficherEtape();
      } else {
        fermer();
      }
    });
    btnPasser.addEventListener('click', fermer);

    afficherEtape();
  }

  // ---------------- Dashboard ----------------
  async function chargerDashboard() {
    document.getElementById('nom-commercant').textContent = commercant ? commercant.nom_entreprise : '';
    try {
      const resume = await API.resumeDashboard();
      document.getElementById('stat-nombre-ventes').textContent = resume.nombre_ventes_jour;
      document.getElementById('stat-chiffre-affaires').textContent = Ticket.formaterMontant(resume.chiffre_affaires_jour);
      document.getElementById('stat-total-cumule').textContent = Ticket.formaterMontant(resume.chiffre_affaires_total);
      afficherListeVentes('liste-dernieres-ventes', resume.dernieres_ventes);
    } catch (e) {
      // Hors-ligne : on affiche les ventes en cache local + celles en attente
      const cache = await DBOffline.listerVentesEnCache();
      const enAttente = await DBOffline.listerVentesEnAttente();
      document.getElementById('stat-nombre-ventes').textContent = '—';
      document.getElementById('stat-chiffre-affaires').textContent = '—';
      document.getElementById('stat-total-cumule').textContent = '—';
      const combinees = [...enAttente.map(v => ({ ...v, numero_ticket: 'EN ATTENTE', date_heure: new Date().toISOString() })), ...cache]
        .slice(0, 5);
      afficherListeVentes('liste-dernieres-ventes', combinees);
    }
  }

  function afficherListeVentes(idConteneur, ventes) {
    const conteneur = document.getElementById(idConteneur);
    conteneur.innerHTML = '';
    if (!ventes || ventes.length === 0) {
      conteneur.innerHTML = '<p style="color:#888;text-align:center;">Aucune vente pour le moment.</p>';
      return;
    }
    ventes.forEach(v => {
      const item = document.createElement('div');
      item.className = 'item-vente';
      const enAttenteBadge = v.numero_ticket === 'EN ATTENTE' ? '<span class="badge-hors-ligne">hors-ligne</span>' : '';
      item.innerHTML = `
        <div class="item-vente-info">
          <span class="item-vente-client">${escapeHtml(v.client_nom)}</span>
          <span class="item-vente-meta">${v.numero_ticket}${enAttenteBadge}</span>
        </div>
        <span class="item-vente-montant">${Ticket.formaterMontant(v.total)}</span>
      `;
      item.addEventListener('click', () => {
        derniereVenteAffichee = v;
        derniereVenteVientDetreCreee = false;
        naviguer('ticket');
      });
      conteneur.appendChild(item);
    });
  }

  function escapeHtml(texte) {
    const div = document.createElement('div');
    div.textContent = texte;
    return div.innerHTML;
  }

  // ---------------- Nouvelle vente ----------------
  function brancherFormulaireVente() {
    const listeProduits = document.getElementById('liste-produits');
    const tplLigne = document.getElementById('tpl-ligne-produit');
    const form = document.getElementById('form-vente');
    const selectMoyenPaiement = document.getElementById('select-moyen-paiement');
    const champTransaction = document.getElementById('champ-numero-transaction');
    const moyensMobile = ['Orange Money', 'Moov Money', 'MTN Mobile Money', 'Wave', 'Free Money'];

    function ajouterLigneProduit() {
      const ligne = tplLigne.content.cloneNode(true);
      const div = ligne.querySelector('.ligne-produit');
      div.querySelectorAll('input').forEach(input => input.addEventListener('input', recalculerTotal));
      div.querySelector('.btn-supprimer-produit').addEventListener('click', () => {
        div.remove();
        recalculerTotal();
      });
      listeProduits.appendChild(ligne);
    }

    function recalculerTotal() {
      let total = 0;
      listeProduits.querySelectorAll('.ligne-produit').forEach(ligne => {
        const qte = Number(ligne.querySelector('.produit-quantite').value) || 0;
        const prix = Number(ligne.querySelector('.produit-prix').value) || 0;
        total += qte * prix;
      });
      document.getElementById('total-vente').textContent = Ticket.formaterMontant(total);
    }

    document.getElementById('btn-ajouter-produit').addEventListener('click', ajouterLigneProduit);
    ajouterLigneProduit(); // Une première ligne par défaut

    selectMoyenPaiement.addEventListener('change', () => {
      const estMobile = moyensMobile.includes(selectMoyenPaiement.value);
      champTransaction.classList.toggle('cache', !estMobile);
      champTransaction.querySelector('input').required = estMobile;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const erreurEl = document.getElementById('erreur-vente');
      erreurEl.textContent = '';

      const produits = [...listeProduits.querySelectorAll('.ligne-produit')].map(ligne => ({
        nom: ligne.querySelector('.produit-nom').value.trim(),
        quantite: Number(ligne.querySelector('.produit-quantite').value),
        prix_unitaire: Number(ligne.querySelector('.produit-prix').value)
      }));

      if (produits.length === 0 || produits.some(p => !p.nom || p.quantite <= 0 || p.prix_unitaire < 0)) {
        erreurEl.textContent = "Veuillez remplir correctement tous les produits.";
        return;
      }

      const donneesForm = Object.fromEntries(new FormData(form));
      const payload = {
        client_nom: donneesForm.client_nom,
        client_telephone: donneesForm.client_telephone || null,
        produits,
        montant_recu: donneesForm.montant_recu ? Number(donneesForm.montant_recu) : null,
        moyen_paiement: donneesForm.moyen_paiement,
        numero_transaction: donneesForm.numero_transaction || null
      };

      try {
        const resultat = await API.creerVente(payload);
        derniereVenteAffichee = resultat.vente;
        derniereVenteVientDetreCreee = true;
        if (resultat.horsLigne) {
          afficherToast("Enregistrée hors-ligne — sera synchronisée automatiquement", '📴');
        } else {
          afficherToast("Vente enregistrée avec succès !");
        }
        naviguer('ticket');
      } catch (err) {
        erreurEl.textContent = err.message;
      }
    });
  }

  // ---------------- Historique ----------------
  function brancherHistorique() {
    document.getElementById('btn-filtrer').addEventListener('click', chargerHistorique);
  }

  async function chargerHistorique() {
    const filtres = {
      date: document.getElementById('filtre-date').value || undefined,
      client: document.getElementById('filtre-client').value || undefined,
      numero_ticket: document.getElementById('filtre-ticket').value || undefined
    };
    Object.keys(filtres).forEach(k => filtres[k] === undefined && delete filtres[k]);

    try {
      const { ventes } = await API.listerVentes(filtres);
      await DBOffline.mettreEnCacheVentes(ventes);
      afficherListeVentes('liste-historique', ventes);
    } catch (e) {
      const cache = await DBOffline.listerVentesEnCache();
      afficherListeVentes('liste-historique', cache);
    }
  }

  // ---------------- Ticket ----------------
  function brancherActionsTicket(vente) {
    document.getElementById('btn-imprimer').addEventListener('click', Ticket.imprimer);
    document.getElementById('btn-pdf').addEventListener('click', () => Ticket.telechargerPdf(vente.numero_ticket));
  }

  // ---------------- Synchronisation hors-ligne ----------------
  function gererStatutConnexion() {
    const banniere = document.getElementById('banniere-hors-ligne');
    async function verifier() {
      if (navigator.onLine) {
        banniere.classList.add('cache');
        if (API.token()) {
          const succes = await API.synchroniserVentesEnAttente();
          if (succes > 0 && routeActuelle() === 'dashboard') chargerDashboard();
        }
      } else {
        banniere.classList.remove('cache');
      }
    }
    window.addEventListener('online', verifier);
    window.addEventListener('offline', verifier);
    verifier();
  }

  // ---------------- Initialisation ----------------
  function demarrer() {
    // Boutons de navigation de l'en-tête (Accueil, Historique) : présents en permanence
    // dans la page (en dehors de la zone remplacée par les templates), donc branchés une seule fois ici.
    navConnecte.querySelectorAll('[data-route]').forEach(bouton => {
      bouton.addEventListener('click', () => naviguer(bouton.dataset.route));
    });
    fabNouvelleVente.addEventListener('click', () => naviguer(fabNouvelleVente.dataset.route));

    brancherBoutonsTheme();
    window.addEventListener('hashchange', rendre);
    gererStatutConnexion();
    if (!window.location.hash) window.location.hash = API.token() ? 'dashboard' : 'login';
    rendre();
  }

  return { demarrer };
})();

App.demarrer();
