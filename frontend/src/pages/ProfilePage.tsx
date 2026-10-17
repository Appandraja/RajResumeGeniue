import { useState, type FormEvent } from 'react';
import {
  Alert,
  AlertIcon,
  Avatar,
  Box,
  Button,
  Container,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { buildAccountSummary } from '../components/layout/AppHeader';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GradientButton } from '../components/ui/GradientButton';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../services/authService';

function formatMemberSince(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

export default function ProfilePage() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [fullName, setFullName] = useState<string>(user?.full_name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const account = buildAccountSummary(user?.full_name, user?.email);
  const memberSince = formatMemberSince(user?.created_at);

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
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
    navigate('/login', { replace: true });
    toast({ title: "You've been signed out", status: 'success', duration: 4000, isClosable: true });
  };

  return (
    <PageWrapper>
      <Container maxW="container.sm" py={{ base: 6, md: 10 }}>
        <Stack spacing={6}>
          <Box
            bg="white"
            rounded="2xl"
            border="1px solid"
            borderColor="gray.100"
            shadow="md"
            p={{ base: 5, md: 6 }}
          >
            <HStack spacing={4} align="center">
              <Avatar
                size="xl"
                name={account.initials}
                getInitials={() => account.initials}
                bgGradient="linear(to-br, purple.500, pink.500)"
                color="white"
              />
              <Box minW={0}>
                <Heading as="h1" size="lg" noOfLines={1}>
                  {account.name}
                </Heading>
                <Text color="gray.600" wordBreak="break-all">
                  {user?.email}
                </Text>
                {memberSince && (
                  <Text fontSize="sm" color="gray.500">
                    Member since {memberSince}
                  </Text>
                )}
                {user?.oauth_provider && (
                  <Text fontSize="sm" color="gray.500">
                    Signed in with {user.oauth_provider}
                  </Text>
                )}
              </Box>
            </HStack>
          </Box>

          <Box
            bg="white"
            rounded="2xl"
            border="1px solid"
            borderColor="gray.100"
            shadow="md"
            p={{ base: 5, md: 6 }}
          >
            <form onSubmit={handleSave} noValidate aria-label="Profile form">
              <Stack spacing={4}>
                <Heading as="h2" size="md">
                  Edit profile
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
                    Profile updated.
                  </Alert>
                )}
                <FormControl isInvalid={nameError !== null} isRequired>
                  <FormLabel>Full name</FormLabel>
                  <Input
                    autoComplete="name"
                    minH="44px"
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
          </Box>

          <Button
            colorScheme="red"
            variant="outline"
            rounded="full"
            minH="44px"
            isLoading={signingOut}
            loadingText="Signing out"
            onClick={() => void handleLogout()}
          >
            Sign out
          </Button>
        </Stack>
      </Container>
    </PageWrapper>
  );
}
