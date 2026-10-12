import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Container,
  Grid,
  GridItem,
  Heading,
  HStack,
  Skeleton,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { useState, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { ContactStep } from '../components/resumes/ContactStep';
import { EducationStep } from '../components/resumes/EducationStep';
import { ExperienceStep } from '../components/resumes/ExperienceStep';
import { ResumePreview } from '../components/resumes/ResumePreview';
import { SkillsStep } from '../components/resumes/SkillsStep';
import { SummaryStep } from '../components/resumes/SummaryStep';
import { TemplatePicker } from '../components/resumes/TemplatePicker';
import {
  formFromResume,
  validateContact,
  validateSections,
  type FormErrors,
  type ResumeFormState,
  type SectionDraft,
} from '../components/resumes/resumeForm';
import { saveResumeEdits } from '../components/resumes/saveResume';
import { GradientButton } from '../components/ui/GradientButton';
import { useResume } from '../hooks/useResume';
import { useResumeTemplates } from '../hooks/useResumeTemplates';
import { getApiErrorMessage } from '../services/resumeService';
import type { Resume } from '../types';

interface BlockProps {
  title: string;
  children: ReactNode;
}

function Block({ title, children }: BlockProps) {
  return (
    <Box bg="white" p={{ base: 4, md: 6 }} borderRadius="2xl" shadow="md">
      <Heading size="md" mb={4}>
        {title}
      </Heading>
      {children}
    </Box>
  );
}

interface EditorProps {
  resume: Resume;
}

function ResumeEditor({ resume }: EditorProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const templates = useResumeTemplates();
  const [form, setForm] = useState<ResumeFormState>(() => formFromResume(resume));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const patch = (p: Partial<ResumeFormState>): void => setForm((f) => ({ ...f, ...p }));
  const setSections = (sections: SectionDraft[]): void => setForm((f) => ({ ...f, sections }));

  const templateId = form.template_id ?? resume.template_id;
  const template = templates.find((t) => t.id === templateId) ?? null;

  const handleSave = async (): Promise<void> => {
    const found: FormErrors = {
      ...validateContact(form),
      ...validateSections(form.sections.filter((s) => s.type === 'experience' || s.type === 'education')),
    };
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setSaveError('Please fix the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveResumeEdits(resume, form, templateId);
      toast({ title: 'Resume saved', status: 'success', duration: 3000 });
      navigate(`/resumes/${resume.id}`);
    } catch (err) {
      setSaveError(getApiErrorMessage(err, 'We could not save your changes. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={8}>
      <GridItem>
        <VStack align="stretch" spacing={6}>
          <Block title="Contact details">
            <ContactStep form={form} onChange={patch} errors={errors} />
          </Block>
          <Block title="Summary">
            <SummaryStep form={form} onChange={patch} />
          </Block>
          <Block title="Experience">
            <ExperienceStep form={form} onSectionsChange={setSections} errors={errors} />
          </Block>
          <Block title="Education">
            <EducationStep form={form} onSectionsChange={setSections} errors={errors} />
          </Block>
          <Block title="Skills">
            <SkillsStep form={form} onChange={patch} />
          </Block>
          <Block title="Template">
            <TemplatePicker value={templateId} onChange={(t) => patch({ template_id: t.id })} />
          </Block>

          {saveError && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              {saveError}
            </Alert>
          )}
          <HStack justify="space-between">
            <Button as={RouterLink} to={`/resumes/${resume.id}`} variant="ghost" isDisabled={saving}>
              Cancel
            </Button>
            <GradientButton onClick={() => void handleSave()} isLoading={saving}>
              Save changes
            </GradientButton>
          </HStack>
        </VStack>
      </GridItem>
      <GridItem>
        <Box position="sticky" top={4}>
          <Text fontWeight="semibold" mb={2}>
            Live preview
          </Text>
          <ResumePreview form={form} template={template} />
        </Box>
      </GridItem>
    </Grid>
  );
}

export default function ResumeEditPage() {
  const params = useParams<{ id: string }>();
  const parsed = Number(params.id);
  const resumeId: number | null = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  const { resume, loading, error, reload } = useResume(resumeId);

  return (
    <PageWrapper>
      <Container maxW="container.xl" py={10}>
        <Heading size="xl" mb={6}>
          Edit resume
        </Heading>
        {resumeId === null && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            This resume link is not valid.
          </Alert>
        )}
        {loading && <Skeleton h="500px" borderRadius="md" />}
        {!loading && error && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Text flex="1">{error}</Text>
            <Button size="sm" onClick={() => void reload()}>
              Try again
            </Button>
          </Alert>
        )}
        {!loading && resume && <ResumeEditor key={resume.id} resume={resume} />}
      </Container>
    </PageWrapper>
  );
}
