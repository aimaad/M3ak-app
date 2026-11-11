import { formatDayLabel, plateSpoken, weekSummary, type FleetContext } from './fleet-card';
import type { FleetItem, FleetSection, LateInfo } from './fleet-model';

type T = (key: string, options?: Record<string, unknown>) => string;

const NBSP = '\u00a0';

/** « +13 j » / « +3 h » : l'espace entre le nombre et l'unité est insécable, la pastille ne se coupe jamais. */
export function lateBadgeText(late: LateInfo, t: T): string {
  return t(late.unit === 'days' ? 'flotte.card.late.badgeDays' : 'flotte.card.late.badgeHours', { count: late.amount }).replace(/ /g, NBSP);
}

/** « 13 jours » / « 1 jour » / « 3 heures » : le retard en toutes lettres (lecture à voix haute, conseil BIBIP). */
export function lateDurationText(late: Pick<LateInfo, 'amount' | 'unit'>, t: T): string {
  return t(`flotte.card.late.${late.unit === 'days' ? 'days' : 'hours'}${late.amount === 1 ? 'One' : 'Many'}`, { count: late.amount });
}

/**
 * Ligne de contexte : texte affiché (jours abrégés, « lun. 16 » ; avec le mois au-delà de 7 jours et dans le passé, « mer. 28 oct. ») et
 * texte lu à voix haute (jours entiers, « lundi 16 »). Un retour en retard dit « prévu » (la date est passée) ; la pastille « +13 j » est
 * ajoutée par la carte.
 */
export function contextTexts(context: FleetContext, language: string, t: T, now: Date = new Date()): { display: string; spoken: string } {
  const short = (key: string) => formatDayLabel(key, language, 'short', now);
  const long = (key: string) => formatDayLabel(key, language, 'long', now);
  switch (context.kind) {
    case 'rented': {
      const { name, endDay, late } = context;
      // Affichage : « {Prénom} {I}. · retour lun. 16 » ; en retard : « {Prénom} {I}. · prévu mer. 28 oct. » (rouge, avec la pastille « +13 j »).
      // Lecture à voix haute : le retard est dit en toutes lettres.
      const shown = (date: (k: string) => string) => {
        if (!endDay) return name ?? '';
        if (late) return name ? t('flotte.card.context.lateWith', { name, date: date(endDay) }) : t('flotte.card.context.lateNoName', { date: date(endDay) });
        return name ? t('flotte.card.context.rentedWith', { name, date: date(endDay) }) : t('flotte.card.context.rentedNoName', { date: date(endDay) });
      };
      const spoken = (date: (k: string) => string) => {
        if (late) return name ? t('flotte.card.spoken.rentedLate', { name, date: endDay ? date(endDay) : '' }) : t('flotte.card.spoken.rentedLateNoName', { date: endDay ? date(endDay) : '' });
        if (!endDay || !name) return shown(date);
        return t('flotte.card.spoken.rentedWith', { name, date: date(endDay) });
      };
      return { display: shown(short), spoken: spoken(long) };
    }
    case 'free': {
      const text = (date: (k: string) => string) => (context.untilDay ? t('flotte.card.context.freeUntil', { date: date(context.untilDay) }) : t('flotte.card.context.freeAll'));
      return { display: text(short), spoken: text(long) };
    }
    case 'inspect': {
      const text = t('flotte.card.context.inspect');
      return { display: text, spoken: text };
    }
    case 'maintenance': {
      const text = (date: (k: string) => string) => (context.planned ? t('flotte.card.context.maintenancePlanned') : context.returnDay ? t('flotte.card.context.maintenanceReturn', { date: date(context.returnDay) }) : t('flotte.card.context.garage'));
      return { display: text(short), spoken: text(long) };
    }
    case 'unavailable': {
      const text = t('flotte.card.context.unavailable');
      return { display: text, spoken: text };
    }
  }
}

/** Résumé de la frise lu à voix haute : « libre jusqu'au vendredi 13 puis loué ». */
export function weekSummaryText(week: FleetItem['week'], language: string, t: T, now: Date = new Date()): string {
  return weekSummary(
    week,
    {
      state: { free: t('flotte.card.weekState.free'), rented: t('flotte.card.weekState.rented'), immobilized: t('flotte.card.weekState.immobilized'), late: t('flotte.card.weekState.late') },
      until: (state, date) => t('flotte.card.weekUntil', { state, date }),
      allWeek: (state) => t('flotte.card.weekAllWeek', { state }),
      then: t('flotte.card.weekThen'),
    },
    (key) => formatDayLabel(key, language, 'long', now)
  );
}

/**
 * La carte lue en une phrase : « Dacia Sandero, 68013 ب 72, en location chez Youssef A., retour lundi 16, occupation 72 pour cent ».
 * En retard : « Dacia Sandero, en retard de 13 jours, prévue le mercredi 28 octobre, client Fouad B. ».
 */
export function cardSentence(item: FleetItem, context: FleetContext, language: string, t: T, now: Date = new Date()): string {
  const name = item.vehicle.marque + ' ' + item.vehicle.modele;
  if (context.kind === 'rented' && context.late) {
    const date = context.endDay ? formatDayLabel(context.endDay, language, 'long', now) : '';
    return [name, t('flotte.card.late.spokenLate', { duration: lateDurationText(context.late, t) }), date ? t('flotte.card.late.spokenDue', { date }) : '', context.name ? t('flotte.card.late.spokenClient', { name: context.name }) : '']
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');
  }
  const status = t(`flotte.card.statusPhrase.${item.section}`);
  const spoken = contextTexts(context, language, t, now).spoken;
  // « en location chez Youssef A., retour lundi 16 » : le statut et le locataire ne forment qu'un groupe de mots.
  const middle = context.kind === 'rented' && context.name ? [`${status} ${spoken}`] : [status, spoken];
  return [name, plateSpoken(item.vehicle.immatriculation), ...middle, t('flotte.card.occupancyA11y', { percent: item.occupancy })]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}

export const SECTION_LABEL_KEY: Record<FleetSection, string> = {
  inspect: 'flotte.card.sections.inspect',
  maintenance: 'flotte.card.sections.maintenance',
  unavailable: 'flotte.card.sections.unavailable',
  rented: 'flotte.card.sections.rented',
  free: 'flotte.card.sections.free',
};
