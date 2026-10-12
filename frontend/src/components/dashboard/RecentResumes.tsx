import { Button, Heading, HStack, Text, VStack } from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import type { Resume } from '../../types';
import { AnimatedList } from '../ui/AnimatedList';
import { GlassCard } from '../ui/GlassCard';
import { GradientButton } from '../ui/GradientButton';
import { AtsScoreBadge } from './AtsScoreBadge';

interface RecentResumesProps {
  resumes: Resume[];
  /** Map of template id to display name. */
  templateNames: Record<number, string>;
}

export function RecentResumes({ resumes, templateNames }: RecentResumesProps) {
  const navigate = useNavigate();

  if (resumes.length === 0) {
    return (
      <VStack spacing={4} py={12} textAlign="center" data-testid="dashboard-empty">
        <Heading size="md">Welcome! Let&apos;s build your first resume</Heading>
        <Text color="gray.600" maxW="md">
          It only takes a few minutes. We will guide you step by step and check that your resume
          works well with employer software.
        </Text>
        <GradientButton onClick={() => navigate('/resumes/new')}>
          Create my first resume
        </GradientButton>
      </VStack>
    );
  }

  return (
    <AnimatedList>
      {resumes.map((resume) => (
        <GlassCard key={resume.id} mb={4} p={4}>
          <HStack justify="space-between" align="start" wrap="wrap" spacing={4}>
            <VStack align="start" spacing={1}>
              <Text fontWeight="bold" noOfLines={1}>
                {resume.title}
              </Text>
              <Text fontSize="sm" color="gray.600">
                {templateNames[resume.template_id] ?? `Template #${resume.template_id}`} · Updated{' '}
                {new Date(resume.updated_at).toLocaleDateString()}
              </Text>
              <AtsScoreBadge score={resume.ats_score} />
            </VStack>
            <HStack spacing={2}>
              <Button as={RouterLink} to={`/resumes/${resume.id}`} size="sm" colorScheme="purple">
                View
              </Button>
              <Button as={RouterLink} to={`/resumes/${resume.id}/edit`} size="sm" variant="outline">
                Edit
              </Button>
            </HStack>
          </HStack>
        </GlassCard>
      ))}
    </AnimatedList>
  );
}
