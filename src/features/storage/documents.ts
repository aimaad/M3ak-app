type TypedDocument<T extends string> = { type: T; path: string; uploadedAt: string };

/** Un seul document par type : le plus récent remplace le précédent. */
export function mergeDocuments<T extends string>(
  existing: TypedDocument<T>[],
  incoming: TypedDocument<T>[]
): TypedDocument<T>[] {
  const byType = new Map(existing.map((doc) => [doc.type, doc]));
  for (const doc of incoming) {
    byType.set(doc.type, doc);
  }
  return Array.from(byType.values());
}

export function findDocument<T extends string>(
  documents: TypedDocument<T>[],
  type: T
): TypedDocument<T> | undefined {
  return documents.find((doc) => doc.type === type);
}
