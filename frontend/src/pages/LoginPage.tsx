import { Container, Divider, Heading, Link, Stack, Text } from '@chakra-ui/react';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton';
import { LoginForm } from '../components/auth/LoginForm';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { useAuth } from '../hooks/useAuth';

interface LocationState {
  from?: string;
}

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from ?? '/dashboard';

  if (!isLoading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleLogin = async (email: string, password: string): Promise<void> => {
    await login(email, password);
    navigate(from, { replace: true });
  };

  return (
    <PageWrapper>
      <Container maxW="md" py={16}>
        <GlassCard>
          <Stack spacing={6}>
            <Stack spacing={1}>
              <Heading as="h1" size="lg">
                Welcome back
              </Heading>
              <Text color="gray.600">Sign in to continue to RajResumeGenie.</Text>
            </Stack>
            <LoginForm onSubmit={handleLogin} />
            <Stack direction="row" align="center">
              <Divider />
              <Text fontSize="sm" color="gray.500">
                or
              </Text>
              <Divider />
            </Stack>
            <GoogleLoginButton />
            <Text fontSize="sm" textAlign="center">
              New here?{' '}
              <Link as={RouterLink} to="/register" color="purple.600" fontWeight="semibold">
                Create an account
              </Link>
            </Text>
          </Stack>
        </GlassCard>
      </Container>
    </PageWrapper>
  );
}
