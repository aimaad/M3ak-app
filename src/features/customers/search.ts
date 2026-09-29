import type { Customer } from './types';

export function searchCustomers(customers: Customer[], query: string): Customer[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return customers;

  return customers.filter((customer) => {
    return (
      customer.nomComplet.toLowerCase().includes(normalized) ||
      (customer.telephone?.toLowerCase().includes(normalized) ?? false) ||
      (customer.cinOuPasseport?.toLowerCase().includes(normalized) ?? false)
    );
  });
}
