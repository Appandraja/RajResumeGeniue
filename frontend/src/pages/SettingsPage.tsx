import {
  Alert,
  AlertIcon,
  Button,
  Container,
  Divider,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../services/authService';

export default function SettingsPage() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState<string>(user?.full_name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

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
      setFormError(getErrorMessage(error, 'Unable to update your settings.'));
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
      <Container maxW="container.sm" py={10}>
        <GlassCard>
          <Stack spacing={6}>
            <Heading as="h1" size="lg">
              Settings
            </Heading>

            <form onSubmit={handleSave} noValidate aria-label="Account settings">
              <Stack spacing={4}>
                <Heading as="h2" size="md">
                  Account
                </Heading>
                {formError && (
                  <Alert status="error" rounded="md" role="alert">
                    <AlertIcon />
                    {formError}
                  </Alert>
                )}
                {saved && (
                  <Alert status="success" rounded="md" role="status">
                    <AlertIcon />
                    Settings saved.
                  </Alert>
                )}
                <FormControl>
                  <FormLabel>Email</FormLabel>
                  <Input value={user?.email ?? ''} isReadOnly />
                  <FormHelperText>Your email cannot be changed here.</FormHelperText>
                </FormControl>
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

            <Divider />

            <Stack spacing={2}>
              <Heading as="h2" size="md">
                Preferences
              </Heading>
              <Text color="gray.600">
                Placeholder: preference options are not available yet and will appear here in a
                future update.
              </Text>
            </Stack>

            <Divider />

            <Button variant="outline" rounded="full" onClick={() => void handleLogout()}>
              Sign out
            </Button>
          </Stack>
        </GlassCard>
      </Container>
    </PageWrapper>
  );
}
