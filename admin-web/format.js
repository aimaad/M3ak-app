// Fonctions pures de la console (testées avec Jest) : mise en forme et calculs, sans accès au DOM ni au réseau.

export function formatInt(value) {
  return new Intl.NumberFormat('fr-FR').format(Number(value) || 0);
}

export function formatUsd(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(value);
}

export function formatMad(valueUsd, usdToMad) {
  if (valueUsd === null || valueUsd === undefined || !usdToMad) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).format(valueUsd * usdToMad);
}

export function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Début (inclus) et fin (exclue) de la période choisie, en ISO ; null = sans borne. */
export function periodRange(period, now = new Date()) {
  if (period === 'month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: null };
  }
  if (period === '30d') {
    return { from: new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString(), to: null };
  }
  return { from: null, to: null };
}

/** Totaux de la période. `costComplete` est faux si une entreprise payante n'a pas de coût calculable (tarif non saisi). */
export function summarize(agencies) {
  const total = { agencies: agencies.length, withKey: 0, enabled: 0, scans: 0, failed: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, costComplete: true };
  for (const a of agencies) {
    if (a.key_set) total.withKey += 1;
    if (a.cloud_enabled) total.enabled += 1;
    total.scans += a.scans || 0;
    total.failed += a.scans_failed || 0;
    total.inputTokens += a.input_tokens || 0;
    total.outputTokens += a.output_tokens || 0;
    if (a.cost_usd === null || a.cost_usd === undefined) total.costComplete = false;
    else total.costUsd += Number(a.cost_usd);
  }
  return total;
}

/** Même règle que le serveur : 20 à 200 caractères, sans espace. Le serveur reste l'autorité. */
export function validateKey(raw) {
  const key = String(raw ?? '').trim();
  if (!key) return 'required';
  if (key.length < 20 || key.length > 200 || /\s/.test(key)) return 'format';
  return null;
}

/** Nombre saisi (virgule ou point) → nombre ≥ 0, null si vide, NaN si invalide. */
export function parseDecimal(raw) {
  const text = String(raw ?? '').trim().replace(',', '.');
  if (text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : Number.NaN;
}

export function costLabel(agency, usdToMad) {
  if (agency.key_tier === 'free' && agency.key_set) return 'Gratuit (0)';
  if (!agency.key_set && !agency.scans) return '—';
  if (agency.cost_usd === null || agency.cost_usd === undefined) return 'Tarif non configuré';
  const mad = formatMad(agency.cost_usd, usdToMad);
  return mad === '—' ? formatUsd(agency.cost_usd) : `${formatUsd(agency.cost_usd)} ≈ ${mad}`;
}

export function adminErrorMessage(error) {
  const message = String(error?.message ?? '');
  if (message.includes('invalid_key_format')) return 'Clé invalide : 20 à 200 caractères, sans espace.';
  if (message.includes('agency_not_found')) return 'Entreprise introuvable.';
  if (message.includes('invalid_tier')) return "Offre inconnue (choisissez gratuite ou payante).";
  if (message.includes('key_not_set')) return "Aucune clé en place : saisissez une clé.";
  if (message.includes('invalid_pricing')) return 'Tarif invalide (nombres positifs).';
  if (message.includes('not_allowed')) return 'Accès réservé aux administrateurs M3AK.';
  if (message.includes('Invalid login')) return 'E-mail ou mot de passe incorrect.';
  return "L'opération a échoué. Vérifiez la connexion et que les migrations 0032 à 0034 sont appliquées.";
}
