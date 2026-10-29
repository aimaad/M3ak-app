import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { InspectionAnalysisScreen } from '@/features/inspections/inspection-analysis-screen';
import type { InspectionType } from '@/features/inspections/types';
import { useRental } from '@/features/rentals/hooks';

export default function InspectionAnalyseScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const { data: rental } = useRental(id);
  const inspectionType: InspectionType = type === 'depart' ? 'depart' : 'retour';

  if (!rental) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator color="#7C3AED" />
      </ThemedView>
    );
  }

  return <InspectionAnalysisScreen rentalId={rental.id} agencyId={rental.agencyId} type={inspectionType} />;
}
