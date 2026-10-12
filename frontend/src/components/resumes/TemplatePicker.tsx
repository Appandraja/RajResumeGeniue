import { Alert, AlertIcon, Box, Button, SimpleGrid, Skeleton, Text } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { getApiErrorMessage, listTemplatesForPicker } from '../../services/resumeService';
import type { Template } from '../../types';

interface TemplatePickerProps {
  value: number | null;
  onChange: (template: Template) => void;
  /** Called once templates are loaded so the parent can pick a default / resolve the font. */
  onLoaded?: (templates: Template[]) => void;
}

export function TemplatePicker({ value, onChange, onLoaded }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    listTemplatesForPicker()
      .then((data) => {
        if (cancelled) return;
        const active = data.filter((t) => t.is_active);
        setTemplates(active);
        setError(null);
        onLoaded?.(active);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'We could not load the templates.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // onLoaded is intentionally excluded: it should only fire per load attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (loading) {
    return (
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        <Skeleton h="140px" borderRadius="xl" />
        <Skeleton h="140px" borderRadius="xl" />
        <Skeleton h="140px" borderRadius="xl" />
      </SimpleGrid>
    );
  }

  if (error) {
    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        <Text flex="1">{error}</Text>
        <Button
          size="sm"
          onClick={() => {
            setLoading(true);
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </Button>
      </Alert>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} role="radiogroup" aria-label="Template">
      {templates.map((t) => {
        const selected = t.id === value;
        return (
          <Box
            key={t.id}
            as="button"
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(t)}
            textAlign="left"
            p={4}
            borderRadius="xl"
            borderWidth="2px"
            borderColor={selected ? 'purple.500' : 'gray.200'}
            bg={selected ? 'purple.50' : 'white'}
            borderTopWidth="6px"
            borderTopColor={t.accent_color}
            fontFamily={t.font_family}
            _hover={{ shadow: 'md' }}
          >
            <Text fontWeight="bold" fontSize="lg" color={t.accent_color}>
              {t.name}
            </Text>
            <Text fontSize="sm" color="gray.600" mt={1}>
              {t.description ?? 'A clean, ATS-friendly layout.'}
            </Text>
            {selected && (
              <Text fontSize="xs" fontWeight="semibold" color="purple.600" mt={2}>
                Selected
              </Text>
            )}
          </Box>
        );
      })}
    </SimpleGrid>
  );
}
