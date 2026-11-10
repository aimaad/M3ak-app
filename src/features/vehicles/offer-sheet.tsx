import { useState } from 'react';
import { Modal, Pressable, ScrollView, Share, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { HText, MicroLabel } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { buildOfferMessage, discountedPrice, OFFER_DAYS, OFFER_PERCENTS, type OfferDays, type OfferPercent } from './offer';

/**
 * Feuille « Créer l'offre » : remise (10, 15 ou 20 %), jours, aperçu du message et « Partager » (WhatsApp ou partage du téléphone).
 * Rien n'est enregistré.
 */
export function OfferSheet({ visible, onClose, vehicleName, price, agencyName }: { visible: boolean; onClose: () => void; vehicleName: string; price: number | null; agencyName: string | null }) {
  const { t, language } = useLanguage();
  const [percent, setPercent] = useState<OfferPercent>(10);
  const [days, setDays] = useState<OfferDays>('weekend');
  const message = price && price > 0 ? buildOfferMessage({ vehicleName, price, percent, days, now: new Date(), language, agencyName }) : null;

  const chip = (selected: boolean) => ({
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: selected ? Brand.graphite : Palette.border,
    backgroundColor: selected ? Brand.graphite : Palette.card,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(32,37,39,0.55)' }} onPress={onClose} accessibilityLabel={t('flotte.offer.close')} />
      <View style={{ backgroundColor: Palette.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, maxHeight: '85%' }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <HText font="display" weight="bold" size={20}>
              {t('flotte.offer.title')}
            </HText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('flotte.offer.close')} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
              <HText weight="semibold" size={14} color={Palette.textSecondary}>
                {t('flotte.offer.close')}
              </HText>
            </Pressable>
          </View>

          <View style={{ gap: 4 }}>
            <MicroLabel size={10} color={Palette.textSecondary}>
              {t('flotte.offer.vehicle')}
            </MicroLabel>
            <HText weight="semibold" size={16}>
              {vehicleName}
            </HText>
          </View>

          <View style={{ gap: 8 }}>
            <MicroLabel size={10} color={Palette.textSecondary}>
              {t('flotte.offer.discount')}
            </MicroLabel>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {OFFER_PERCENTS.map((value) => (
                <Pressable key={value} onPress={() => setPercent(value)} accessibilityRole="button" accessibilityState={{ selected: percent === value }} style={chip(percent === value)}>
                  <HText weight="semibold" size={14} color={percent === value ? Brand.white : Palette.textPrimary}>
                    {t('flotte.offer.percent', { percent: value })}
                  </HText>
                </Pressable>
              ))}
            </View>
            {price ? (
              <HText size={13} color={Palette.textSecondary}>
                {`${discountedPrice(price, percent)} MAD/j · ${price} MAD/j`}
              </HText>
            ) : null}
          </View>

          <View style={{ gap: 8 }}>
            <MicroLabel size={10} color={Palette.textSecondary}>
              {t('flotte.offer.days')}
            </MicroLabel>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {OFFER_DAYS.map((value) => (
                <Pressable key={value} onPress={() => setDays(value)} accessibilityRole="button" accessibilityState={{ selected: days === value }} style={chip(days === value)}>
                  <HText weight="semibold" size={14} color={days === value ? Brand.white : Palette.textPrimary}>
                    {t(`flotte.offer.${value}`)}
                  </HText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <MicroLabel size={10} color={Palette.textSecondary}>
              {t('flotte.offer.preview')}
            </MicroLabel>
            <View style={{ backgroundColor: Palette.surface, borderRadius: 16, padding: 14 }}>
              <HText size={15} style={{ lineHeight: 22, writingDirection: 'auto' }} selectable>
                {message ?? t('flotte.offer.priceMissing')}
              </HText>
            </View>
          </View>

          <Pressable
            disabled={!message}
            onPress={() => message && void Share.share({ message })}
            accessibilityRole="button"
            style={{ minHeight: 52, borderRadius: 26, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center', opacity: message ? 1 : 0.5, shadowColor: Brand.orange, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
          >
            <HText weight="semibold" size={16} color={Brand.white}>
              {t('flotte.offer.share')}
            </HText>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
