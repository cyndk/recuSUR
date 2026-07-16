// ticket.js — Affichage du ticket, génération du QR code et export PDF

const Ticket = (() => {

  function formaterMontant(montant) {
    return Number(montant).toLocaleString('fr-FR') + ' FCFA';
  }

  function formaterDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  // Remplit le template HTML du ticket avec les données de la vente
  function afficher(vente, commercant) {
    document.getElementById('ticket-entreprise').textContent = commercant.nom_entreprise;
    document.getElementById('ticket-date').textContent = formaterDate(vente.date_heure);
    document.getElementById('ticket-numero').textContent = vente.numero_ticket;
    document.getElementById('ticket-client').textContent = vente.client_nom;

    const corpsTableau = document.querySelector('#ticket-tableau-produits tbody');
    corpsTableau.innerHTML = '';
    vente.produits.forEach(p => {
      const ligne = document.createElement('tr');
      const totalLigne = p.quantite * p.prix_unitaire;
      ligne.innerHTML = `
        <td>${escapeHtml(p.nom)}</td>
        <td>${p.quantite}</td>
        <td>${Number(p.prix_unitaire).toLocaleString('fr-FR')}</td>
        <td>${totalLigne.toLocaleString('fr-FR')}</td>
      `;
      corpsTableau.appendChild(ligne);
    });

    document.getElementById('ticket-total').textContent = formaterMontant(vente.total);
    document.getElementById('ticket-paiement').textContent = vente.moyen_paiement;

    const ligneTransaction = document.getElementById('ligne-transaction');
    if (vente.numero_transaction) {
      document.getElementById('ticket-transaction').textContent = vente.numero_transaction;
      ligneTransaction.classList.remove('cache');
    } else {
      ligneTransaction.classList.add('cache');
    }

    // QR code : encode l'URL de vérification publique (basée sur l'id interne de la vente).
    // Si la vente est encore hors-ligne (id null), on encode simplement le numéro de ticket.
    const zoneQr = document.getElementById('ticket-qrcode');
    zoneQr.innerHTML = '';
    const contenuQr = vente.id
      ? `${window.location.origin}/verifier.html?id=${vente.id}`
      : `Ticket hors-ligne : ${vente.numero_ticket} (en attente de synchronisation)`;

    if (window.QRCode) {
      new QRCode(zoneQr, { text: contenuQr, width: 120, height: 120 });
    }

    // Lien de partage WhatsApp pré-rempli
    const texteWhatsapp = encodeURIComponent(
      `Voici votre reçu ${commercant.nom_entreprise} — Ticket ${vente.numero_ticket} — ` +
      `Total : ${formaterMontant(vente.total)}. Merci pour votre achat !`
    );
    document.getElementById('btn-whatsapp').href = `https://wa.me/?text=${texteWhatsapp}`;
  }

  function escapeHtml(texte) {
    const div = document.createElement('div');
    div.textContent = texte;
    return div.innerHTML;
  }

  // Génère un PDF à partir du ticket affiché à l'écran (format proche 80mm)
  async function telechargerPdf(numeroTicket) {
    const noeud = document.getElementById('ticket-imprimable');
    const canvas = await html2canvas(noeud, { scale: 3, backgroundColor: '#ffffff' });
    const image = canvas.toDataURL('image/png');

    const { jsPDF } = window.jspdf;
    const largeurMm = 80;
    const hauteurMm = (canvas.height * largeurMm) / canvas.width;

    const pdf = new jsPDF({ unit: 'mm', format: [largeurMm, hauteurMm] });
    pdf.addImage(image, 'PNG', 0, 0, largeurMm, hauteurMm);
    pdf.save(`${numeroTicket}.pdf`);
  }

  function imprimer() {
    window.print();
  }

  return { afficher, telechargerPdf, imprimer, formaterMontant, formaterDate };
})();
