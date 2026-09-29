import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { InspectionCaptureScreen } from '@/features/inspections/inspection-capture-screen';
import { useRental } from '@/features/rentals/hooks';

export default function InspectionRetourScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: rental } = useRental(id);

  if (!rental) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator color="#1f5eff" />
      </ThemedView>
    );
  }

  return (
    <InspectionCaptureScreen
      rentalId={rental.id}
      vehicleId={rental.vehicleId}
      agencyId={rental.agencyId}
      type="retour"
    />
  );
}
