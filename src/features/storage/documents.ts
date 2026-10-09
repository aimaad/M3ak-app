type TypedDocument = { type: string; path: string; uploadedAt: string };

/** Un seul document par type : le plus récent remplace le précédent. */
export function mergeDocuments<D extends TypedDocument>(existing: D[], incoming: D[]): D[] {
  const byType = new Map(existing.map((doc) => [doc.type, doc]));
  for (const doc of incoming) {
    byType.set(doc.type, doc);
  }
  return Array.from(byType.values());
}

export function findDocument<D extends TypedDocument>(documents: D[], type: D['type']): D | undefined {
  return documents.find((doc) => doc.type === type);
}
