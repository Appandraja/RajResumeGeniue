import { Alert, AlertIcon, Divider, Link, Stack, Text } from '@chakra-ui/react';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/auth/AuthLayout';
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton';
import { LoginForm } from '../components/auth/LoginForm';
import { useAuth } from '../hooks/useAuth';

interface LocationState {
  from?: string;
  passwordReset?: boolean;
}

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const from = state?.from ?? '/dashboard';
  const passwordReset = state?.passwordReset === true;

  if (!isLoading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleLogin = async (email: string, password: string): Promise<void> => {
    await login(email, password);
    navigate(from, { replace: true });
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to RajResumeGenie."
      footer={
        <Text>
          New here?{' '}
          <Link as={RouterLink} to="/register" color="purple.600" fontWeight="semibold">
            Create an account
          </Link>
        </Text>
      }
    >
      <Stack spacing={6}>
        {passwordReset && (
          <Alert status="success" rounded="lg" role="status">
            <AlertIcon />
            Password updated. Please sign in.
          </Alert>
        )}
        <LoginForm onSubmit={handleLogin} />
        <Stack direction="row" align="center">
          <Divider />
          <Text fontSize="sm" color="gray.500">
            or
          </Text>
          <Divider />
        </Stack>
        <GoogleLoginButton />
      </Stack>
    </AuthLayout>
  );
}
