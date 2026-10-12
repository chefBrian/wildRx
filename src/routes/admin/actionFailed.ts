/**
 * "Save failed: Missing or insufficient permissions." Every admin write shows this on
 * failure instead of an unhandled rejection or a button that silently re-enables.
 */
export function actionFailed(action: string, err: unknown): string {
  return `${action} failed: ${err instanceof Error ? err.message : String(err)}`;
}
