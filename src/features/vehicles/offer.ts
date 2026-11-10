/**
 * Offre de remise (aucune donnée enregistrée) : le propriétaire choisit une remise et des jours, l'app prépare un message prêt à
 * partager (WhatsApp ou partage du téléphone), en français ou en darija selon la langue de l'app.
 */
export const OFFER_PERCENTS = [10, 15, 20] as const;
export type OfferPercent = (typeof OFFER_PERCENTS)[number];
export type OfferDays = 'weekend' | 'week';
export const OFFER_DAYS: OfferDays[] = ['weekend', 'week'];

export const discountedPrice = (price: number, percent: number): number => Math.max(0, Math.round(price * (1 - percent / 100)));

const addDays = (date: Date, delta: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);

/** Période de l'offre : « week-end » = le prochain samedi et dimanche (en cours si on y est), « semaine » = les 7 prochains jours. */
export function offerPeriod(days: OfferDays, now: Date): { from: Date; to: Date } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (days === 'week') return { from: today, to: addDays(today, 6) };
  const weekday = today.getDay(); // 0 = dimanche … 6 = samedi
  if (weekday === 0) return { from: today, to: today };
  const saturday = addDays(today, weekday === 6 ? 0 : 6 - weekday);
  return { from: saturday, to: addDays(saturday, 1) };
}

export function buildOfferMessage(input: {
  vehicleName: string;
  price: number;
  percent: number;
  days: OfferDays;
  now: Date;
  language: string;
  agencyName?: string | null;
}): string {
  const { vehicleName, price, percent, days, now, language, agencyName } = input;
  const arabic = language === 'ar';
  const { from, to } = offerPeriod(days, now);
  const locale = arabic ? 'ar-MA' : 'fr-FR';
  const short = (date: Date) => date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const same = from.getTime() === to.getTime();
  // Un mois abrégé finit déjà par un point (« nov. ») : on n'en ajoute pas un second.
  const sentence = (text: string) => (text.endsWith('.') ? text : `${text}.`);
  const discounted = discountedPrice(price, percent);
  const signature = agencyName ? ` — ${agencyName}` : '';
  if (arabic) {
    const title = days === 'weekend' ? 'عرض نهاية الأسبوع' : 'عرض الأسبوع';
    const period = same ? `نهار ${short(from)}` : `من ${short(from)} حتى ${short(to)}`;
    return `${title} : ${vehicleName} بـ ${discounted} درهم فالنهار عوض ${price}. ${sentence(period)} كري دابا قبل ما تسالي!${signature}`;
  }
  const title = days === 'weekend' ? 'Offre week-end' : 'Offre de la semaine';
  const period = same ? `Le ${short(from)}` : `Du ${short(from)} au ${short(to)}`;
  return `${title} : ${vehicleName} à ${discounted} MAD/j au lieu de ${price}. ${sentence(period)} Réservez dès maintenant !${signature}`;
}
