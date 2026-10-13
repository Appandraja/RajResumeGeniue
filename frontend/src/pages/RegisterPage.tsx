import { Divider, Link, Stack, Text } from '@chakra-ui/react';
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/auth/AuthLayout';
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton';
import { RegisterForm } from '../components/auth/RegisterForm';
import { useAuth } from '../hooks/useAuth';

export default function RegisterPage() {
  const { register, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleRegister = async (
    email: string,
    password: string,
    fullName: string,
  ): Promise<void> => {
    await register(email, password, fullName);
    navigate('/dashboard', { replace: true });
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Build ATS-friendly resumes in minutes."
      footer={
        <Text>
          Already have an account?{' '}
          <Link as={RouterLink} to="/login" color="purple.600" fontWeight="semibold">
            Sign in
          </Link>
        </Text>
      }
    >
      <Stack spacing={6}>
        <RegisterForm onSubmit={handleRegister} />
        <Stack direction="row" align="center">
          <Divider />
          <Text fontSize="sm" color="gray.500">
            or
          </Text>
          <Divider />
        </Stack>
        <GoogleLoginButton label="Sign up with Google" />
      </Stack>
    </AuthLayout>
  );
}
