// M3ak — textes des notifications envoyées sur le téléphone (push), en français et en arabe.
// Les mêmes types de notifications sont écrits dans l'application par l'i18n (src/i18n) ; ici le serveur doit écrire
// le texte lui-même, dans la langue choisie par le destinataire. Fichier sans dépendance : testé avec Jest.

export type Locale = 'fr' | 'ar';
export type PushParams = Record<string, unknown>;

type Template = { title: string; body: string };

const MAINTENANCE: Record<Locale, Record<string, string>> = {
  fr: { vidange: 'la vidange', assurance: "l'assurance", visite_technique: 'la visite technique', freins: 'les freins', pneus: 'les pneus', autre: "l'entretien" },
  ar: { vidange: 'تغيير الزيت', assurance: 'التأمين', visite_technique: 'الفحص التقني', freins: 'الفرامل', pneus: 'العجلات', autre: 'الصيانة' },
};

const TEMPLATES: Record<string, Record<Locale, Template>> = {
  return_tomorrow: {
    fr: { title: 'Retour prévu demain', body: '{customer} doit rendre {vehicle} ({plate}) demain. Appelez-le : {phone}' },
    ar: { title: 'إرجاع مبرمج غداً', body: 'على {customer} إرجاع {vehicle} ({plate}) غداً. اتصل به: {phone}' },
  },
  return_today: {
    fr: { title: "Retour prévu aujourd'hui", body: '{customer} doit rendre {vehicle} ({plate}) aujourd\'hui. Tél : {phone}' },
    ar: { title: 'إرجاع مبرمج اليوم', body: 'على {customer} إرجاع {vehicle} ({plate}) اليوم. الهاتف: {phone}' },
  },
  return_late: {
    fr: { title: 'Retour en retard', body: '{customer} n\'a pas rendu {vehicle} ({plate}). Contactez-le : {phone}' },
    ar: { title: 'تأخر في الإرجاع', body: 'لم يرجع {customer} السيارة {vehicle} ({plate}). اتصل به: {phone}' },
  },
  departure_today: {
    fr: { title: "Départ prévu aujourd'hui", body: '{customer} vient chercher {vehicle} ({plate}) aujourd\'hui.' },
    ar: { title: 'تسليم مبرمج اليوم', body: 'سيأخذ {customer} السيارة {vehicle} ({plate}) اليوم.' },
  },
  departure_tomorrow: {
    fr: { title: 'Départ prévu demain', body: '{customer} vient chercher {vehicle} ({plate}) demain.' },
    ar: { title: 'تسليم مبرمج غداً', body: 'سيأخذ {customer} السيارة {vehicle} ({plate}) غداً.' },
  },
  departure_late: {
    fr: { title: 'Client en retard au départ', body: '{customer} n\'est pas venu chercher {vehicle} ({plate}). Tél : {phone}' },
    ar: { title: 'الزبون متأخر عن الاستلام', body: 'لم يأت {customer} لأخذ {vehicle} ({plate}). الهاتف: {phone}' },
  },
  maintenance_due: {
    fr: { title: 'Entretien à prévoir', body: 'Pour {vehicle} ({plate}) : {maintenance} avant le {date}.' },
    ar: { title: 'صيانة مطلوبة', body: 'بالنسبة لـ {vehicle} ({plate}): {maintenance} قبل {date}.' },
  },
  maintenance_overdue: {
    fr: { title: 'Entretien en retard', body: 'Pour {vehicle} ({plate}) : {maintenance} devait être fait le {date}.' },
    ar: { title: 'صيانة متأخرة', body: 'بالنسبة لـ {vehicle} ({plate}): {maintenance} كانت مبرمجة في {date}.' },
  },
  licence_expiring: {
    fr: { title: 'Permis bientôt expiré', body: 'Le permis de {customer} expire le {date}. Tél : {phone}' },
    ar: { title: 'رخصة السياقة توشك على الانتهاء', body: 'تنتهي رخصة {customer} في {date}. الهاتف: {phone}' },
  },
  rental_created: {
    fr: { title: 'Nouvelle location', body: '{customer} · {vehicle} ({plate})' },
    ar: { title: 'كراء جديد', body: '{customer} · {vehicle} ({plate})' },
  },
  rental_confirmed: {
    fr: { title: 'Location confirmée', body: '{customer} · {vehicle} ({plate})' },
    ar: { title: 'تم تأكيد الكراء', body: '{customer} · {vehicle} ({plate})' },
  },
  rental_started: {
    fr: { title: 'Départ enregistré', body: '{customer} est parti avec {vehicle} ({plate}).' },
    ar: { title: 'تم تسجيل التسليم', body: 'غادر {customer} بالسيارة {vehicle} ({plate}).' },
  },
  rental_returned: {
    fr: { title: 'Voiture rendue', body: '{customer} a rendu {vehicle} ({plate}).' },
    ar: { title: 'تم إرجاع السيارة', body: 'أرجع {customer} السيارة {vehicle} ({plate}).' },
  },
  rental_cancelled: {
    fr: { title: 'Location annulée', body: '{customer} · {vehicle} ({plate})' },
    ar: { title: 'تم إلغاء الكراء', body: '{customer} · {vehicle} ({plate})' },
  },
  rental_extended: {
    fr: { title: 'Location prolongée', body: '{customer} garde {vehicle} ({plate}) jusqu\'au {end}.' },
    ar: { title: 'تم تمديد الكراء', body: 'يحتفظ {customer} بـ {vehicle} ({plate}) إلى غاية {end}.' },
  },
  payment_received: {
    fr: { title: 'Paiement reçu', body: '{amount} MAD de {customer} ({vehicle}).' },
    ar: { title: 'تم استلام دفعة', body: '{amount} درهم من {customer} ({vehicle}).' },
  },
  deposit_retained: {
    fr: { title: 'Retenue sur caution', body: '{amount} MAD retenus sur la caution de {customer}.' },
    ar: { title: 'اقتطاع من الضمانة', body: 'تم اقتطاع {amount} درهم من ضمانة {customer}.' },
  },
  contract_signed: {
    fr: { title: 'Contrat signé', body: '{contract} · {customer} · {vehicle}' },
    ar: { title: 'تم توقيع العقد', body: '{contract} · {customer} · {vehicle}' },
  },
  inspection_analyzed: {
    fr: { title: 'Inspection analysée', body: '{vehicle} : {count} dommage(s) détecté(s).' },
    ar: { title: 'تم تحليل الفحص', body: '{vehicle}: تم رصد {count} ضرر.' },
  },
  inspection_skipped: {
    fr: { title: 'Inspection ignorée', body: "L'inspection de {vehicle} a été ignorée." },
    ar: { title: 'تم تخطي الفحص', body: 'تم تخطي فحص {vehicle}.' },
  },
  vehicle_maintenance: {
    fr: { title: 'Véhicule en maintenance', body: '{vehicle} ({plate}) est passé en maintenance.' },
    ar: { title: 'سيارة في الصيانة', body: 'دخلت {vehicle} ({plate}) الصيانة.' },
  },
  member_joined: {
    fr: { title: "Nouveau membre dans l'équipe", body: '{name} a rejoint votre équipe.' },
    ar: { title: 'عضو جديد في الفريق', body: 'انضم {name} إلى فريقكم.' },
  },
  customer_created: {
    fr: { title: 'Nouveau client', body: '{customer}' },
    ar: { title: 'زبون جديد', body: '{customer}' },
  },
};

