import { chunkForSpeech, takeSentences } from '../stream';

describe('takeSentences (voix par phrases)', () => {
  it('ne rend que les phrases terminées pendant le flux', () => {
    const text = 'Bonjour, voici la liste des véhicules libres. Il y en a trois et';
    const first = takeSentences(text, 0);
    expect(first.sentences).toEqual(['Bonjour, voici la liste des véhicules libres.']);
    expect(text.slice(first.next).trim()).toBe('Il y en a trois et');
  });
  it('reprend où on s’est arrêté, sans répéter', () => {
    const text = 'Bonjour, voici la liste des véhicules libres. Il y en a trois pour demain. Le reste';
    const first = takeSentences(text, 0);
    const second = takeSentences(text, first.next);
    expect(first.sentences).toHaveLength(2);
    expect(second.sentences).toEqual([]);
  });
  it('regroupe les phrases trop courtes avec la suivante', () => {
    expect(takeSentences('Oui. Je regarde cela tout de suite pour vous. Un instant', 0).sentences).toEqual(['Oui. Je regarde cela tout de suite pour vous.']);
  });
  it('ne coupe pas un nombre décimal ni une fin de texte non confirmée', () => {
    expect(takeSentences('Le taux est de 12.5 pour cent aujourd’hui', 0).sentences).toEqual([]);
    expect(takeSentences('Une phrase assez longue pour être lue.', 0).sentences).toEqual([]);
  });
  it('à la fin, rend tout le reste, même court', () => {
    const text = 'Voici la liste complète des locations. Merci';
    const first = takeSentences(text, 0);
    const last = takeSentences(text, first.next, true);
    expect(last.sentences).toEqual(['Merci']);
    expect(last.next).toBe(text.length);
  });
  it('marche en arabe (؟ et .)', () => {
    expect(takeSentences('هاد الطوموبيل خدامة دابا فالكراج؟ كاين جوج ديال الكرايات اليوم. الباقي', 0).sentences).toHaveLength(2);
  });
});

describe('chunkForSpeech (lecture d’une réponse écrite)', () => {
  it('regroupe les phrases sans dépasser la limite', () => {
    const sentence = 'Ceci est une phrase assez longue pour compter.';
    const chunks = chunkForSpeech(Array(30).fill(sentence).join(' '), 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 200)).toBe(true);
    expect(chunks.join(' ').split(sentence).length - 1).toBe(30);
  });
  it('coupe une phrase interminable et ignore le vide', () => {
    expect(chunkForSpeech('a'.repeat(1300)).map((c) => c.length)).toEqual([600, 600, 100]);
    expect(chunkForSpeech('   ')).toEqual([]);
  });
});
