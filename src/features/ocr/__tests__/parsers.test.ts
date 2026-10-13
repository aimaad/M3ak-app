// Textes OCR SIMULÉS (fabriqués, aucune donnée réelle) : ces tests valident la logique de lecture
// du texte, PAS la qualité de reconnaissance d'un vrai appareil (voir docs/OCR-CONFIDENTIALITE.md).
import { parseLicenceText } from '../licence-parser';
import { findPlate, findPlatePartial, findVin, parseRegistrationText } from '../registration-parser';
import { findDate, toLines } from '../text';

describe('findDate', () => {
  it('lit les formats courants et corrige O/l dans les chiffres', () => {
    expect(findDate('12.03.1990 CASABLANCA')).toBe('1990-03-12');
    expect(findDate('01/06/2030')).toBe('2030-06-01');
    expect(findDate('1O-O6-2O2O')).toBe('2020-06-10');
  });
  it('rejette les dates impossibles ou absentes', () => {
    expect(findDate('31.02.2020')).toBeNull();
    expect(findDate('pas de date')).toBeNull();
  });
});

describe('parseLicenceText', () => {
  it('lit un permis à champs numérotés (une valeur par ligne)', () => {
    const f = parseLicenceText(
      toLines(['ROYAUME DU MAROC', 'PERMIS DE CONDUIRE', '1. BOUCHNEF', '2. FOUAD', '3. 12.03.1990 CASABLANCA', '4a. 07.04.2018', '4b. 07.04.2028', '4c. DGSN', '5. 12/345678', '9. B'])
    );
    expect(f.nom).toEqual({ value: 'BOUCHNEF', confidence: 'medium' });
    expect(f.prenom.value).toBe('FOUAD');
    expect(f.dateNaissance).toEqual({ value: '1990-03-12', confidence: 'high' });
    expect(f.dateDelivrance.value).toBe('2018-04-07');
    expect(f.dateExpiration.value).toBe('2028-04-07');
    expect(f.numeroPermis.value).toBe('12/345678');
    expect(f.categories.value).toEqual(['B']);
  });

  it('lit des champs fusionnés sur une même ligne et des étiquettes textuelles', () => {
    const f = parseLicenceText(toLines(['Nom : ALAOUI', 'Prénom: Sara', '4a. 01.05.2019 4b. 01.05.2029', 'N° du permis : 98/123456', 'Catégories B C1']));
    expect(f.nom.value).toBe('ALAOUI');
    expect(f.prenom.value).toBe('Sara');
    expect(f.dateDelivrance.value).toBe('2019-05-01');
    expect(f.dateExpiration.value).toBe('2029-05-01');
    expect(f.numeroPermis.value).toBe('98/123456');
    expect(f.categories.value).toEqual(['B', 'C1']);
  });

  it('laisse vide ce qui est illisible et ne devine jamais', () => {
    const f = parseLicenceText(toLines(['1. ', 'xx ## 99', '4b. 99.99.2028']));
    expect(f.nom.value).toBeNull();
    expect(f.dateExpiration.value).toBeNull();
    expect(f.categories.value).toBeNull();
    expect(f.numeroPermis.value).toBeNull();
  });

  it('ignore les catégories hors liste', () => {
    expect(parseLicenceText(['9. Z Q 7']).categories.value).toBeNull();
  });
});

describe('plaque et VIN', () => {
  it('reconnaît la plaque marocaine dans les deux sens de lecture', () => {
    expect(findPlate('8921 | ب | 14')).toBe('8921 | ب | 14');
    expect(findPlate('14 | ب | 8921')).toBe('8921 | ب | 14');
    expect(findPlate('8921 | 14')).toBeNull(); // lettre arabe manquante : on laisse l'employé la saisir
  });
  it('corrige O/Q/I dans un VIN et rejette les longueurs incorrectes', () => {
    expect(findVin('UU1LSDAAH54321876')).toBe('UU1LSDAAH54321876');
    expect(findVin('UU1LSDAAH5432I876')).toBe('UU1LSDAAH54321876');
    expect(findVin('UU1LSDAAH5432187')).toBeNull();
  });
});

describe('parseRegistrationText', () => {
  const COLUMN_LAYOUT = [
    "Numéro d'immatriculation", '8921 | ب | 14', 'Première mise en circulation', '15/03/2021',
    'Marque', 'Type / Modèle', 'Genre', 'DACIA', 'LOGAN', 'VP',
    "N° de série dans la série du type (châssis)", 'UU1LSDAAH54321876', 'Carburant', 'DIESEL (GASOIL)',
    'Couleur', "Nombre de places", 'BLANC', '5',
  ];

  it('lit la carte grise spécimen (étiquettes puis valeurs, mise en colonnes)', () => {
    const f = parseRegistrationText(toLines(COLUMN_LAYOUT));
    expect(f.immatriculation.value).toBe('8921 | ب | 14');
    expect(f.annee.value).toBe(2021);
    expect(f.marque.value).toBe('DACIA');
    expect(f.modele.value).toBe('LOGAN');
    expect(f.vin.value).toBe('UU1LSDAAH54321876');
    expect(f.carburant.value).toBe('diesel');
    expect(f.couleur.value).toBe('BLANC');
    expect(f.nombrePlaces.value).toBe(5);
    expect(f.categorie.value).toBeNull(); // « VP » ne dit rien de la catégorie commerciale
    expect(f.finition.value).toBeNull();
  });

  it('lit aussi « étiquette valeur » sur une même ligne', () => {
    const f = parseRegistrationText(['Marque RENAULT', 'Modèle CLIO', 'Carburant ESSENCE', 'Couleur GRIS', 'Nombre de places 5']);
    expect(f.marque.value).toBe('RENAULT');
    expect(f.modele.value).toBe('CLIO');
    expect(f.carburant.value).toBe('essence');
    expect(f.couleur.value).toBe('GRIS');
    expect(f.nombrePlaces.value).toBe(5);
  });

  it('ne renvoie rien quand le texte ne contient rien d’exploitable', () => {
    const f = parseRegistrationText(toLines(['@@@', '...']));
    expect(Object.values(f).every((field) => field.value === null)).toBe(true);
  });

  it('coupe les lignes qui mélangent plusieurs colonnes (étiquettes côte à côte)', () => {
    const f = parseRegistrationText([
      "Numéro d'immatriculation Première mise en circulation",
      '8921 | ب | 14',
      '15/03/2021',
      'Marque Type / Modèle Genre',
      'DACIA',
      'LOGAN',
      'VP',
    ]);
    expect(f.immatriculation.value).toBe('8921 | ب | 14');
    expect(f.annee.value).toBe(2021);
    expect(f.marque.value).toBe('DACIA');
    expect(f.modele.value).toBe('LOGAN');
  });

  it("garde les chiffres de la plaque quand la lettre arabe n'est pas reconnue", () => {
    expect(findPlatePartial('8921 | 14')).toBe('8921 |  | 14');
    expect(findPlatePartial('8921 | u | 14')).toBe('8921 |  | 14');
    const f = parseRegistrationText(["Numéro d'immatriculation", '8921 | 14', 'Première mise en circulation', '15/03/2021']);
    expect(f.immatriculation).toEqual({ value: '8921 |  | 14', confidence: 'medium' });
  });

  it("retrouve l'année sans étiquette lisible (plus ancienne date passée)", () => {
    const f = parseRegistrationText(['15/03/2021', 'Date de validité', '14/03/2031']);
    expect(f.annee).toEqual({ value: 2021, confidence: 'medium' });
  });
});
