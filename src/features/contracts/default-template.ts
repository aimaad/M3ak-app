import { CONTRACT_ACCEPTANCE, contractArticles, type TermsContext } from './contract-terms';
import type { Block, ContractTemplate, FieldRow } from './template';

const row = (label: string, value: string, optional = false): FieldRow => ({ label, value, ...(optional ? { optional: true } : {}) });

const FRANCHISE_TEXT =
  "Le locataire signataire du présent contrat supportera les frais de réparation et de remise en état du véhicule si le montant des réparations n'excède pas dix pour cent (10 %) de la valeur du véhicule neuf. " +
  "Dans le cas où la réparation des dégâts occasionnés suite à un sinistre dépasse cette limite, la franchise sera supportée par le locataire à hauteur de 10 % de la valeur du véhicule. " +
  "Le client pourra dégager sa participation aux frais moyennant un complément d'assurance ; en cas d'accident, ce complément n'inclut pas le rapatriement du véhicule ni les frais d'immobilisation. " +
  "Le locataire est entièrement et indéfiniment responsable envers les autorités (Sûreté nationale, gendarmerie, douane…) ainsi qu'envers la justice dans le cas où le véhicule serait utilisé pour des produits illicites. " +
  "J'atteste avoir lu et approuvé les clauses de ce contrat, y compris celles du verso.";

/**
 * Modèle M3ak standard : un carnet de location à cadres (conducteur 1 et 2, véhicule, période, paiement, kilométrage,
 * carburant, état du véhicule, franchise, signatures) suivi au verso des conditions générales en français et en arabe.
 * Chaque agence peut ensuite le modifier : renommer, supprimer ou ajouter des champs, des cadres et des textes.
 * `agencyLines` : lignes d'en-tête déjà filtrées (une adresse absente n'affiche pas de ligne vide).
 */
export function defaultContractTemplate(ctx: TermsContext & { agencyLines: string[] }): ContractTemplate {
  const articles = contractArticles(ctx);

  const blocks: Block[] = [
    { type: 'header', logo: 'left', center: ctx.agencyLines.join('\n'), right: 'Tél : {{agence_telephone}}\n{{agence_email}}' },
    { type: 'heading', text: 'CONTRAT DE LOCATION  N° {{numero}}', size: 'xl', bold: true, align: 'center', border: 'none' },

    {
      type: 'box',
      width: 'half',
      title: 'Conducteur 1',
      rows: [
        row('Nom', '{{client_nom_famille}}'),
        row('Prénom', '{{client_prenom}}'),
        row('Date de naissance', '{{client_naissance}}'),
        row('Nationalité', '{{client_nationalite}}'),
        row('Adresse au Maroc', '{{client_adresse}}'),
        row("Adresse à l'étranger", ''),
        row('Hôtel / N° de chambre', ''),
        row('Tél', '{{client_telephone}}'),
        row('Permis de conduire N°', '{{client_permis}}'),
        row('Délivré le / à', '{{client_permis_delivre_le}}  à  {{client_permis_delivre_a}}'),
        row('C.I.N N°', '{{client_cin}}'),
        row('Passeport N°', '{{client_passeport}}'),
      ],
    },
    {
      type: 'box',
      width: 'half',
      title: 'Véhicule et période',
      rows: [
        row('Marque', '{{marque}} {{modele}}'),
        row('Immatriculation', '{{immatriculation}}'),
        row('Départ (lieu, date et heure)', '{{date_debut}}'),
        row('Retour (lieu, date et heure)', '{{date_fin}}'),
      ],
    },

    {
      type: 'box',
      width: 'half',
      title: 'Conducteur 2',
      rows: [
        row('Nom', '{{conducteur2_nom}}'),
        row('Permis de conduire N°', '{{conducteur2_permis}}'),
        row('C.I.N N°', '{{conducteur2_cin}}'),
        row('Conducteur principal', '{{conducteur_principal}}', true),
        row('Conducteurs supplémentaires', '{{autres_conducteurs}}', true),
      ],
    },
    {
      type: 'box',
      width: 'half',
      title: 'Paiement',
      rows: [
        row('Prix unitaire / jour', '{{prix_jour}}'),
        row('Nombre de jours', '{{nombre_jours}}'),
        row('Total général', '{{prix_total}}'),
        row('Caution', '{{caution}}'),
        row('Avance', '{{avance}}'),
        row('Reste', '{{reste}}'),
        row('Mode de paiement', '{{mode_paiement}}'),
      ],
    },

    { type: 'box', width: 'half', title: 'Kilométrage', rows: [row('Km au départ', '{{km_depart}}'), row('Km au retour', '{{km_retour}}'), row('Carburant au départ', '{{carburant_depart}}')] },
    { type: 'fuelGauge', width: 'half', title: 'Niveau de carburant' },

    { type: 'vehicleDiagram', title: 'État du véhicule (Départ)' },
    { type: 'vehicleDiagram', title: 'État du véhicule (Retour)' },

    {
      type: 'box',
      showIf: 'hasDeparture',
      title: 'État des lieux au départ',
      rows: [row('État général', '{{etat_depart}}'), row('Accessoires remis', '{{accessoires_depart}}'), row('Observations', '{{observations_depart}}', true)],
    },
    { type: 'box', showIf: 'hasConditions', title: 'Conditions particulières', rows: [], text: '{{conditions_particulieres}}' },
    { type: 'box', title: 'Franchise sinistre', rows: [], text: FRANCHISE_TEXT },

    { type: 'paragraph', text: CONTRACT_ACCEPTANCE.fr, size: 'sm' },
    { type: 'paragraph', text: CONTRACT_ACCEPTANCE.ar, size: 'sm', rtl: true, align: 'right' },
    {
      type: 'signatures',
      boxes: [
        { role: 'client', label: 'Signature du locataire · توقيع المكتري' },
        { role: 'agency', label: "Cachet et signature de l'agence · طابع وتوقيع الوكالة" },
      ],
    },
    { type: 'paragraph', text: 'Patente : ……………  -  R.C : ……………  -  I.F : ……………  -  C.N.S.S : ……………', size: 'sm', bold: true, align: 'center' },

    { type: 'pageBreak' },
    { type: 'heading', text: 'Conditions générales · الشروط العامة', size: 'lg', bold: true, align: 'center', border: 'bottom' },
    ...articles.map<Block>((article, index) => ({
      type: 'columns',
      cells: [
        { title: `Article ${index + 1} — ${article.fr.title}`, text: article.fr.body, lang: 'fr' },
        { title: `المادة ${index + 1} — ${article.ar.title}`, text: article.ar.body, rtl: true, align: 'right', lang: 'ar' },
      ],
    })),
    {
      type: 'paragraph',
      size: 'xs',
      color: 'muted',
      text: "Document généré par M3ak. Les conditions générales sont un modèle standard : l'agence doit s'assurer de leur conformité à la réglementation applicable avant tout usage commercial.",
    },
  ];

  return { v: 1, direction: 'ltr', blocks };
}
