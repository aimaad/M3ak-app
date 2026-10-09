import type { Customer } from './types';

export function searchCustomers(customers: Customer[], query: string): Customer[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return customers;

  return customers.filter((customer) => {
    return (
      customer.nomComplet.toLowerCase().includes(normalized) ||
      (customer.telephone?.toLowerCase().includes(normalized) ?? false) ||
      (customer.telephoneSecondaire?.toLowerCase().includes(normalized) ?? false) ||
      (customer.email?.toLowerCase().includes(normalized) ?? false) ||
      (customer.cinOuPasseport?.toLowerCase().includes(normalized) ?? false) ||
      (customer.raisonSociale?.toLowerCase().includes(normalized) ?? false) ||
      customer.documents.some((doc) => doc.reference?.toLowerCase().includes(normalized))
    );
  });
}
