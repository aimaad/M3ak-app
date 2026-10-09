import { findDocument, mergeDocuments } from '../documents';

type TestDoc = { type: 'cin' | 'permis'; path: string; uploadedAt: string };

describe('mergeDocuments', () => {
  it('ajoute un nouveau type de document', () => {
    const existing: TestDoc[] = [{ type: 'cin', path: 'a/cin.jpg', uploadedAt: '2026-01-01' }];
    const incoming: TestDoc[] = [{ type: 'permis', path: 'a/permis.jpg', uploadedAt: '2026-01-02' }];

    const result = mergeDocuments(existing, incoming);
    expect(result).toHaveLength(2);
    expect(findDocument(result, 'cin')?.path).toBe('a/cin.jpg');
    expect(findDocument(result, 'permis')?.path).toBe('a/permis.jpg');
  });

  it('remplace un document existant du même type par le plus récent', () => {
    const existing: TestDoc[] = [{ type: 'cin', path: 'a/old.jpg', uploadedAt: '2026-01-01' }];
    const incoming: TestDoc[] = [{ type: 'cin', path: 'a/new.jpg', uploadedAt: '2026-02-01' }];

    const result = mergeDocuments(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('a/new.jpg');
  });
});

describe('findDocument', () => {
  it("renvoie undefined si le type n'existe pas", () => {
    expect(findDocument([] as TestDoc[], 'cin')).toBeUndefined();
  });
});
