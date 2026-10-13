import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Container,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Stack,
  Text,
  useToast,
  type BoxProps,
  type IconProps,
} from '@chakra-ui/react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GradientButton } from '../components/ui/GradientButton';
import { useAuth } from '../hooks/useAuth';
import { changePassword } from '../services/accountService';
import { getErrorMessage } from '../services/authService';

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

function EyeIcon({ off, ...rest }: IconProps & { off: boolean }) {
  return (
    <Icon viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...rest}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" strokeLinecap="round" />}
    </Icon>
  );
}

function SettingsCard({ children, ...rest }: BoxProps & { children: ReactNode }) {
  return (
    <Box
      as="section"
      bg="white"
      rounded="2xl"
      border="1px solid"
      borderColor="gray.100"
      shadow="md"
      p={{ base: 5, md: 6 }}
      {...rest}
    >
      {children}
    </Box>
  );
}

interface Strength {
  label: string;
  value: number;
  colorScheme: string;
}

export function passwordStrength(password: string): Strength | null {
  if (!password) return null;
  let score = 0;
  if (password.length >= MIN_PASSWORD) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length < MIN_PASSWORD) return { label: 'Too short', value: 15, colorScheme: 'red' };
  if (score <= 2) return { label: 'Weak', value: 40, colorScheme: 'orange' };
  if (score <= 3) return { label: 'Okay', value: 65, colorScheme: 'yellow' };
  return { label: 'Strong', value: 100, colorScheme: 'green' };
}

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  error: string | null;
  helper?: ReactNode;
}

function PasswordField({ label, value, onChange, autoComplete, error, helper }: PasswordFieldProps) {
  const [visible, setVisible] = useState<boolean>(false);
  return (
    <FormControl isInvalid={error !== null} isRequired>
      <FormLabel>{label}</FormLabel>
      <InputGroup>
        <Input
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          minH="44px"
          maxLength={MAX_PASSWORD}
          pr={12}
        />
        <InputRightElement h="full" w={12}>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            aria-pressed={visible}
            icon={<EyeIcon off={visible} boxSize={5} />}
            onClick={() => setVisible((v) => !v)}
          />
        </InputRightElement>
      </InputGroup>
      {error ? <FormErrorMessage>{error}</FormErrorMessage> : helper}
    </FormControl>
  );
}

export default function SettingsPage() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [fullName, setFullName] = useState<string>(user?.full_name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [newError, setNewError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changing, setChanging] = useState<boolean>(false);
  const [signingOut, setSigningOut] = useState<boolean>(false);

  const strength = passwordStrength(newPassword);

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

  const handleChangePassword = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setPasswordError(null);
    const cur = currentPassword ? null : 'Enter your current password.';
    let nw: string | null = null;
    if (newPassword.length < MIN_PASSWORD) {
      nw = `New password must be at least ${MIN_PASSWORD} characters.`;
    } else if (newPassword.length > MAX_PASSWORD) {
      nw = `New password must be at most ${MAX_PASSWORD} characters.`;
    } else if (newPassword === currentPassword) {
      nw = 'New password must be different from your current password.';
    }
    const conf = confirmPassword !== newPassword ? 'Passwords do not match.' : null;
    setCurrentError(cur);
    setNewError(nw);
    setConfirmError(conf);
    if (cur || nw || conf) return;

    setChanging(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Password updated', status: 'success', duration: 4000, isClosable: true });
    } catch (error) {
      setPasswordError(getErrorMessage(error, 'Unable to change your password.'));
    } finally {
      setChanging(false);
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
          <Heading as="h1" size="lg">
            Settings
          </Heading>

          <SettingsCard aria-labelledby="settings-profile">
            <form onSubmit={handleSave} noValidate aria-label="Account settings">
              <Stack spacing={4}>
                <Heading as="h2" size="md" id="settings-profile">
                  Profile
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
          </SettingsCard>

          <SettingsCard aria-labelledby="settings-security">
            <form onSubmit={handleChangePassword} noValidate aria-label="Change password">
              <Stack spacing={4}>
                <Heading as="h2" size="md" id="settings-security">
                  Security
                </Heading>
                <Text color="gray.600" fontSize="sm">
                  Change password. You will stay signed in on this device.
                </Text>
                {passwordError && (
                  <Alert status="error" rounded="md" role="alert">
                    <AlertIcon />
                    {passwordError}
                  </Alert>
                )}
                <PasswordField
                  label="Current password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  autoComplete="current-password"
                  error={currentError}
                />
                <PasswordField
                  label="New password"
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                  error={newError}
                  helper={
                    <FormHelperText>
                      {MIN_PASSWORD}-{MAX_PASSWORD} characters.
                      {strength && (
                        <Text as="span" ml={2} fontWeight="semibold" data-testid="strength-hint">
                          Strength: {strength.label}
                        </Text>
                      )}
                    </FormHelperText>
                  }
                />
                <PasswordField
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  error={confirmError}
                />
                <GradientButton type="submit" isLoading={changing} loadingText="Updating">
                  Update password
                </GradientButton>
              </Stack>
            </form>
          </SettingsCard>

          <SettingsCard aria-labelledby="settings-account">
            <Stack spacing={4}>
              <Heading as="h2" size="md" id="settings-account">
                Account
              </Heading>
              <Box>
                <Text fontSize="sm" color="gray.500">
                  Email
                </Text>
                <Text fontWeight="medium" wordBreak="break-all">
                  {user?.email ?? ''}
                </Text>
              </Box>
              <Text color="gray.600" fontSize="sm">
                You&apos;ll need to sign in again on this device.
              </Text>
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
          </SettingsCard>
        </Stack>
      </Container>
    </PageWrapper>
  );
}
