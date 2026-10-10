import { buildFullName, readNamesFromMetadata } from '../names';

describe('buildFullName', () => {
  it('assemble prénom et nom sans espaces superflus', () => {
    expect(buildFullName({ prenom: ' Imad ', nom: ' Alaoui ' })).toBe('Imad Alaoui');
  });
});

describe('readNamesFromMetadata', () => {
  it('lit prénom et nom des métadonnées', () => {
    expect(readNamesFromMetadata({ prenom: 'Imad', nom: 'Alaoui' })).toEqual({ prenom: 'Imad', nom: 'Alaoui' });
  });

  it('renvoie null si un des deux manque', () => {
    expect(readNamesFromMetadata({ prenom: 'Imad' })).toBeNull();
    expect(readNamesFromMetadata(undefined)).toBeNull();
    expect(readNamesFromMetadata({ prenom: 3, nom: 'X' })).toBeNull();
  });
});
