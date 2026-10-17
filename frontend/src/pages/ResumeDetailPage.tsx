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
} from '@chakra-ui/react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { AtsScorePanel } from '../components/resumes/AtsScorePanel';
import { TailorPanel } from '../components/resumes/TailorPanel';
import { ExportButtons } from '../components/resumes/ExportButtons';
import { ResumePreview } from '../components/resumes/ResumePreview';
import { formFromResume } from '../components/resumes/resumeForm';
import { useResume } from '../hooks/useResume';
import { useResumeTemplates } from '../hooks/useResumeTemplates';

export default function ResumeDetailPage() {
  const params = useParams<{ id: string }>();
  const parsed = Number(params.id);
  const resumeId: number | null = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  const { resume, loading, error, reload } = useResume(resumeId);
  const templates = useResumeTemplates();

  if (resumeId === null) {
    return (
      <PageWrapper>
        <Container maxW="container.md" py={10}>
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            This resume link is not valid.
          </Alert>
        </Container>
      </PageWrapper>
    );
  }

  const template = resume ? (templates.find((t) => t.id === resume.template_id) ?? null) : null;

  return (
    <PageWrapper>
      <Container maxW="container.xl" py={10}>
        <HStack justify="space-between" mb={6} wrap="wrap" spacing={4}>
          <Box>
            <Button as={RouterLink} to="/resumes" variant="link" size="sm" mb={2}>
              Back to my resumes
            </Button>
            <Heading size="xl">{resume?.title ?? 'Resume'}</Heading>
          </Box>
          {resume && (
            <HStack>
              <ExportButtons resumeId={resume.id} />
              <Button as={RouterLink} to={`/resumes/${resume.id}/edit`} colorScheme="purple">
                Edit resume
              </Button>
            </HStack>
          )}
        </HStack>

        {loading && !resume && <Skeleton h="500px" borderRadius="md" />}

        {error && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Text flex="1">{error}</Text>
            <Button size="sm" onClick={() => void reload()}>
              Try again
            </Button>
          </Alert>
        )}

        {resume && (
          <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={8}>
            <GridItem>
              <ResumePreview form={formFromResume(resume)} template={template} />
            </GridItem>
            <GridItem>
              <VStack align="stretch" spacing={6}>
                <TailorPanel key={resume.id} resume={resume} onResumeChanged={reload} />
                <AtsScorePanel resumeId={resume.id} />
              </VStack>
            </GridItem>
          </Grid>
        )}
      </Container>
    </PageWrapper>
  );
}
