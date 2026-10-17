import { SimpleGrid, VStack } from '@chakra-ui/react';
import { Field } from './Field';
import type { FormErrors, ResumeFormState } from './resumeForm';

interface StepProps {
  form: ResumeFormState;
  onChange: (patch: Partial<ResumeFormState>) => void;
  errors: FormErrors;
}

export function ContactStep({ form, onChange, errors }: StepProps) {
  return (
    <VStack spacing={5} align="stretch">
      <Field
        label="Resume name"
        value={form.title}
        onChange={(title) => onChange({ title })}
        placeholder="e.g. Marketing Manager resume"
        helper="Only you see this. It helps you tell your resumes apart."
      />
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
        <Field
          label="Full name"
          value={form.full_name}
          onChange={(full_name) => onChange({ full_name })}
          error={errors.full_name}
          placeholder="Jane Doe"
          isRequired
        />
        <Field
          label="Email"
          type="email"
          value={form.email}
          onChange={(email) => onChange({ email })}
          error={errors.email}
          placeholder="jane@example.com"
          helper="Use a professional address employers can reach you on."
          isRequired
        />
        <Field
          label="Phone"
          type="tel"
          value={form.phone}
          onChange={(phone) => onChange({ phone })}
          placeholder="+1 555 123 4567"
        />
        <Field
          label="City and country"
          value={form.location}
          onChange={(location) => onChange({ location })}
          placeholder="Austin, USA"
        />
        <Field
          label="LinkedIn address"
          type="url"
          value={form.linkedin_url}
          onChange={(linkedin_url) => onChange({ linkedin_url })}
          placeholder="https://linkedin.com/in/janedoe"
          helper="Optional."
        />
        <Field
          label="Website or portfolio"
          type="url"
          value={form.website_url}
          onChange={(website_url) => onChange({ website_url })}
          placeholder="https://janedoe.com"
          helper="Optional."
        />
      </SimpleGrid>
    </VStack>
  );
}
