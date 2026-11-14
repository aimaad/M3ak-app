import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { FlatList, Modal, Pressable, TextInput, View } from 'react-native';

import { Brand, homeTextFont, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

/** État vide : icône, titre, une phrase, et des puces d'action (« + Vidange »…) à la place des paragraphes d'explication. */
export function EmptyState({ icon, title, text, chips }: { icon: keyof typeof Ionicons.glyphMap; title: string; text?: string; chips?: { label: string; onPress: () => void }[] }) {
  return (
    <View style={{ backgroundColor: Brand.white, borderWidth: 1, borderColor: Palette.border, borderRadius: 18, padding: 16, gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={Brand.graphite} />
      </View>
      <View style={{ gap: 2 }}>
        <HText weight="semibold" size={15}>
          {title}
        </HText>
        {text ? (
          <HText size={13} color={Palette.textSecondary}>
            {text}
          </HText>
        ) : null}
      </View>
      {chips && chips.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {chips.map((chip) => (
            <Pressable key={chip.label} onPress={chip.onPress} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
              <View style={{ height: 36, borderRadius: 18, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface, paddingHorizontal: 12, justifyContent: 'center' }}>
                <HText weight="semibold" size={12}>
                  {chip.label}
                </HText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Bandeau d'information (carte graphite) : « 9 champs remplis depuis la carte grise. Il reste la boîte et le kilométrage. » */
export function InfoBanner({ strong, muted, icon = 'sparkles' }: { strong: string; muted?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View accessible accessibilityRole="summary" accessibilityLabel={[strong, muted].filter(Boolean).join(' ')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: Brand.graphite }}>
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: Brand.orangeDeep, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={16} color={Brand.orangeLight} />
      </View>
      <HText size={13} color={Brand.white} style={{ flex: 1, lineHeight: 18 }}>
        {strong}
        {muted ? <HText size={13} color={Brand.mutedOnDark}>{` ${muted}`}</HText> : null}
      </HText>
    </View>
  );
}

/** Petit titre de section (11 px, majuscules, interlettrage). */
export function SectionLabel({ children }: { children: string }) {
  return (
    <HText weight="semibold" size={11} track={0.16} color={Palette.textSecondary} accessibilityRole="header">
      {children.toLocaleUpperCase()}
    </HText>
  );
}

// ------------------------------------------------------------------ liste avec recherche

export type ListOption = { value: string; label: string; subtitle?: string };

/** Feuille avec recherche pour les longues listes (villes, nationalités) : champ « Rechercher », liste filtrée, choix en un tap. */
export function SearchList({ visible, title, options, selected, onSelect, onClose, searchable }: { visible: boolean; title: string; options: ListOption[]; selected: string | null; onSelect: (value: string) => void; onClose: () => void; searchable?: boolean }) {
  const { t, language } = useLanguage();
  const [query, setQuery] = useState('');
  const withSearch = searchable ?? options.length > 8;
  const needle = query.trim().toLowerCase();
  const shown = needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: Palette.overlay }} onPress={onClose} accessibilityLabel={t('form.close')} />
      <View style={{ maxHeight: '80%', backgroundColor: Brand.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, paddingBottom: 28, gap: 12 }}>
        <HText font="display" weight="bold" size={18} accessibilityRole="header">
          {title}
        </HText>
        {withSearch ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface, paddingHorizontal: 12 }}>
            <Ionicons name="search" size={16} color={Palette.textSecondary} />
            <TextInput value={query} onChangeText={setQuery} placeholder={t('form.search')} placeholderTextColor={Palette.textMuted} accessibilityLabel={t('form.search')} autoCorrect={false} style={{ flex: 1, padding: 0, fontFamily: homeTextFont(language, 'medium'), fontSize: 15, color: Brand.graphite }} />
          </View>
        ) : null}
        <FlatList
          data={shown}
          keyExtractor={(option) => option.value}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<HText size={13} color={Palette.textSecondary}>{t('form.noResult')}</HText>}
          renderItem={({ item }) => {
            const on = item.value === selected;
            return (
              <Pressable onPress={() => { setQuery(''); onSelect(item.value); onClose(); }} accessibilityRole="radio" accessibilityState={{ checked: on, selected: on }} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: Brand.listSeparator }}>
                <View style={{ flex: 1 }}>
                  <HText weight={on ? 'semibold' : 'medium'} size={15}>
                    {item.label}
                  </HText>
                  {item.subtitle ? (
                    <HText size={12} color={Palette.textSecondary}>
                      {item.subtitle}
                    </HText>
                  ) : null}
                </View>
                {on ? <Ionicons name="checkmark" size={18} color={Brand.orange} /> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

/** Champ qui ressemble à `FormField` mais ouvre une liste (`SearchList`) : villes, nationalités, carburant… `aiRead` : badge « IA ». */
export function SelectField({ label, value, placeholder, options, onChange, searchable, aiRead = false, title }: { label: string; value: string | null; placeholder?: string; options: ListOption[]; onChange: (value: string) => void; searchable?: boolean; aiRead?: boolean; title?: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [edited, setEdited] = useState(false);
  const shown = options.find((option) => option.value === value)?.label ?? '';
  return (
    <View style={{ gap: 6 }}>
      <HText weight="semibold" size={13} color={Palette.textSecondary} numberOfLines={1}>
        {label}
      </HText>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}${shown ? `: ${shown}` : ''}`} style={{ height: 56, borderRadius: 16, borderWidth: 1, borderColor: Palette.border, backgroundColor: Brand.white, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <HText weight="semibold" size={16} color={shown ? Palette.textPrimary : Palette.textMuted} style={{ flex: 1 }} numberOfLines={1}>
          {shown || placeholder || ''}
        </HText>
        {aiRead && !edited && shown ? (
          <View style={{ borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: Palette.successSoft }}>
            <HText weight="bold" size={10} color={Palette.success}>
              {t('form.ai')}
            </HText>
          </View>
        ) : null}
        <Ionicons name="chevron-down" size={16} color={Palette.textSecondary} />
      </Pressable>
      <SearchList visible={open} title={title ?? label} options={options} selected={value} searchable={searchable} onSelect={(next) => { setEdited(true); onChange(next); }} onClose={() => setOpen(false)} />
    </View>
  );
}

/** Carte blanche (surface du kit) pour grouper des champs. */
export function Panel({ children, gap = 16 }: { children: ReactNode; gap?: number }) {
  return <View style={{ backgroundColor: Brand.white, borderWidth: 1, borderColor: Palette.border, borderRadius: 18, padding: 16, gap }}>{children}</View>;
}
