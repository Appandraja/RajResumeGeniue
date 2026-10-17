import { useState, type FormEvent } from 'react';
import {
  Alert,
  AlertIcon,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Stack,
} from '@chakra-ui/react';
import { GradientButton } from '../ui/GradientButton';
import { getErrorMessage } from '../../services/authService';

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const eErr = EMAIL_RE.test(email.trim()) ? null : 'Enter a valid email address.';
    const pErr = password ? null : 'Password is required.';
    setEmailError(eErr);
    setPasswordError(pErr);
    setFormError(null);
    if (eErr || pErr) return;

    setSubmitting(true);
    try {
      await onSubmit(email.trim(), password);
    } catch (error) {
      setFormError(getErrorMessage(error, 'Unable to sign in. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Sign in form">
      <Stack spacing={4}>
        {formError && (
          <Alert status="error" rounded="md" role="alert">
            <AlertIcon />
            {formError}
          </Alert>
        )}
        <FormControl isInvalid={emailError !== null} isRequired>
          <FormLabel>Email</FormLabel>
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FormErrorMessage>{emailError}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={passwordError !== null} isRequired>
          <FormLabel>Password</FormLabel>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FormErrorMessage>{passwordError}</FormErrorMessage>
        </FormControl>
        <GradientButton type="submit" isLoading={submitting} loadingText="Signing in">
          Sign in
        </GradientButton>
      </Stack>
    </form>
  );
}
