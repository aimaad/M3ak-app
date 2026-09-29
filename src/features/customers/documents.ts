import type { CustomerDocument } from './types';

/** Un seul document par type : le plus récent remplace le précédent. */
export function mergeDocuments(
  existing: CustomerDocument[],
  incoming: CustomerDocument[]
): CustomerDocument[] {
  const byType = new Map(existing.map((doc) => [doc.type, doc]));
  for (const doc of incoming) {
    byType.set(doc.type, doc);
  }
  return Array.from(byType.values());
}

export function findDocument(
  documents: CustomerDocument[],
  type: CustomerDocument['type']
): CustomerDocument | undefined {
  return documents.find((doc) => doc.type === type);
}
