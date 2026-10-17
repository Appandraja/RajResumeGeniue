import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import { CheckIcon } from '../ui/icons';

export type StrengthLevel = 'empty' | 'weak' | 'fair' | 'strong';

interface Rule {
  label: string;
  met: boolean;
}

export interface StrengthResult {
  level: StrengthLevel;
  score: number;
  rules: Rule[];
}

export function evaluatePassword(password: string): StrengthResult {
  const rules: Rule[] = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Letters and numbers', met: /[A-Za-z]/.test(password) && /\d/.test(password) },
    { label: 'Upper and lower case', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    {
      label: 'A symbol or 12+ characters',
      met: /[^A-Za-z0-9]/.test(password) || password.length >= 12,
    },
  ];
  const score = rules.filter((r) => r.met).length;
  let level: StrengthLevel = 'empty';
  if (password.length > 0) {
    if (!rules[0].met || score <= 1) level = 'weak';
    else if (score <= 3) level = 'fair';
    else level = 'strong';
  }
  return { level, score, rules };
}

const LEVEL_META: Record<
  Exclude<StrengthLevel, 'empty'>,
  { label: string; color: string; bars: number }
> = {
  weak: { label: 'Weak', color: 'red.500', bars: 1 },
  fair: { label: 'Fair', color: 'orange.400', bars: 2 },
  strong: { label: 'Strong', color: 'green.500', bars: 3 },
};

interface PasswordStrengthProps {
  password: string;
}

/** Strength meter: bars plus a text label and rule checklist, so meaning is never colour only. */
export function PasswordStrength({ password }: PasswordStrengthProps) {
  const { level, rules } = evaluatePassword(password);
  const meta = level === 'empty' ? null : LEVEL_META[level];

  return (
    <Stack spacing={2} data-testid="password-strength">
      <HStack spacing={1} aria-hidden>
        {[1, 2, 3].map((i) => (
          <Box
            key={i}
            flex={1}
            h={1.5}
            rounded="full"
            bg={meta && i <= meta.bars ? meta.color : 'gray.200'}
            transition="background 0.2s"
          />
        ))}
      </HStack>
      <Text fontSize="sm" color="gray.600" aria-live="polite">
        Password strength:{' '}
        <Text as="span" fontWeight="semibold">
          {meta ? meta.label : 'Enter a password'}
        </Text>
      </Text>
      <Stack as="ul" spacing={1} listStyleType="none" m={0} p={0}>
        {rules.map((rule) => (
          <HStack as="li" key={rule.label} spacing={2} color={rule.met ? 'green.600' : 'gray.500'}>
            <CheckIcon boxSize={4} opacity={rule.met ? 1 : 0.3} />
            <Text fontSize="xs">
              {rule.label}
              <Text as="span" srOnly>
                {rule.met ? ' (met)' : ' (not met)'}
              </Text>
            </Text>
          </HStack>
        ))}
      </Stack>
    </Stack>
  );
}
