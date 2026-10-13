import type { ChangeEvent, Ref } from 'react';
import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';
import { MailIcon } from '../ui/icons';

interface EmailFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  inputRef?: Ref<HTMLInputElement>;
  label?: string;
  isDisabled?: boolean;
}

export function EmailField({
  value,
  onChange,
  error = null,
  inputRef,
  label = 'Email',
  isDisabled = false,
}: EmailFieldProps) {
  return (
    <FormControl isInvalid={error !== null} isRequired isDisabled={isDisabled}>
      <FormLabel>{label}</FormLabel>
      <InputGroup size="lg">
        <InputLeftElement pointerEvents="none" color="gray.400">
          <MailIcon boxSize={5} />
        </InputLeftElement>
        <Input
          ref={inputRef}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          rounded="xl"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
      </InputGroup>
      <FormErrorMessage>{error}</FormErrorMessage>
    </FormControl>
  );
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
