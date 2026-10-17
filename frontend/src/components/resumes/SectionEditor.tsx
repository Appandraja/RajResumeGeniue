import {
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  SimpleGrid,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { Field } from './Field';
import type { SectionDraft } from './resumeForm';

interface SectionEditorProps {
  section: SectionDraft;
  onChange: (next: SectionDraft) => void;
  error?: string;
}

interface Labels {
  title: string;
  titlePlaceholder: string;
  organization: string;
  organizationPlaceholder: string;
  bullets: string;
  bulletsHelper: string;
}

function labelsFor(type: SectionDraft['type']): Labels {
  if (type === 'education') {
    return {
      title: 'Degree or course',
      titlePlaceholder: 'BSc in Computer Science',
      organization: 'School or university',
      organizationPlaceholder: 'University of Texas',
      bullets: 'Highlights (one per line)',
      bulletsHelper: 'Optional: honours, relevant projects, or achievements.',
    };
  }
  return {
    title: 'Job title',
    titlePlaceholder: 'Marketing Manager',
    organization: 'Company',
    organizationPlaceholder: 'Acme Inc.',
    bullets: 'What you achieved (one per line)',
    bulletsHelper:
      'Start each line with an action word and add numbers where you can, e.g. "Grew newsletter signups by 40%".',
  };
}

export function SectionEditor({ section, onChange, error }: SectionEditorProps) {
  const labels = labelsFor(section.type);
  const patch = (p: Partial<SectionDraft>): void => onChange({ ...section, ...p });

  return (
    <VStack spacing={4} align="stretch">
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <Field
          label={labels.title}
          value={section.title}
          onChange={(title) => patch({ title })}
          placeholder={labels.titlePlaceholder}
          error={error}
          isRequired
        />
        <Field
          label={labels.organization}
          value={section.organization}
          onChange={(organization) => patch({ organization })}
          placeholder={labels.organizationPlaceholder}
        />
        <Field
          label="Location"
          value={section.location}
          onChange={(location) => patch({ location })}
          placeholder="Austin, USA"
        />
        <div />
        <Field
          label="Start date"
          type="date"
          value={section.start_date}
          onChange={(start_date) => patch({ start_date })}
        />
        <Field
          label="End date"
          type="date"
          value={section.end_date}
          onChange={(end_date) => patch({ end_date })}
          helper="Leave empty if you are still here."
        />
      </SimpleGrid>
      <FormControl isInvalid={false}>
        <FormLabel>{labels.bullets}</FormLabel>
        <Textarea
          rows={5}
          value={section.bullets.join('\n')}
          onChange={(e) => patch({ bullets: e.target.value.split('\n') })}
        />
        <FormHelperText>{labels.bulletsHelper}</FormHelperText>
        <FormErrorMessage>{error}</FormErrorMessage>
      </FormControl>
    </VStack>
  );
}
