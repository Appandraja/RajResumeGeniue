import type { FormErrors, ResumeFormState, SectionDraft } from './resumeForm';
import { SectionList } from './SectionList';

interface StepProps {
  form: ResumeFormState;
  onSectionsChange: (sections: SectionDraft[]) => void;
  errors: FormErrors;
}

export function ExperienceStep({ form, onSectionsChange, errors }: StepProps) {
  return (
    <SectionList
      type="experience"
      sections={form.sections}
      onChange={onSectionsChange}
      errors={errors}
      itemLabel="Job"
      emptyHint="Add your most recent job first. No work experience yet? You can skip this step."
    />
  );
}
