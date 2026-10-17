import {
  Alert,
  AlertIcon,
  Button,
  CircularProgress,
  CircularProgressLabel,
  HStack,
  List,
  ListIcon,
  ListItem,
  Skeleton,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useAtsCheck } from '../../hooks/useResume';
import { GlassCard } from '../ui/GlassCard';

interface AtsScorePanelProps {
  resumeId: number;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'green.400';
  if (score >= 50) return 'orange.400';
  return 'red.400';
}

function scoreMessage(score: number): string {
  if (score >= 80) return 'Great! Applicant tracking systems should read your resume well.';
  if (score >= 50) return 'Good start. A few changes will make it easier to read automatically.';
  return 'Needs work. Follow the tips below to improve your score.';
}

export function AtsScorePanel({ resumeId }: AtsScorePanelProps) {
  const { result, loading, error, refresh } = useAtsCheck(resumeId);

  return (
    <GlassCard>
      <Text fontWeight="bold" fontSize="lg" mb={1}>
        ATS score
      </Text>
      <Text fontSize="sm" color="gray.600" mb={4}>
        Many employers use software (ATS) to scan resumes. This score shows how easily it can read
        yours.
      </Text>
      {loading && <Skeleton h="100px" borderRadius="md" />}
      {error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Text flex="1">{error}</Text>
          <Button size="sm" onClick={() => void refresh()}>
            Try again
          </Button>
        </Alert>
      )}
      {result && !loading && (
        <VStack align="stretch" spacing={4}>
          <HStack spacing={4}>
            <CircularProgress
              value={result.score}
              size="90px"
              thickness="10px"
              color={scoreColor(result.score)}
            >
              <CircularProgressLabel fontWeight="bold">{result.score}</CircularProgressLabel>
            </CircularProgress>
            <Text>{scoreMessage(result.score)}</Text>
          </HStack>
          {result.suggestions.length > 0 ? (
            <List spacing={2}>
              {result.suggestions.map((s) => (
                <ListItem key={s} fontSize="sm">
                  <ListIcon as="span" color="purple.500">
                    •
                  </ListIcon>
                  {s}
                </ListItem>
              ))}
            </List>
          ) : (
            <Text fontSize="sm" color="green.600">
              No suggestions. Nice work!
            </Text>
          )}
          <Button size="sm" variant="outline" alignSelf="flex-start" onClick={() => void refresh()}>
            Re-check
          </Button>
        </VStack>
      )}
    </GlassCard>
  );
}
