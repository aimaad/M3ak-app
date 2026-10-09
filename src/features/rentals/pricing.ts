export type VehicleRates = {
  prixJour: number;
  prixSemaine: number | null;
  prixMois: number | null;
};

export type PriceBreakdown = {
  dureeJours: number;
  prixJourApplique: number;
  sousTotal: number;
  fraisSupplementaires: number;
  remiseMontant: number;
  total: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Règle de comptage des jours : toute journée commencée est facturée (on
 * arrondit au jour supérieur), avec un minimum d'un jour. Ex. 24h01 = 2 jours.
 * Évite les erreurs d'arrondi aux limites de dates (23h59 ne doit pas compter
 * pour 0 jour).
 */
export function computeDurationDays(startISO: string, endISO: string): number {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(1, Math.ceil((end - start) / MS_PER_DAY));
}

/**
 * Sélectionne le tarif le plus avantageux disponible pour la durée donnée :
 * mensuel si disponible et >= 28 jours, hebdomadaire si disponible et >= 7
 * jours, journalier sinon. Le reliquat (jours hors palier plein) est toujours
 * facturé au tarif journalier.
 */
export function computeSousTotal(dureeJours: number, rates: VehicleRates): { prixJourApplique: number; sousTotal: number } {
  if (dureeJours <= 0) {
    return { prixJourApplique: rates.prixJour, sousTotal: 0 };
  }

  if (rates.prixMois && dureeJours >= 28) {
    const mois = Math.floor(dureeJours / 28);
    const joursRestants = dureeJours % 28;
    const sousTotal = mois * rates.prixMois + joursRestants * rates.prixJour;
    return { prixJourApplique: round2(sousTotal / dureeJours), sousTotal: round2(sousTotal) };
  }

  if (rates.prixSemaine && dureeJours >= 7) {
    const semaines = Math.floor(dureeJours / 7);
    const joursRestants = dureeJours % 7;
    const sousTotal = semaines * rates.prixSemaine + joursRestants * rates.prixJour;
    return { prixJourApplique: round2(sousTotal / dureeJours), sousTotal: round2(sousTotal) };
  }

  return { prixJourApplique: rates.prixJour, sousTotal: round2(dureeJours * rates.prixJour) };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeRentalPrice(
  startISO: string,
  endISO: string,
  rates: VehicleRates,
  fraisSupplementaires = 0,
  remiseMontant = 0
): PriceBreakdown {
  const dureeJours = computeDurationDays(startISO, endISO);
  const { prixJourApplique, sousTotal } = computeSousTotal(dureeJours, rates);
  const total = Math.max(0, round2(sousTotal + fraisSupplementaires - remiseMontant));

  return {
    dureeJours,
    prixJourApplique,
    sousTotal,
    fraisSupplementaires: round2(fraisSupplementaires),
    remiseMontant: round2(remiseMontant),
    total,
  };
}
