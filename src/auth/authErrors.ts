// Map Firebase auth error codes to user-readable messages. The default
// `e.message` exposes internal strings like "Firebase: Error (auth/...)"
// which leak implementation detail and look broken.

const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address looks malformed.',
  'auth/user-disabled': 'This account is disabled. Contact an administrator.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/invalid-login-credentials': 'Email or password is incorrect.',
  'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
  'auth/network-request-failed': 'Network error. Check your connection.',
};

export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? '';
  if (code && MESSAGES[code]) return MESSAGES[code];
  return 'Sign-in failed. Check your email and password.';
}
