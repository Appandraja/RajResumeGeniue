/** Custom URL scheme the Android app registers (must match AndroidManifest.xml). */
export const AUTH_DEEP_LINK_PREFIX = 'rajresumegenie://auth/callback';

export type AuthDeepLinkResult =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'error'; message: string };

/**
 * Parses the URL the backend redirects to after Google sign-in
 * (`rajresumegenie://auth/callback#access_token=...&refresh_token=...`).
 * Returns null for URLs that are not an auth callback.
 */
export function parseAuthDeepLink(url: string): AuthDeepLinkResult | null {
  if (!url.startsWith(AUTH_DEEP_LINK_PREFIX)) {
    return null;
  }
  const hashIndex = url.indexOf('#');
  const params = new URLSearchParams(hashIndex === -1 ? '' : url.slice(hashIndex + 1));

  const error = params.get('error');
  if (error) {
    return { kind: 'error', message: 'Google sign-in was cancelled or denied.' };
  }
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) {
    return { kind: 'error', message: 'Google sign-in did not return valid credentials.' };
  }
  return { kind: 'tokens', accessToken, refreshToken };
}
