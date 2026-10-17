import {
  Alert,
  AlertDescription,
  AlertIcon,
  Button,
  Container,
  Heading,
  SimpleGrid,
  Skeleton,
  Text,
} from '@chakra-ui/react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { TemplateCard } from '../components/templates/TemplateCard';
import { useTemplates } from '../hooks/useTemplates';

const SKELETON_KEYS: readonly string[] = ['sk-1', 'sk-2', 'sk-3'];

export default function TemplateGalleryPage() {
  const { data, loading, error, refetch } = useTemplates();

  return (
    <PageWrapper>
      <Container maxW="container.xl" py={10}>
        <Heading size="xl" mb={2}>
          Resume Templates
        </Heading>
        <Text color="gray.600" mb={8}>
          ATS-friendly, single-column layouts. Pick the one that fits you.
        </Text>

        {error && (
          <Alert status="error" rounded="md" mb={6}>
            <AlertIcon />
            <AlertDescription flex={1}>{error}</AlertDescription>
            <Button size="sm" onClick={refetch}>
              Retry
            </Button>
          </Alert>
        )}

        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {loading &&
            SKELETON_KEYS.map((key) => (
              <Skeleton key={key} h="480px" rounded="2xl" data-testid="template-skeleton" />
            ))}
          {!loading && data.map((t) => <TemplateCard key={t.id} template={t} />)}
        </SimpleGrid>

        {!loading && !error && data.length === 0 && (
          <Text color="gray.500">No templates available yet.</Text>
        )}
      </Container>
    </PageWrapper>
  );
}
