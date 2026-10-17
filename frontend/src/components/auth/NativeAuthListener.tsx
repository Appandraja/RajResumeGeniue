import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { useNavigate } from 'react-router-dom';
import { parseAuthDeepLink } from '../../lib/authDeepLink';
import { isNativeApp } from '../../lib/platform';
import { useAuth } from '../../hooks/useAuth';

/**
 * Completes Google sign-in in the Android app: the system browser hands control back via
 * rajresumegenie://auth/callback#..., which arrives here as an `appUrlOpen` event.
 * Renders nothing and does nothing in a regular browser.
 */
export function NativeAuthListener() {
  const { loginWithTokens } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) {
      return undefined;
    }

    const subscription = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      const result = parseAuthDeepLink(url);
      if (result === null) {
        return;
      }
      void Browser.close().catch(() => undefined);

      if (result.kind === 'error') {
        navigate('/login', { replace: true });
        return;
      }
      loginWithTokens({ access_token: result.accessToken, refresh_token: result.refreshToken })
        .then(() => navigate('/dashboard', { replace: true }))
        .catch(() => navigate('/login', { replace: true }));
    });

    return () => {
      void subscription.then((handle) => handle.remove());
    };
  }, [loginWithTokens, navigate]);

  return null;
}
