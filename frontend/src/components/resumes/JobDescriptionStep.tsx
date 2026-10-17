import { FormControl, FormHelperText, FormLabel, Text, Textarea, VStack } from '@chakra-ui/react';
import { Field } from './Field';
import { MAX_JOB_DESCRIPTION, type ResumeFormState } from './resumeForm';

interface JobDescriptionStepProps {
  form: ResumeFormState;
  onChange: (patch: Partial<ResumeFormState>) => void;
}

export function JobDescriptionStep({ form, onChange }: JobDescriptionStepProps) {
  return (
    <VStack align="stretch" spacing={4}>
      <Field
        label="Job title"
        value={form.job_title}
        placeholder="e.g. Marketing Manager"
        onChange={(job_title) => onChange({ job_title })}
      />
      <Field
        label="Company"
        value={form.company}
        placeholder="e.g. Acme Inc."
        onChange={(company) => onChange({ company })}
      />
      <FormControl>
        <FormLabel>Paste the job description</FormLabel>
        <Textarea
          value={form.job_description}
          maxLength={MAX_JOB_DESCRIPTION}
          rows={10}
          placeholder="Paste the job posting here."
          onChange={(e) => onChange({ job_description: e.target.value })}
        />
        <FormHelperText>
          Optional. We use it to show how well your resume matches and what to improve.
        </FormHelperText>
        <Text fontSize="sm" color="gray.500" mt={1}>
          {form.job_description.length.toLocaleString('en-US')} /{' '}
          {MAX_JOB_DESCRIPTION.toLocaleString('en-US')} characters
        </Text>
      </FormControl>
    </VStack>
  );
}
