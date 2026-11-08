/**
 * TEXTES DU BRIEFING DU JOUR (carte « BIBIP » de l'accueil), en un seul endroit pour être relus et corrigés facilement.
 * Les phrases sont des modèles (aucun appel à une IA) : `{n}` est remplacé par un nombre, `**…**` met un morceau en évidence
 * (orange et gras). Le vocabulaire darija suit celui de `src/i18n/locales/ar.json` : سيارة (voiture), كراء (location),
 * زبون / الزبناء (client), رجوع متأخر (retour en retard), خاصها فحص (à inspecter), الخلاص / يتقبض (paiement), وثيقة (document),
 * حجز (réservation).
 */
export type BriefingLang = 'fr' | 'darija';

export type BriefingTexts = {
  /** Mots de liaison devant chaque morceau : le retard (seul, ou suivi des inspections), l'inspection ; puis le point final. */
  join: { late: string; lateWithInsp: string; insp: string; end: string };
  // Phrase principale
  freeNone: string;
  freeOne: string;
  freeMany: string;
  lateOne: string;
  lateMany: string;
  inspOne: string;
  inspMany: string;
  allClear: string;
  // Ligne de priorité
  fleetReady: string;
  conflictOne: string;
  conflictMany: string;
  lateClientOne: string;
  lateClientMany: string;
  unpaidOne: string;
  unpaidMany: string;
  documentsOne: string;
  documentsMany: string;
  nothing: string;
};

export const BRIEFING_TEXTS: Record<BriefingLang, BriefingTexts> = {
  fr: {
    join: { late: ' et ', lateWithInsp: ', ', insp: ' et ', end: '.' },
    freeNone: "Aujourd'hui, **aucune voiture** n'est libre à la location",
    freeOne: "Aujourd'hui, **1 voiture** est prête à louer",
    freeMany: "Aujourd'hui, **{n} voitures** sont prêtes à louer",
    lateOne: '**1 retour** est en retard',
    lateMany: '**{n} retours** sont en retard',
    inspOne: '**1 voiture** attend une inspection',
    inspMany: '**{n} voitures** attendent une inspection',
    allClear: 'Rien à signaler.',
    fleetReady: 'Flotte prête à **{pct} %**.',
    conflictOne: 'Priorité : réaffecter **1** réservation menacée.',
    conflictMany: 'Priorité : réaffecter **{n}** réservations menacées.',
    lateClientOne: 'Priorité : appeler le **client** en retard.',
    lateClientMany: 'Priorité : appeler les **{n}** clients en retard.',
    unpaidOne: 'Priorité : relancer **1** dossier impayé.',
    unpaidMany: 'Priorité : relancer **{n}** dossiers impayés.',
    documentsOne: 'Priorité : mettre à jour **1** document.',
    documentsMany: 'Priorité : mettre à jour **{n}** documents.',
    nothing: 'Belle journée !',
  },
  darija: {
    join: { late: '، ', lateWithInsp: '، ', insp: '، و ', end: '.' },
    freeNone: 'اليوم ما عندك حتى سيارة واجدة للكراء',
    freeOne: 'اليوم عندك **1** سيارة واجدة للكراء',
    freeMany: 'اليوم عندك **{n}** سيارات واجدين للكراء',
    lateOne: '**1** رجوع متأخر',
    lateMany: '**{n}** رجوعات متأخرة',
    inspOne: '**1** سيارة خاصها فحص',
    inspMany: '**{n}** سيارات خاصها فحص',
    allClear: 'كلشي مزيان.',
    fleetReady: 'الأسطول واجد ب **{pct}**%.',
    conflictOne: 'الأولوية: بدّل السيارة ل **1** حجز.',
    conflictMany: 'الأولوية: بدّل السيارة ل **{n}** ديال الحجوزات.',
    lateClientOne: 'الأولوية: اتصل بالزبون لي رجوعو متأخر.',
    lateClientMany: 'الأولوية: اتصل بـ **{n}** ديال الزبناء لي رجوعهم متأخر.',
    unpaidOne: 'الأولوية: تبّع الخلاص، **1** كراء باقي خاصو يتقبض.',
    unpaidMany: 'الأولوية: تبّع الخلاص، **{n}** كراءات باقي خاصها تتقبض.',
    documentsOne: 'الأولوية: **1** وثيقة خاصها تجديد.',
    documentsMany: 'الأولوية: **{n}** ديال الوثائق خاصها تجديد.',
    nothing: 'نهار مبروك!',
  },
};
