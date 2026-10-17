import {
  Alert,
  AlertIcon,
  Button,
  Container,
  Heading,
  HStack,
  SimpleGrid,
  Skeleton,
  Text,
  useToast,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/resumes/EmptyState';
import { ResumeCard } from '../components/resumes/ResumeCard';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GradientButton } from '../components/ui/GradientButton';
import { useResumes } from '../hooks/useResumes';
import { getApiErrorMessage } from '../services/resumeService';

export default function ResumeListPage() {
  const { resumes, loading, error, reload, remove, duplicate } = useResumes();
  const toast = useToast();
  const navigate = useNavigate();

  const handleDelete = async (id: number): Promise<void> => {
    try {
      await remove(id);
      toast({ title: 'Resume deleted', status: 'success', duration: 3000 });
    } catch (err) {
      toast({
        title: 'Could not delete',
        description: getApiErrorMessage(err, 'Please try again.'),
        status: 'error',
      });
    }
  };

  const handleDuplicate = async (id: number): Promise<void> => {
    try {
      await duplicate(id);
      toast({ title: 'Copy created', status: 'success', duration: 3000 });
    } catch (err) {
      toast({
        title: 'Could not duplicate',
        description: getApiErrorMessage(err, 'Please try again.'),
        status: 'error',
      });
    }
  };

  return (
    <PageWrapper>
      <Container maxW="container.xl" py={10}>
        <HStack justify="space-between" mb={8} wrap="wrap" spacing={4}>
          <div>
            <Heading size="xl">My resumes</Heading>
            <Text color="gray.600">Create, edit and download your resumes.</Text>
          </div>
          {resumes.length > 0 && (
            <HStack spacing={3}>
              <Button
                variant="outline"
                rounded="full"
                colorScheme="purple"
                onClick={() => navigate('/resumes/import')}
              >
                Import resume
              </Button>
              <GradientButton onClick={() => navigate('/resumes/new')}>
                New resume
              </GradientButton>
            </HStack>
          )}
        </HStack>

        {loading && (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            <Skeleton h="150px" borderRadius="2xl" />
            <Skeleton h="150px" borderRadius="2xl" />
            <Skeleton h="150px" borderRadius="2xl" />
          </SimpleGrid>
        )}

        {!loading && error && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Text flex="1">{error}</Text>
            <Button size="sm" onClick={() => void reload()}>
              Try again
            </Button>
          </Alert>
        )}

        {!loading && !error && resumes.length === 0 && <EmptyState />}

        {!loading && !error && resumes.length > 0 && (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            {resumes.map((r) => (
              <ResumeCard key={r.id} resume={r} onDelete={handleDelete} onDuplicate={handleDuplicate} />
            ))}
          </SimpleGrid>
        )}
      </Container>
    </PageWrapper>
  );
}
