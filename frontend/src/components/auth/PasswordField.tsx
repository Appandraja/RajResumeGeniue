import { useState, type ChangeEvent, type ReactNode, type Ref } from 'react';
import {
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
} from '@chakra-ui/react';
import { EyeIcon, EyeOffIcon, LockIcon } from '../ui/icons';

interface PasswordFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  helperText?: ReactNode;
  autoComplete?: 'current-password' | 'new-password';
  inputRef?: Ref<HTMLInputElement>;
}

/** Password input with an accessible show/hide toggle and inline error support. */
export function PasswordField({
  label = 'Password',
  value,
  onChange,
  error = null,
  helperText,
  autoComplete = 'current-password',
  inputRef,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <FormControl isInvalid={error !== null} isRequired>
      <FormLabel>{label}</FormLabel>
      <InputGroup size="lg">
        <InputLeftElement pointerEvents="none" color="gray.400">
          <LockIcon boxSize={5} />
        </InputLeftElement>
        <Input
          ref={inputRef}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          rounded="xl"
          pr={12}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
        <InputRightElement w={12}>
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            minW={10}
            h={10}
            rounded="full"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            icon={visible ? <EyeOffIcon boxSize={5} /> : <EyeIcon boxSize={5} />}
            onClick={() => setVisible((v) => !v)}
          />
        </InputRightElement>
      </InputGroup>
      {error ? (
        <FormErrorMessage>{error}</FormErrorMessage>
      ) : helperText ? (
        <FormHelperText>{helperText}</FormHelperText>
      ) : null}
    </FormControl>
  );
}
