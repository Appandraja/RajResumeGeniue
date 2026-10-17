import { useRef, useState, type FormEvent } from 'react';
import {
  Alert,
  AlertIcon,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  Text,
} from '@chakra-ui/react';
import { GradientButton } from '../ui/GradientButton';
import { UserIcon } from '../ui/icons';
import { getErrorMessage } from '../../services/authService';
import { EMAIL_RE, EmailField } from './EmailField';
import { PasswordField } from './PasswordField';
import { PasswordStrength } from './PasswordStrength';

interface RegisterFormProps {
  onSubmit: (email: string, password: string, fullName: string) => Promise<void>;
}

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

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
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const found = validate(fullName, email, password, confirm);
    setErrors(found);
    setFormError(null);
    if (found.fullName) return nameRef.current?.focus();
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();
    if (found.confirm) return confirmRef.current?.focus();

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
      <Stack spacing={5}>
        {formError && (
          <Alert status="error" rounded="lg" role="alert">
            <AlertIcon />
            {formError}
          </Alert>
        )}
        <FormControl isInvalid={Boolean(errors.fullName)} isRequired>
          <FormLabel>Full name</FormLabel>
          <InputGroup size="lg">
            <InputLeftElement pointerEvents="none" color="gray.400">
              <UserIcon boxSize={5} />
            </InputLeftElement>
            <Input
              ref={nameRef}
              rounded="xl"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </InputGroup>
          <FormErrorMessage>{errors.fullName}</FormErrorMessage>
        </FormControl>
        <EmailField
          value={email}
          onChange={setEmail}
          error={errors.email ?? null}
          inputRef={emailRef}
        />
        <Stack spacing={3}>
          <PasswordField
            value={password}
            onChange={setPassword}
            error={errors.password ?? null}
            inputRef={passwordRef}
            autoComplete="new-password"
          />
          <PasswordStrength password={password} />
        </Stack>
        <PasswordField
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          error={errors.confirm ?? null}
          inputRef={confirmRef}
          autoComplete="new-password"
        />
        <GradientButton type="submit" size="lg" isLoading={submitting} loadingText="Creating account">
          Create account
        </GradientButton>
        <Text fontSize="xs" color="gray.500" textAlign="center">
          Your resume data stays private. We never share it with third parties.
        </Text>
      </Stack>
    </form>
  );
}
