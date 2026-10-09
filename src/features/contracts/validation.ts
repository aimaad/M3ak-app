import type { AccessoryKey, VehicleCondition } from './types';

export type DepartContractFormValues = {
  etatDepart: VehicleCondition | null;
  accessoiresDepart: AccessoryKey[];
  observationsDepart: string;
};

export type RetourContractFormValues = {
  etatRetour: VehicleCondition | null;
  accessoiresRetour: AccessoryKey[];
  observationsRetour: string;
  fraisJustification: string;
};

export type ContractFormErrorCode = 'required';

export function validateDepartContractForm(values: DepartContractFormValues): Partial<Record<'etatDepart', ContractFormErrorCode>> {
  return values.etatDepart ? {} : { etatDepart: 'required' };
}

export function validateRetourContractForm(values: RetourContractFormValues): Partial<Record<'etatRetour', ContractFormErrorCode>> {
  return values.etatRetour ? {} : { etatRetour: 'required' };
}
