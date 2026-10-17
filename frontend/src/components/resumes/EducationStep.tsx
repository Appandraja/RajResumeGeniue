import type { FormErrors, ResumeFormState, SectionDraft } from './resumeForm';
import { SectionList } from './SectionList';

interface StepProps {
  form: ResumeFormState;
  onSectionsChange: (sections: SectionDraft[]) => void;
  errors: FormErrors;
}

export function EducationStep({ form, onSectionsChange, errors }: StepProps) {
  return (
    <SectionList
      type="education"
      sections={form.sections}
      onChange={onSectionsChange}
      errors={errors}
      itemLabel="School"
      emptyHint="Add your highest or most recent qualification first."
    />
  );
}
