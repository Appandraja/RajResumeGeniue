import { Container, Divider, Heading, Link, Stack, Text } from '@chakra-ui/react';
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom';
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton';
import { RegisterForm } from '../components/auth/RegisterForm';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
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
    <PageWrapper>
      <Container maxW="md" py={16}>
        <GlassCard>
          <Stack spacing={6}>
            <Stack spacing={1}>
              <Heading as="h1" size="lg">
                Create your account
              </Heading>
              <Text color="gray.600">Build ATS-friendly resumes in minutes.</Text>
            </Stack>
            <RegisterForm onSubmit={handleRegister} />
            <Stack direction="row" align="center">
              <Divider />
              <Text fontSize="sm" color="gray.500">
                or
              </Text>
              <Divider />
            </Stack>
            <GoogleLoginButton label="Sign up with Google" />
            <Text fontSize="sm" textAlign="center">
              Already have an account?{' '}
              <Link as={RouterLink} to="/login" color="purple.600" fontWeight="semibold">
                Sign in
              </Link>
            </Text>
          </Stack>
        </GlassCard>
      </Container>
    </PageWrapper>
  );
}
