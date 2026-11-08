/**
 * Briefing du jour : une phrase construite par des modèles à partir des chiffres de l'accueil, SANS appel à une IA (instantané et
 * toujours exact). Les modèles de phrases sont dans `briefing-texts.ts`. Fonctions pures.
 */
import { BRIEFING_TEXTS, type BriefingLang, type BriefingTexts } from './briefing-texts';

export type BriefingInput = {
  /** Véhicules libres aujourd'hui (fonction unique de availability.ts). */
  free: number;
  /** Taille du parc (véhicules actifs). */
  total: number;
  /** Retours en retard. */
  late: number;
  /** Véhicules à inspecter ou en entretien aujourd'hui. */
  insp: number;
  /** Réservations menacées par un retard. */
  conflicts: number;
  /** Dossiers impayés. */
  unpaid: number;
  /** Documents expirés. */
  expiredDocs: number;
  /** Propriétaire : seul à voir la priorité « Impayés ». */
  showMoney: boolean;
};

export type BriefingPart = { text: string; strong: boolean };
export type Briefing = { main: BriefingPart[]; priority: BriefingPart[]; plain: string };
export type BriefingPriority = 'conflict' | 'late' | 'unpaid' | 'documents' | null;

/** Découpe un modèle : `**…**` devient un morceau « strong », `{n}` / `{pct}` sont remplacés. */
export function parseTemplate(template: string, values: Record<string, number> = {}): BriefingPart[] {
  const filled = template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
  return filled
    .split(/\*\*(.+?)\*\*/g)
    .map((text, index) => ({ text, strong: index % 2 === 1 }))
    .filter((part) => part.text.length > 0);
}

/** Priorité du jour, même ordre que les cartes de l'accueil : conflit, retards, impayés (propriétaire), documents expirés. */
export function pickPriority(input: BriefingInput): BriefingPriority {
  if (input.conflicts > 0) return 'conflict';
  if (input.late > 0) return 'late';
  if (input.showMoney && input.unpaid > 0) return 'unpaid';
  if (input.expiredDocs > 0) return 'documents';
  return null;
}

const concat = (...lists: BriefingPart[][]): BriefingPart[] => lists.flat();
const text = (parts: BriefingPart[]) => parts.map((p) => p.text).join('');

function mainSentence(input: BriefingInput, t: BriefingTexts): BriefingPart[] {
  const free = input.free === 0 ? t.freeNone : input.free === 1 ? t.freeOne : t.freeMany;
  const glue = (word: string): BriefingPart[] => [{ text: word, strong: false }];
  // « A. » · « A et B. » · « A, B et C. » (darija : « A، B. » · « A، و C. » · « A، B، و C. »)
  let sentence = parseTemplate(free, { n: input.free });
  if (input.late > 0)
    sentence = concat(sentence, glue(input.insp > 0 ? t.join.lateWithInsp : t.join.late), parseTemplate(input.late === 1 ? t.lateOne : t.lateMany, { n: input.late }));
  if (input.insp > 0)
    sentence = concat(sentence, glue(t.join.insp), parseTemplate(input.insp === 1 ? t.inspOne : t.inspMany, { n: input.insp }));
  sentence = concat(sentence, glue(t.join.end));
  if (input.late === 0 && input.insp === 0) sentence = concat(sentence, [{ text: ' ', strong: false }], parseTemplate(t.allClear));
  return sentence;
}

function prioritySentence(input: BriefingInput, t: BriefingTexts): BriefingPart[] {
  const pct = input.total > 0 ? Math.round((input.free / input.total) * 100) : null;
  const fleet = pct === null ? [] : parseTemplate(t.fleetReady, { pct });
  let line: BriefingPart[];
  switch (pickPriority(input)) {
    case 'conflict':
      line = parseTemplate(input.conflicts === 1 ? t.conflictOne : t.conflictMany, { n: input.conflicts });
      break;
    case 'late':
      line = parseTemplate(input.late === 1 ? t.lateClientOne : t.lateClientMany, { n: input.late });
      break;
    case 'unpaid':
      line = parseTemplate(input.unpaid === 1 ? t.unpaidOne : t.unpaidMany, { n: input.unpaid });
      break;
    case 'documents':
      line = parseTemplate(input.expiredDocs === 1 ? t.documentsOne : t.documentsMany, { n: input.expiredDocs });
      break;
    default:
      line = parseTemplate(t.nothing);
  }
  return fleet.length ? concat(fleet, [{ text: ' ', strong: false }], line) : line;
}

export function buildBriefing(lang: BriefingLang, input: BriefingInput): Briefing {
  const t = BRIEFING_TEXTS[lang];
  const main = mainSentence(input, t);
  const priority = prioritySentence(input, t);
  return { main, priority, plain: `${text(main)} ${text(priority)}` };
}
