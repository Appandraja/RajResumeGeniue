import { useEffect, useRef, useState } from 'react';
import { Alert, AlertIcon, Center, Container, Link, Spinner, Stack, Text } from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { useAuth } from '../hooks/useAuth';

interface CallbackTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

function readTokensFromFragment(): CallbackTokens {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return { accessToken: params.get('access_token'), refreshToken: params.get('refresh_token') };
}

const INVALID_CREDENTIALS = 'Google sign-in did not return valid credentials.';

export default function AuthCallbackPage() {
  const { loginWithTokens } = useAuth();
  const navigate = useNavigate();
  const [tokens] = useState<CallbackTokens>(readTokensFromFragment);
  const [error, setError] = useState<string | null>(
    tokens.accessToken && tokens.refreshToken ? null : INVALID_CREDENTIALS,
  );
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    // Remove tokens from the address bar / history immediately.
    window.history.replaceState(null, '', window.location.pathname);

    if (!tokens.accessToken || !tokens.refreshToken) return;

    loginWithTokens({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken })
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(() => setError('We could not complete your Google sign-in. Please try again.'));
  }, [tokens, loginWithTokens, navigate]);

  return (
    <PageWrapper>
      <Container maxW="md" py={24}>
        {error ? (
          <Stack spacing={4}>
            <Alert status="error" rounded="md" role="alert">
              <AlertIcon />
              {error}
            </Alert>
            <Link as={RouterLink} to="/login" color="purple.600" textAlign="center">
              Back to sign in
            </Link>
          </Stack>
        ) : (
          <Center flexDirection="column" gap={4}>
            <Spinner size="xl" color="purple.500" thickness="4px" />
            <Text color="gray.600">Completing sign-in...</Text>
          </Center>
        )}
      </Container>
    </PageWrapper>
  );
}
