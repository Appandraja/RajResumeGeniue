import { FormControl, FormHelperText, FormLabel, Text, Textarea } from '@chakra-ui/react';
import type { ResumeFormState } from './resumeForm';

interface SummaryStepProps {
  form: ResumeFormState;
  onChange: (patch: Partial<ResumeFormState>) => void;
}

const MAX_SUMMARY = 600;

export function SummaryStep({ form, onChange }: SummaryStepProps) {
  return (
    <FormControl>
      <FormLabel>Professional summary</FormLabel>
      <Textarea
        value={form.summary}
        maxLength={MAX_SUMMARY}
        rows={6}
        placeholder="Example: Marketing manager with 6 years of experience growing online communities and running email campaigns."
        onChange={(e) => onChange({ summary: e.target.value })}
      />
      <FormHelperText>
        Two or three sentences about who you are and what you do best. Keep it short and specific.
      </FormHelperText>
      <Text fontSize="sm" color="gray.500" mt={1}>
        {form.summary.length} / {MAX_SUMMARY} characters
      </Text>
    </FormControl>
  );
}
