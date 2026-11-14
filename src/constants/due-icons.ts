import type { MaintenanceType } from '@/features/maintenance/types';

/** Icônes des entretiens (trait noir sur fond transparent, à teinter) : disque de frein, pneu, bidon d'huile, clé plate. */
export const DUE_TYPE_IMAGE: Partial<Record<MaintenanceType, number>> = {
  freins: require('../../assets/images/due-icons/freins.png'),
  pneus: require('../../assets/images/due-icons/pneus.png'),
  vidange: require('../../assets/images/due-icons/vidange.png'),
  autre: require('../../assets/images/due-icons/autre.png'),
};
