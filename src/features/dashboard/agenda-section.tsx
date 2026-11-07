import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Palette } from '@/constants/theme';
import type { Customer } from '@/features/customers/types';
import type { Rental } from '@/features/rentals/types';
import type { Vehicle } from '@/features/vehicles/types';
import { useLanguage } from '@/i18n/use-language';

import { ArrowLink, HText, MicroLabel } from './home-ui';
import type { RentalFocus } from './kpis';
import { upcomingRentals } from './upcoming';

/** « Agenda » : réservations à confirmer et locations des 7 prochains jours, avec les deux prochaines locations. */
export function AgendaSection({
  rentals,
  customers,
  vehicles,
  pendingConfirmation,
  upcoming7Days,
  onOpenFocus,
}: {
  rentals: Rental[];
  customers: Customer[];
  vehicles: Vehicle[];
  pendingConfirmation: number;
  upcoming7Days: number;
  onOpenFocus: (focus: RentalFocus) => void;
}) {
  const { t, language } = useLanguage();
  const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';
  const next = upcomingRentals(rentals, new Date(), 2);
  return (
    <View style={{ gap: 14, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <MicroLabel size={11} track={0.16}>
          {t('accueil.home.agenda.title')}
        </MicroLabel>
        <ArrowLink label={t('accueil.home.agenda.planning')} onPress={() => router.push('/locations/calendrier')} />
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Tile icon="hourglass-outline" value={pendingConfirmation} label={t('accueil.home.agenda.toConfirm')} onPress={() => onOpenFocus('pending')} />
        <Tile icon="calendar-outline" value={upcoming7Days} label={t('accueil.home.agenda.upcoming')} onPress={() => onOpenFocus('upcoming')} />
      </View>

      {next.length === 0 ? (
        <Pressable
          onPress={() => router.push('/locations/nouveau')}
          accessibilityRole="button"
          style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: Palette.textMuted, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 }}
        >
          <HText size={13} color={Palette.textSecondary} style={{ flex: 1 }}>
            {t('accueil.home.agenda.emptyWeek')}
          </HText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <HText weight="semibold" size={13} numberOfLines={1}>
              {t('accueil.home.agenda.book')}
            </HText>
            <ArrowGlyph />
          </View>
        </Pressable>
      ) : (
        <View style={{ gap: 8 }}>
          {next.map((rental) => {
            const customer = customers.find((c) => c.id === rental.customerId);
            const vehicle = vehicles.find((v) => v.id === rental.vehicleId);
            const when = new Date(rental.dateDebutPrevue);
            return (
              <Pressable
                key={rental.id}
                onPress={() => router.push({ pathname: '/locations/[id]', params: { id: rental.id } })}
                accessibilityRole="button"
                style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Palette.border, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: Palette.card }}
              >
                <View style={{ width: 56 }}>
                  <HText weight="semibold" size={13}>
                    {when.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                  </HText>
                  <HText size={12} color={Palette.textSecondary}>
                    {when.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                  </HText>
                </View>
                <View style={{ flex: 1 }}>
                  <HText weight="semibold" size={14} numberOfLines={1}>
                    {vehicle ? `${vehicle.marque} ${vehicle.modele}` : t('locations.unknownVehicle')}
                  </HText>
                  <HText size={12} color={Palette.textSecondary} numberOfLines={1}>
                    {customer?.nomComplet ?? t('locations.unknownCustomer')}
                  </HText>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function ArrowGlyph() {
  const { language } = useLanguage();
  return <Ionicons name={language === 'ar' ? 'arrow-back' : 'arrow-forward'} size={15} color={Palette.primary} />;
}

function Tile({ icon, value, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; value: number; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      style={{ flex: 1, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Palette.border, borderRadius: 18, padding: 14, backgroundColor: Palette.card }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={Palette.textPrimary} />
      </View>
      <View style={{ flexShrink: 1, gap: 2 }}>
        <HText font="display" weight="semibold" size={20} style={{ lineHeight: 22 }}>
          {String(value)}
        </HText>
        <HText size={12} color={Palette.textSecondary} numberOfLines={2}>
          {label}
        </HText>
      </View>
    </Pressable>
  );
}
