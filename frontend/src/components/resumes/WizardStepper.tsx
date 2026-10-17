import { Box, HStack, Text } from '@chakra-ui/react';

interface WizardStepperProps {
  steps: string[];
  current: number;
}

export function WizardStepper({ steps, current }: WizardStepperProps) {
  return (
    <HStack as="ol" spacing={2} align="stretch" listStyleType="none" aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <Box
            as="li"
            key={label}
            flex="1"
            aria-current={active ? 'step' : undefined}
          >
            <Box
              h="6px"
              borderRadius="full"
              bg={done || active ? 'purple.500' : 'gray.200'}
              opacity={done ? 0.6 : 1}
            />
            <Text
              mt={2}
              fontSize="sm"
              fontWeight={active ? 'bold' : 'normal'}
              color={active ? 'purple.700' : 'gray.600'}
              noOfLines={1}
            >
              {i + 1}. {label}
            </Text>
          </Box>
        );
      })}
    </HStack>
  );
}
