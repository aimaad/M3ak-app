import { displayCase, displayName } from '../names';

describe('affichage de la marque et du modèle', () => {
  it('« DACIA LOGAN » → « Dacia Logan » sans toucher la donnée', () => {
    const vehicle = { marque: 'DACIA', modele: 'LOGAN' };
    expect(displayName(vehicle)).toBe('Dacia Logan');
    expect(vehicle).toEqual({ marque: 'DACIA', modele: 'LOGAN' });
  });
  it('plusieurs mots, tirets et chiffres', () => {
    expect(displayName({ marque: 'RENAULT', modele: 'CLIO 5' })).toBe('Renault Clio 5');
    expect(displayName({ marque: 'DACIA', modele: 'SANDERO STEPWAY' })).toBe('Dacia Sandero Stepway');
    expect(displayCase('MERCEDES-BENZ')).toBe('Mercedes-Benz');
    expect(displayCase('PEUGEOT 3008 GT')).toBe('Peugeot 3008 GT'); // « GT » : sigle court
  });
  it('les sigles courts restent en majuscules', () => {
    expect(displayName({ marque: 'BMW', modele: 'X1' })).toBe('BMW X1');
    expect(displayName({ marque: 'DS', modele: 'DS 3' })).toBe('DS DS 3');
    expect(displayCase('VW')).toBe('VW');
    expect(displayCase('MG')).toBe('MG');
  });
  it('les mots avec un chiffre, ou déjà en casse mixte, ne changent pas ; « KIA » devient « Kia »', () => {
    expect(displayCase('C3')).toBe('C3');
    expect(displayCase('i20')).toBe('i20');
    expect(displayCase('T-Roc')).toBe('T-Roc');
    expect(displayCase('Sandero')).toBe('Sandero');
    expect(displayCase('iPace')).toBe('iPace');
    expect(displayName({ marque: 'KIA', modele: 'PICANTO' })).toBe('Kia Picanto');
  });
  it('arabe ou vide : intacts', () => {
    expect(displayCase('داسيا')).toBe('داسيا');
    expect(displayName({ marque: '', modele: '' })).toBe('');
    expect(displayName({ marque: 'Dacia', modele: '' })).toBe('Dacia');
  });
});
