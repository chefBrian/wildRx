// Same as src/domain/ruleId.ts (scripts can't import TypeScript at runtime).
// scripts/lib/ruleId.test.mjs pins the two together; firestore.rules checks the same format.
export function ruleId(medId, target, route) {
  return `${medId}__${target.type}-${target.value}__${route}`;
}
