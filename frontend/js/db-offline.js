// db-offline.js — Stockage local (IndexedDB) pour le fonctionnement hors-ligne.
// Les ventes créées sans connexion sont mises en file d'attente puis synchronisées
// automatiquement dès que la connexion internet revient.

const DBOffline = (() => {
  const NOM_BASE = 'recu_sur_offline';
  const VERSION = 1;
  let dbPromise = null;

  function ouvrir() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const requete = indexedDB.open(NOM_BASE, VERSION);
      requete.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('ventes_en_attente')) {
          db.createObjectStore('ventes_en_attente', { keyPath: 'client_id_offline' });
        }
        if (!db.objectStoreNames.contains('ventes_cache')) {
          db.createObjectStore('ventes_cache', { keyPath: 'id' });
        }
      };
      requete.onsuccess = (e) => resolve(e.target.result);
      requete.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
  }

  async function ajouterVenteEnAttente(vente) {
    const db = await ouvrir();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('ventes_en_attente', 'readwrite');
      tx.objectStore('ventes_en_attente').put(vente);
      tx.oncomplete = () => resolve(vente);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async function listerVentesEnAttente() {
    const db = await ouvrir();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('ventes_en_attente', 'readonly');
      const requete = tx.objectStore('ventes_en_attente').getAll();
      requete.onsuccess = () => resolve(requete.result || []);
      requete.onerror = (e) => reject(e.target.error);
    });
  }

  async function supprimerVenteEnAttente(clientIdOffline) {
    const db = await ouvrir();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('ventes_en_attente', 'readwrite');
      tx.objectStore('ventes_en_attente').delete(clientIdOffline);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async function mettreEnCacheVentes(ventes) {
    const db = await ouvrir();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('ventes_cache', 'readwrite');
      const store = tx.objectStore('ventes_cache');
      ventes.forEach(v => store.put(v));
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async function listerVentesEnCache() {
    const db = await ouvrir();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('ventes_cache', 'readonly');
      const requete = tx.objectStore('ventes_cache').getAll();
      requete.onsuccess = () => resolve(requete.result || []);
      requete.onerror = (e) => reject(e.target.error);
    });
  }

  return {
    ajouterVenteEnAttente,
    listerVentesEnAttente,
    supprimerVenteEnAttente,
    mettreEnCacheVentes,
    listerVentesEnCache
  };
})();
