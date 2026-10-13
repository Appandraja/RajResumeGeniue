import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, AlertIcon, Button, Center, Link, Stack, Text } from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/auth/AuthLayout';
import { EMAIL_RE, EmailField } from '../components/auth/EmailField';
import { GradientButton } from '../components/ui/GradientButton';
import { ArrowLeftIcon, CheckIcon } from '../components/ui/icons';
import { getErrorMessage, requestPasswordReset } from '../services/authService';

const RESEND_COOLDOWN_SECONDS = 30;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const send = async (address: string): Promise<void> => {
    setSubmitting(true);
    setFormError(null);
    try {
      await requestPasswordReset(address);
      setSentTo(address);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setFormError(getErrorMessage(error, 'Unable to send a reset code. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError('Enter a valid email address.');
      emailRef.current?.focus();
      return;
    }
    setEmailError(null);
    await send(trimmed);
  };

  const backLink = (
    <Link
      as={RouterLink}
      to="/login"
      display="inline-flex"
      alignItems="center"
      gap={2}
      minH={11}
      color="purple.600"
      fontWeight="semibold"
    >
      <ArrowLeftIcon boxSize={4} />
      Back to sign in
    </Link>
  );

  if (sentTo !== null) {
    return (
      <AuthLayout title="Check your email" footer={backLink}>
        <Stack spacing={5} align="stretch">
          <Center boxSize={14} rounded="full" bg="green.50" color="green.500" alignSelf="center">
            <CheckIcon boxSize={8} />
          </Center>
          <Text color="gray.700" textAlign="center">
            If an account exists for <strong>{sentTo}</strong>, we have sent a code. It expires in 15
            minutes.
          </Text>
          {formError && (
            <Alert status="error" rounded="lg" role="alert">
              <AlertIcon />
              {formError}
            </Alert>
          )}
          <GradientButton
            size="lg"
            onClick={() => navigate('/reset-password', { state: { email: sentTo } })}
          >
            Enter code
          </GradientButton>
          <Button
            variant="ghost"
            minH={11}
            isDisabled={cooldown > 0}
            isLoading={submitting}
            onClick={() => void send(sentTo)}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </Button>
        </Stack>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we will send you a code to reset it."
      footer={backLink}
    >
      <form onSubmit={handleSubmit} noValidate aria-label="Forgot password form">
        <Stack spacing={5}>
          {formError && (
            <Alert status="error" rounded="lg" role="alert">
              <AlertIcon />
              {formError}
            </Alert>
          )}
          <EmailField value={email} onChange={setEmail} error={emailError} inputRef={emailRef} />
          <GradientButton type="submit" size="lg" isLoading={submitting} loadingText="Sending">
            Send reset code
          </GradientButton>
        </Stack>
      </form>
    </AuthLayout>
  );
}
