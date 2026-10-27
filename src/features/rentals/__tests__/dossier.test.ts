import { balanceDue, formatDelay, kmDriven } from '../dossier';

describe('kmDriven', () => {
  it('calcule les kilomètres parcourus', () => {
    expect(kmDriven(45000, 45620)).toBe(620);
    expect(kmDriven(45000, 45000)).toBe(0);
  });
  it('renvoie null si un relevé manque ou si le retour est inférieur au départ', () => {
    expect(kmDriven(null, 100)).toBeNull();
    expect(kmDriven(100, null)).toBeNull();
    expect(kmDriven(500, 400)).toBeNull();
  });
});

describe('formatDelay', () => {
  it('formate minutes, heures et jours', () => {
    expect(formatDelay(45)).toBe('45 min');
    expect(formatDelay(60)).toBe('1 h');
    expect(formatDelay(200)).toBe('3 h 20');
    expect(formatDelay(1440)).toBe('1 j');
    expect(formatDelay(1440 + 250)).toBe('1 j 4 h');
  });
  it('ne montre rien sans retard', () => {
    expect(formatDelay(0)).toBeNull();
    expect(formatDelay(null)).toBeNull();
    expect(formatDelay(-5)).toBeNull();
  });
});

describe('balanceDue', () => {
  it('ne descend jamais sous zéro', () => {
    expect(balanceDue(1500, 500)).toBe(1000);
    expect(balanceDue(1500, 2000)).toBe(0);
    expect(balanceDue(null, 100)).toBeNull();
  });
});
