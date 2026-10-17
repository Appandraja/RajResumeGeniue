import { useRef, useState, type FormEvent } from 'react';
import { Alert, AlertIcon, Box, Link, Stack } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { GradientButton } from '../ui/GradientButton';
import { getErrorMessage } from '../../services/authService';
import { EMAIL_RE, EmailField } from './EmailField';
import { PasswordField } from './PasswordField';

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const eErr = EMAIL_RE.test(email.trim()) ? null : 'Enter a valid email address.';
    const pErr = password ? null : 'Password is required.';
    setEmailError(eErr);
    setPasswordError(pErr);
    setFormError(null);
    if (eErr) {
      emailRef.current?.focus();
      return;
    }
    if (pErr) {
      passwordRef.current?.focus();
      return;
    }

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
      <Stack spacing={5}>
        {formError && (
          <Alert status="error" rounded="lg" role="alert">
            <AlertIcon />
            {formError}
          </Alert>
        )}
        <EmailField value={email} onChange={setEmail} error={emailError} inputRef={emailRef} />
        <Box>
          <PasswordField
            value={password}
            onChange={setPassword}
            error={passwordError}
            inputRef={passwordRef}
            autoComplete="current-password"
          />
          <Box textAlign="right" mt={2}>
            <Link
              as={RouterLink}
              to="/forgot-password"
              fontSize="sm"
              fontWeight="semibold"
              color="purple.600"
              display="inline-block"
              py={2}
            >
              Forgot password?
            </Link>
          </Box>
        </Box>
        <GradientButton type="submit" size="lg" isLoading={submitting} loadingText="Signing in">
          Sign in
        </GradientButton>
      </Stack>
    </form>
  );
}
