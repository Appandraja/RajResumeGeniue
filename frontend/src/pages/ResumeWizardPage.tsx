import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  CloseButton,
  Container,
  Grid,
  GridItem,
  Heading,
  HStack,
  ListItem,
  Text,
  UnorderedList,
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { JobDescriptionStep } from '../components/resumes/JobDescriptionStep';
import { PageWrapper } from '../components/layout/PageWrapper';
import { ContactStep } from '../components/resumes/ContactStep';
import { EducationStep } from '../components/resumes/EducationStep';
import { ExperienceStep } from '../components/resumes/ExperienceStep';
import { ResumePreview } from '../components/resumes/ResumePreview';
import { SkillsStep } from '../components/resumes/SkillsStep';
import { SummaryStep } from '../components/resumes/SummaryStep';
import { TemplatePicker } from '../components/resumes/TemplatePicker';
import { WizardStepper } from '../components/resumes/WizardStepper';
import {
  emptyForm,
  formFromImportedDraft,
  validateContact,
  validateSections,
  type FormErrors,
  type ResumeFormState,
  type SectionDraft,
} from '../components/resumes/resumeForm';
import {
  createResumeWithSections,
  newCreateProgress,
  type CreateProgress,
} from '../components/resumes/saveResume';
import { GradientButton } from '../components/ui/GradientButton';
import { useResumeTemplates } from '../hooks/useResumeTemplates';
import { getApiErrorMessage } from '../services/resumeService';
import type { ImportedDraftNavState } from '../types/importer';

function isImportedDraftNavState(value: unknown): value is ImportedDraftNavState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ImportedDraftNavState>;
  return (
    typeof v.importedDraft === 'object' &&
    v.importedDraft !== null &&
    Array.isArray(v.importedDraft.skills) &&
    Array.isArray(v.importedDraft.sections)
  );
}

const STEPS: string[] = [
  'Contact',
  'Summary',
  'Experience',
  'Education',
  'Skills',
  'Target job',
  'Template',
];
const JOB_STEP = 5;
const TEMPLATE_STEP = 6;

const STEP_HELP: string[] = [
  'How can employers reach you?',
  'Introduce yourself in a few sentences.',
  'Tell us where you have worked.',
  'Tell us about your education.',
  'List the skills that match the jobs you want.',
  'Optional. Add the job you are applying for to see how well your resume matches.',
  'Pick a look for your resume. All templates are ATS-friendly.',
];

export default function ResumeWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(0);
  const location = useLocation();
  const [imported] = useState<ImportedDraftNavState | null>(() =>
    isImportedDraftNavState(location.state) ? location.state : null,
  );
  const [showBanner, setShowBanner] = useState<boolean>(imported !== null);
  const [form, setForm] = useState<ResumeFormState>(() =>
    imported ? formFromImportedDraft(imported.importedDraft) : emptyForm(),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const templates = useResumeTemplates();
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const progress = useRef<CreateProgress>(newCreateProgress());

  // Consume the router state once so Back or a refresh does not re-apply the import.
  useEffect(() => {
    if (imported !== null) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTemplates = templates.filter((t) => t.is_active);
  const templateId: number | null = form.template_id ?? activeTemplates[0]?.id ?? null;
  const template = activeTemplates.find((t) => t.id === templateId) ?? null;

  const patch = (p: Partial<ResumeFormState>): void => setForm((f) => ({ ...f, ...p }));
  const setSections = (sections: SectionDraft[]): void => setForm((f) => ({ ...f, sections }));

  const validateStep = (): boolean => {
    let next: FormErrors = {};
    if (step === 0) next = validateContact(form);
    if (step === 2 || step === 3) {
      const type = step === 2 ? 'experience' : 'education';
      next = validateSections(form.sections.filter((s) => s.type === type));
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = (): void => {
    if (validateStep()) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleCreate = async (): Promise<void> => {
    if (templateId === null) {
      setSaveError('Please choose a template before creating your resume.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const id = await createResumeWithSections(form, templateId, progress.current);
      navigate(`/resumes/${id}`);
    } catch (err) {
      setSaveError(
        getApiErrorMessage(
          err,
          'Something went wrong while saving. Your answers are still here, please try again.',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const isLast = step === STEPS.length - 1;

  return (
    <PageWrapper>
      <Container maxW="container.xl" py={10}>
        <Heading size="xl" mb={1}>
          Create a new resume
        </Heading>
        <Text color="gray.600" mb={6}>
          Step {step + 1} of {STEPS.length}. {STEP_HELP[step]}
        </Text>
        {imported && showBanner && (
          <Alert status="info" borderRadius="md" mb={6} alignItems="flex-start">
            <AlertIcon />
            <Box flex="1">
              <AlertTitle>Imported from {imported.sourceFileName}</AlertTitle>
              <AlertDescription display="block">
                Please review everything before saving.
                {imported.warnings.length > 0 && (
                  <UnorderedList mt={2} spacing={1}>
                    {imported.warnings.map((w) => (
                      <ListItem key={w}>{w}</ListItem>
                    ))}
                  </UnorderedList>
                )}
              </AlertDescription>
            </Box>
            <CloseButton aria-label="Dismiss import notice" onClick={() => setShowBanner(false)} />
          </Alert>
        )}
        <WizardStepper steps={STEPS} current={step} />

        <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={8} mt={8}>
          <GridItem>
            <Box bg="white" p={{ base: 4, md: 6 }} borderRadius="2xl" shadow="md">
              <Heading size="md" mb={4}>
                {STEPS[step]}
              </Heading>
              {step === 0 && <ContactStep form={form} onChange={patch} errors={errors} />}
              {step === 1 && <SummaryStep form={form} onChange={patch} />}
              {step === 2 && (
                <ExperienceStep form={form} onSectionsChange={setSections} errors={errors} />
              )}
              {step === 3 && (
                <EducationStep form={form} onSectionsChange={setSections} errors={errors} />
              )}
              {step === 4 && <SkillsStep form={form} onChange={patch} />}
              {step === JOB_STEP && <JobDescriptionStep form={form} onChange={patch} />}
              {step === TEMPLATE_STEP && (
                <TemplatePicker
                  value={templateId}
                  onChange={(t) => patch({ template_id: t.id })}
                />
              )}

              {saveError && (
                <Alert status="error" mt={4} borderRadius="md">
                  <AlertIcon />
                  {saveError}
                </Alert>
              )}

              <HStack justify="space-between" mt={6}>
                {step === 0 ? (
                  <Button as={RouterLink} to="/resumes" variant="ghost">
                    Cancel
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setStep((s) => s - 1)} isDisabled={saving}>
                    Back
                  </Button>
                )}
                {isLast ? (
                  <GradientButton onClick={() => void handleCreate()} isLoading={saving}>
                    Create resume
                  </GradientButton>
                ) : (
                  <GradientButton onClick={goNext}>Next</GradientButton>
                )}
              </HStack>
            </Box>
          </GridItem>
          <GridItem>
            <Text fontWeight="semibold" mb={2}>
              Live preview
            </Text>
            <ResumePreview form={form} template={template} />
          </GridItem>
        </Grid>
      </Container>
    </PageWrapper>
  );
}
