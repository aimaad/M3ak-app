import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { buildCsv, downloadTextFile } from '@/lib/csv';
import { useLanguage } from '@/i18n/use-language';
import { M3akPalette } from '@/constants/theme';

export type DataTableColumn<T> = {
  key: string;
  label: string;
  /** Poids de la colonne (défaut 1). */
  flex?: number;
  align?: 'start' | 'end';
  render: (item: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (item: T) => string;
  onRowPress?: (item: T) => void;
  emptyLabel: string;
  /** Export de TOUTES les lignes (par exemple toute la liste filtrée, pas seulement la page affichée). */
  exportCsv?: { filename: string; rows: T[]; cells: (item: T) => unknown[] };
};

/** Tableau pour la version web sur grand écran : en-têtes, lignes cliquables, survol. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowPress,
  emptyLabel,
  exportCsv,
}: DataTableProps<T>) {
  const { t } = useLanguage();
  const [hovered, setHovered] = useState<string | null>(null);

  function handleExport() {
    if (!exportCsv) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      `${exportCsv.filename}-${stamp}.csv`,
      buildCsv(
        columns.map((column) => column.label),
        exportCsv.rows.map(exportCsv.cells)
      )
    );
  }

  return (
    <View className="gap-3">
      {exportCsv ? (
        <View className="items-end">
          <Pressable
            onPress={handleExport}
            accessibilityRole="button"
            className="min-h-10 flex-row items-center rounded-full border border-line bg-white px-4"
          >
            <ThemedText type="smallBold" themeColor="primary">
              {t('desktop.exportCsv', { count: exportCsv.rows.length })}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
      <View className="overflow-hidden rounded-3xl border border-line bg-white">
        <View className="flex-row border-b border-line bg-canvas px-5 py-3">
          {columns.map((column) => (
            <View
              key={column.key}
              style={{ flex: column.flex ?? 1 }}
              className={column.align === 'end' ? 'items-end' : ''}
            >
              <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: '700' }}>
                {column.label}
              </ThemedText>
            </View>
          ))}
        </View>
        {rows.length === 0 ? (
          <View className="items-center px-5 py-10">
            <ThemedText type="default" themeColor="textSecondary">
              {emptyLabel}
            </ThemedText>
          </View>
        ) : (
          rows.map((item) => {
            const key = rowKey(item);
            return (
              <Pressable
                key={key}
                onPress={onRowPress ? () => onRowPress(item) : undefined}
                onHoverIn={() => setHovered(key)}
                onHoverOut={() => setHovered((current) => (current === key ? null : current))}
                accessibilityRole={onRowPress ? 'link' : undefined}
                className="min-h-14 flex-row items-center border-b border-line-soft px-5 py-3"
                style={{ backgroundColor: hovered === key ? M3akPalette.background : '#FFFFFF' }}
              >
                {columns.map((column) => (
                  <View
                    key={column.key}
                    style={{ flex: column.flex ?? 1 }}
                    className={`pe-3 ${column.align === 'end' ? 'items-end' : ''}`}
                  >
                    {column.render(item)}
                  </View>
                ))}
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}
