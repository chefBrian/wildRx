import type { Route } from './types';

export const ROUTES: Route[] = ['PO', 'IM', 'SC', 'IV', 'topical'];

export const ROUTE_PLAIN: Record<Route, string> = {
  PO: 'By mouth',
  IM: 'Into muscle',
  SC: 'Under skin',
  IV: 'Into vein',
  topical: 'On skin',
};
