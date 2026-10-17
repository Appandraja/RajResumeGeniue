import { useState, type FormEvent } from 'react';
import {
  Alert,
  AlertIcon,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  Stack,
} from '@chakra-ui/react';
import { GradientButton } from '../ui/GradientButton';
import { getErrorMessage } from '../../services/authService';

interface RegisterFormProps {
  onSubmit: (email: string, password: string, fullName: string) => Promise<void>;
}

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(fullName: string, email: string, password: string, confirm: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!fullName.trim()) errors.fullName = 'Full name is required.';
  if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
  if (confirm !== password) errors.confirm = 'Passwords do not match.';
  return errors;
}

export function RegisterForm({ onSubmit }: RegisterFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const found = validate(fullName, email, password, confirm);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit(email.trim(), password, fullName.trim());
    } catch (error) {
      setFormError(getErrorMessage(error, 'Unable to create your account. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Create account form">
      <Stack spacing={4}>
        {formError && (
          <Alert status="error" rounded="md" role="alert">
            <AlertIcon />
            {formError}
          </Alert>
        )}
        <FormControl isInvalid={Boolean(errors.fullName)} isRequired>
          <FormLabel>Full name</FormLabel>
          <Input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <FormErrorMessage>{errors.fullName}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={Boolean(errors.email)} isRequired>
          <FormLabel>Email</FormLabel>
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FormErrorMessage>{errors.email}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={Boolean(errors.password)} isRequired>
          <FormLabel>Password</FormLabel>
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errors.password ? (
            <FormErrorMessage>{errors.password}</FormErrorMessage>
          ) : (
            <FormHelperText>At least 8 characters.</FormHelperText>
          )}
        </FormControl>
        <FormControl isInvalid={Boolean(errors.confirm)} isRequired>
          <FormLabel>Confirm password</FormLabel>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <FormErrorMessage>{errors.confirm}</FormErrorMessage>
        </FormControl>
        <GradientButton type="submit" isLoading={submitting} loadingText="Creating account">
          Create account
        </GradientButton>
      </Stack>
    </form>
  );
}
