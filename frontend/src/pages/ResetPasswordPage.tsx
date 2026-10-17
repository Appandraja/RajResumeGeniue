import { useRef, useState, type FormEvent } from 'react';
import {
  Alert,
  AlertIcon,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  Link,
  Stack,
} from '@chakra-ui/react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/auth/AuthLayout';
import { EMAIL_RE, EmailField } from '../components/auth/EmailField';
import { PasswordField } from '../components/auth/PasswordField';
import { PasswordStrength } from '../components/auth/PasswordStrength';
import { GradientButton } from '../components/ui/GradientButton';
import { ArrowLeftIcon } from '../components/ui/icons';
import { getErrorMessage, resetPassword } from '../services/authService';

const CODE_LENGTH = 8;

interface LocationState {
  email?: string;
}

interface FieldErrors {
  email?: string;
  code?: string;
  password?: string;
  confirm?: string;
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialEmail = (location.state as LocationState | null)?.email ?? '';

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const found: FieldErrors = {};
    if (!EMAIL_RE.test(email.trim())) found.email = 'Enter a valid email address.';
    if (code.length !== CODE_LENGTH) found.code = `Enter the ${CODE_LENGTH}-digit code from your email.`;
    if (password.length < 8 || password.length > 128) {
      found.password = 'Password must be 8 to 128 characters.';
    }
    if (confirm !== password) found.confirm = 'Passwords do not match.';
    setErrors(found);
    setFormError(null);
    if (found.email) return emailRef.current?.focus();
    if (found.code) return codeRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();
    if (found.confirm) return confirmRef.current?.focus();

    setSubmitting(true);
    try {
      await resetPassword({ email: email.trim(), code, newPassword: password });
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (error) {
      setFormError(getErrorMessage(error, 'Unable to reset your password. Please try again.'));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the code we emailed you and choose a new password."
      footer={
        <Link
          as={RouterLink}
          to="/forgot-password"
          display="inline-flex"
          alignItems="center"
          gap={2}
          minH={11}
          color="purple.600"
          fontWeight="semibold"
        >
          <ArrowLeftIcon boxSize={4} />
          Request a new code
        </Link>
      }
    >
      <form onSubmit={handleSubmit} noValidate aria-label="Reset password form">
        <Stack spacing={5}>
          {formError && (
            <Alert status="error" rounded="lg" role="alert">
              <AlertIcon />
              {formError}
            </Alert>
          )}
          <EmailField value={email} onChange={setEmail} error={errors.email ?? null} inputRef={emailRef} />
          <FormControl isInvalid={Boolean(errors.code)} isRequired>
            <FormLabel>Reset code</FormLabel>
            <Input
              ref={codeRef}
              size="lg"
              rounded="xl"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH + 4}
              letterSpacing="0.3em"
              fontFamily="mono"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            />
            {errors.code ? (
              <FormErrorMessage>{errors.code}</FormErrorMessage>
            ) : (
              <FormHelperText>{CODE_LENGTH} digits. You can paste it with spaces.</FormHelperText>
            )}
          </FormControl>
          <Stack spacing={3}>
            <PasswordField
              label="New password"
              value={password}
              onChange={setPassword}
              error={errors.password ?? null}
              inputRef={passwordRef}
              autoComplete="new-password"
            />
            <PasswordStrength password={password} />
          </Stack>
          <PasswordField
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            error={errors.confirm ?? null}
            inputRef={confirmRef}
            autoComplete="new-password"
          />
          <GradientButton type="submit" size="lg" isLoading={submitting} loadingText="Resetting">
            Reset password
          </GradientButton>
        </Stack>
      </form>
    </AuthLayout>
  );
}
