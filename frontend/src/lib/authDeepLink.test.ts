import { describe, expect, it } from 'vitest';
import { AUTH_DEEP_LINK_PREFIX, parseAuthDeepLink } from './authDeepLink';

describe('parseAuthDeepLink', () => {
  it('extracts tokens from the URL fragment', () => {
    const url = `${AUTH_DEEP_LINK_PREFIX}#access_token=aaa.bbb&refresh_token=ref-1&token_type=bearer`;
    expect(parseAuthDeepLink(url)).toEqual({
      kind: 'tokens',
      accessToken: 'aaa.bbb',
      refreshToken: 'ref-1',
    });
  });

  it('ignores URLs that are not the auth callback', () => {
    expect(parseAuthDeepLink('rajresumegenie://other/path#access_token=a&refresh_token=b')).toBeNull();
    expect(parseAuthDeepLink('https://evil.example/auth/callback#access_token=a')).toBeNull();
  });

  it('reports a denied sign-in', () => {
    const result = parseAuthDeepLink(`${AUTH_DEEP_LINK_PREFIX}#error=access_denied`);
    expect(result?.kind).toBe('error');
  });

  it.each([
    [`${AUTH_DEEP_LINK_PREFIX}`],
    [`${AUTH_DEEP_LINK_PREFIX}#access_token=only-access`],
    [`${AUTH_DEEP_LINK_PREFIX}#refresh_token=only-refresh`],
    [`${AUTH_DEEP_LINK_PREFIX}?access_token=a&refresh_token=b`],
  ])('rejects incomplete credentials: %s', (url) => {
    expect(parseAuthDeepLink(url)?.kind).toBe('error');
  });
});
