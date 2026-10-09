import { searchCustomers } from './search';
import type { Customer, CustomerType } from './types';

export type CustomerFilters = {
  query: string;
  typeClient: CustomerType | 'tous';
  includeArchived: boolean;
};

export const DEFAULT_CUSTOMER_FILTERS: CustomerFilters = {
  query: '',
  typeClient: 'tous',
  includeArchived: false,
};

export function filterCustomers(customers: Customer[], filters: CustomerFilters): Customer[] {
  const byLifecycle = customers.filter((c) => (filters.includeArchived ? !!c.archivedAt : !c.archivedAt));
  const byType = filters.typeClient === 'tous' ? byLifecycle : byLifecycle.filter((c) => c.typeClient === filters.typeClient);
  return searchCustomers(byType, filters.query);
}

export function countActive(customers: Customer[]): number {
  return customers.filter((c) => !c.archivedAt).length;
}

export function countArchived(customers: Customer[]): number {
  return customers.filter((c) => !!c.archivedAt).length;
}

export function countExpiringSoonDocuments(customers: Customer[], withinDays = 30, now: Date = new Date()): number {
  const limit = new Date(now);
  limit.setDate(limit.getDate() + withinDays);

  let count = 0;
  for (const customer of customers) {
    if (customer.archivedAt) continue;
    for (const doc of customer.documents) {
      if (!doc.expiresAt) continue;
      if (new Date(doc.expiresAt).getTime() <= limit.getTime()) count += 1;
    }
  }
  return count;
}