const BRANCH_LABEL: Record<Locale, string> = { fr: 'Filiale', ar: 'الفرع' };
const FALLBACK: Record<Locale, Template> = {
  fr: { title: 'M3ak', body: 'Vous avez une nouvelle notification.' },
  ar: { title: 'M3ak', body: 'لديك إشعار جديد.' },
};

function formatDay(value: unknown, locale: Locale): string {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value ?? '');
  return date.toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR', { day: '2-digit', month: 'short', timeZone: 'Africa/Casablanca' });
}

/** Texte final d'une notification push ; le nom de la filiale n'est ajouté que s'il existe. */
export function renderPush(kind: string, rawParams: PushParams, locale: Locale): Template {
  const template = TEMPLATES[kind]?.[locale] ?? FALLBACK[locale];
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawParams ?? {})) {
    if (value == null) continue;
    params[key] = key === 'date' || key === 'end' || key === 'start' ? formatDay(value, locale) : String(value);
  }
  if (typeof rawParams?.maintenance === 'string') {
    params.maintenance = MAINTENANCE[locale][rawParams.maintenance] ?? MAINTENANCE[locale].autre;
  }
  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (_, key: string) => params[key] ?? '—');
  const branch = typeof rawParams?.branch === 'string' && rawParams.branch.trim() ? `\n${BRANCH_LABEL[locale]} : ${rawParams.branch}` : '';
  return { title: fill(template.title), body: fill(template.body) + branch };
}

export const PUSH_KINDS = Object.keys(TEMPLATES);
