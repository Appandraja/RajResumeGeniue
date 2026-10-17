import { FormControl, FormErrorMessage, FormHelperText, FormLabel, Input } from '@chakra-ui/react';
import type { ChangeEvent } from 'react';

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  error?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'url' | 'date';
  isRequired?: boolean;
}

export function Field({
  label,
  value,
  onChange,
  helper,
  error,
  placeholder,
  type = 'text',
  isRequired = false,
}: FieldProps) {
  return (
    <FormControl isInvalid={Boolean(error)} isRequired={isRequired}>
      <FormLabel>{label}</FormLabel>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
      {error ? (
        <FormErrorMessage>{error}</FormErrorMessage>
      ) : helper ? (
        <FormHelperText>{helper}</FormHelperText>
      ) : null}
    </FormControl>
  );
}
