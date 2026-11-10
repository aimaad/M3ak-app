import { formatDayLabel, plateSpoken, weekSummary, type FleetContext } from './fleet-card';
import type { FleetItem, FleetSection } from './fleet-model';

type T = (key: string, options?: Record<string, unknown>) => string;

/** Ligne de contexte : texte affiché (jours abrégés, « lun. 16 ») et texte lu à voix haute (jours entiers, « lundi 16 »). */
export function contextTexts(context: FleetContext, language: string, t: T): { display: string; spoken: string } {
  const short = (key: string) => formatDayLabel(key, language, 'short');
  const long = (key: string) => formatDayLabel(key, language, 'long');
  switch (context.kind) {
    case 'rented': {
      const { name, endDay, late } = context;
      // Affichage : toujours « {Prénom} {I}. · retour lun. 16 » (court, jamais coupé) ; une location en retard est signalée en rouge par la carte.
      // Lecture à voix haute : le retard est dit en toutes lettres.
      const shown = (date: (k: string) => string) => (!endDay ? (name ?? '') : name ? t('flotte.card.context.rentedWith', { name, date: date(endDay) }) : t('flotte.card.context.rentedNoName', { date: date(endDay) }));
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
export function weekSummaryText(week: FleetItem['week'], language: string, t: T): string {
  return weekSummary(
    week,
    {
      state: { free: t('flotte.card.weekState.free'), rented: t('flotte.card.weekState.rented'), immobilized: t('flotte.card.weekState.immobilized') },
      until: (state, date) => t('flotte.card.weekUntil', { state, date }),
      allWeek: (state) => t('flotte.card.weekAllWeek', { state }),
      then: t('flotte.card.weekThen'),
    },
    (key) => formatDayLabel(key, language, 'long')
  );
}

/** La carte lue en une phrase : « Dacia Sandero, 68013 ب 72, en location chez Youssef A., retour lundi 16, occupation 72 pour cent ». */
export function cardSentence(item: FleetItem, context: FleetContext, language: string, t: T): string {
  const status = t(`flotte.card.statusPhrase.${item.section}`);
  const spoken = contextTexts(context, language, t).spoken;
  // « en location chez Youssef A., retour lundi 16 » : le statut et le locataire ne forment qu'un groupe de mots.
  const middle = context.kind === 'rented' && context.name ? [`${status} ${spoken}`] : [status, spoken];
  return [item.vehicle.marque + ' ' + item.vehicle.modele, plateSpoken(item.vehicle.immatriculation), ...middle, t('flotte.card.occupancyA11y', { percent: item.occupancy })]
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
