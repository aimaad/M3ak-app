import type { TermsContext } from './contract-terms';
import { defaultOptions, templateFromOptions } from './contract-options';
import type { ContractTemplate } from './template';

/**
 * Modèle M3ak standard (carnet de location + conditions générales fr/ar), utilisé tant que l'agence n'a rien réglé.
 * `agencyLines` : lignes d'en-tête déjà filtrées (une adresse absente n'affiche pas de ligne vide).
 */
export function defaultContractTemplate(ctx: TermsContext & { agencyLines: string[] }): ContractTemplate {
  return templateFromOptions(defaultOptions(ctx), ctx.agencyLines);
}
