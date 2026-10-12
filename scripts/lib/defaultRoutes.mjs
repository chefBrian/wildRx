// Same as DEFAULT_ROUTES in src/domain/concentrations.ts (scripts can't import TypeScript at
// runtime); defaultRoutes.test.mjs pins the two. IV is never a default.
export const DEFAULT_ROUTES = {
  injectable: ['PO', 'IM', 'SC'],
  oral: ['PO'],
  topical: ['topical'],
  other: [],
};
