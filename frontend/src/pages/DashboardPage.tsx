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
  VStack,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { RecentResumes } from '../components/dashboard/RecentResumes';
import { StatCard } from '../components/dashboard/StatCard';
import { computeStats, mostRecent } from '../components/dashboard/stats';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GradientButton } from '../components/ui/GradientButton';
import { useAuth } from '../hooks/useAuth';
import { useResumes } from '../hooks/useResumes';
import { listTemplates } from '../services/templateService';

const RECENT_LIMIT = 5;

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { resumes, loading, error, reload } = useResumes();
  const [templateNames, setTemplateNames] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    listTemplates()
      .then((templates) => {
        if (cancelled) return;
        const names: Record<number, string> = {};
        templates.forEach((t) => {
          names[t.id] = t.name;
        });
        setTemplateNames(names);
      })
      .catch(() => {
        // Template names are cosmetic; the list falls back to "Template #id".
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => computeStats(resumes), [resumes]);
  const recent = useMemo(() => mostRecent(resumes, RECENT_LIMIT), [resumes]);
  const displayName = user?.full_name?.trim() || user?.email || 'there';

  return (
    <PageWrapper>
      <Container maxW="container.xl" py={10}>
        <HStack justify="space-between" mb={8} wrap="wrap" spacing={4}>
          <VStack align="start" spacing={1}>
            <Heading as="h1" size="xl">
              Welcome back, {displayName}
            </Heading>
            <Text color="gray.600">Here is how your resumes are doing.</Text>
          </VStack>
          <GradientButton onClick={() => navigate('/resumes/new')}>Create new resume</GradientButton>
        </HStack>

        {loading && (
          <VStack align="stretch" spacing={6} data-testid="dashboard-loading">
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
              <Skeleton h="110px" borderRadius="2xl" />
              <Skeleton h="110px" borderRadius="2xl" />
              <Skeleton h="110px" borderRadius="2xl" />
            </SimpleGrid>
            <Skeleton h="90px" borderRadius="2xl" />
            <Skeleton h="90px" borderRadius="2xl" />
          </VStack>
        )}

        {!loading && error && (
          <Alert status="error" borderRadius="md" role="alert">
            <AlertIcon />
            <Text flex="1">{error}</Text>
            <Button size="sm" onClick={() => void reload()}>
              Try again
            </Button>
          </Alert>
        )}

        {!loading && !error && (
          <VStack align="stretch" spacing={8}>
            {resumes.length > 0 && (
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
                <StatCard label="Resumes" value={String(stats.total)} />
                <StatCard
                  label="Average ATS score"
                  value={stats.averageScore === null ? '-' : String(stats.averageScore)}
                  helpText={stats.averageScore === null ? 'No scores yet' : 'out of 100'}
                />
                <StatCard
                  label="Best ATS score"
                  value={stats.bestScore === null ? '-' : String(stats.bestScore)}
                  helpText={stats.bestScore === null ? 'No scores yet' : 'out of 100'}
                />
              </SimpleGrid>
            )}

            <section aria-labelledby="recent-heading">
              <Heading as="h2" id="recent-heading" size="md" mb={4}>
                Recent resumes
              </Heading>
              <RecentResumes resumes={recent} templateNames={templateNames} />
            </section>

            <section aria-labelledby="quick-actions-heading">
              <Heading as="h2" id="quick-actions-heading" size="md" mb={4}>
                Quick actions
              </Heading>
              <HStack spacing={3} wrap="wrap">
                <Button as={RouterLink} to="/templates" variant="outline" rounded="full">
                  Browse templates
                </Button>
                <Button as={RouterLink} to="/resumes" variant="outline" rounded="full">
                  View all resumes
                </Button>
              </HStack>
            </section>
          </VStack>
        )}
      </Container>
    </PageWrapper>
  );
}
