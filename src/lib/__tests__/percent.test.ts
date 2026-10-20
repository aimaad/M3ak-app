import { clampPercentInput } from '../percent';

describe('clampPercentInput', () => {
  it('limite à 100', () => {
    expect(clampPercentInput('101')).toBe('100');
    expect(clampPercentInput('250')).toBe('100');
    expect(clampPercentInput('99999')).toBe('100');
  });
  it('garde les valeurs valides', () => {
    expect(clampPercentInput('0')).toBe('0');
    expect(clampPercentInput('55')).toBe('55');
    expect(clampPercentInput('100')).toBe('100');
  });
  it('ne garde que les chiffres et enlève les zéros inutiles', () => {
    expect(clampPercentInput('5a0')).toBe('50');
    expect(clampPercentInput('-3')).toBe('3');
    expect(clampPercentInput('007')).toBe('7');
    expect(clampPercentInput('')).toBe('');
  });
});
