import { useState, type FormEvent } from 'react';
import {
  Alert,
  AlertIcon,
  Button,
  Container,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../services/authService';

export default function ProfilePage() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState<string>(user?.full_name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSaved(false);
    setFormError(null);
    if (!fullName.trim()) {
      setNameError('Full name is required.');
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      await updateProfile(fullName.trim());
      setSaved(true);
    } catch (error) {
      setFormError(getErrorMessage(error, 'Unable to update your profile.'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <PageWrapper>
      <Container maxW="container.sm" py={16}>
        <GlassCard>
          <Stack spacing={6}>
            <Heading as="h1" size="lg">
              Your profile
            </Heading>
            <Stack spacing={1}>
              <Text fontSize="sm" color="gray.500">
                Email
              </Text>
              <Text fontWeight="medium">{user?.email}</Text>
              {user?.oauth_provider && (
                <Text fontSize="sm" color="gray.500">
                  Signed in with {user.oauth_provider}
                </Text>
              )}
            </Stack>
            <form onSubmit={handleSave} noValidate aria-label="Profile form">
              <Stack spacing={4}>
                {formError && (
                  <Alert status="error" rounded="md" role="alert">
                    <AlertIcon />
                    {formError}
                  </Alert>
                )}
                {saved && (
                  <Alert status="success" rounded="md" role="status">
                    <AlertIcon />
                    Profile updated.
                  </Alert>
                )}
                <FormControl isInvalid={nameError !== null} isRequired>
                  <FormLabel>Full name</FormLabel>
                  <Input
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                  <FormErrorMessage>{nameError}</FormErrorMessage>
                </FormControl>
                <GradientButton type="submit" isLoading={saving} loadingText="Saving">
                  Save changes
                </GradientButton>
              </Stack>
            </form>
            <Button variant="outline" rounded="full" onClick={handleLogout}>
              Log out
            </Button>
          </Stack>
        </GlassCard>
      </Container>
    </PageWrapper>
  );
}
