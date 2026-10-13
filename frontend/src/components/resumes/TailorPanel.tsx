import {
  Alert,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertIcon,
  Badge,
  Box,
  Button,
  CircularProgress,
  CircularProgressLabel,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  ListItem,
  Tag,
  Text,
  Textarea,
  UnorderedList,
  VStack,
  Wrap,
  WrapItem,
  useToast,
} from '@chakra-ui/react';
import { useRef, useState } from 'react';
import { useTailor } from '../../hooks/useTailor';
import { getApiErrorMessage, updateResume } from '../../services/resumeService';
import type { Resume } from '../../types';
import type {
  KeywordImportance,
  MissingKeyword,
  TailorAction,
  TailorSuggestion,
} from '../../types/tailor';
import { GlassCard } from '../ui/GlassCard';
import { MAX_JOB_DESCRIPTION } from './resumeForm';

interface TailorPanelProps {
  resume: Resume;
  /** Called after the resume was changed on the server so the page can reload it. */
  onResumeChanged: () => Promise<void>;
}

const IMPORTANCE_LABEL: Record<KeywordImportance, string> = {
  high: 'Very important',
  medium: 'Important',
  low: 'Nice to have',
};
const IMPORTANCE_ORDER: KeywordImportance[] = ['high', 'medium', 'low'];

const SEVERITY_SCHEME: Record<KeywordImportance, string> = {
  high: 'red',
  medium: 'orange',
  low: 'gray',
};

function matchLabel(score: number): string {
  if (score >= 75) return 'Strong match';
  if (score >= 50) return 'Partial match';
  return 'Low match';
}

function scoreColor(score: number): string {
  if (score >= 75) return 'green.500';
  if (score >= 50) return 'orange.400';
  return 'red.400';
}

function describeAction(action: TailorAction): string {
  return action.type === 'add_skill'
    ? `Add "${String(action.value)}" to your skills`
    : 'Reorder your skills so the most relevant come first';
}

/** Computes the new skills list for an action without ever removing the user's skills. */
export function skillsAfterAction(current: string[], action: TailorAction): string[] {
  if (action.type === 'add_skill') {
    const skill = String(action.value).trim();
    if (!skill || current.some((s) => s.toLowerCase() === skill.toLowerCase())) return current;
    return [...current, skill];
  }
  const wanted = Array.isArray(action.value) ? action.value : [];
  const byKey = new Map(current.map((s) => [s.toLowerCase(), s]));
  const ordered: string[] = [];
  for (const item of wanted) {
    const existing = byKey.get(item.toLowerCase());
    if (existing !== undefined && !ordered.includes(existing)) ordered.push(existing);
  }
  for (const s of current) if (!ordered.includes(s)) ordered.push(s);
  return ordered;
}

export function TailorPanel({ resume, onResumeChanged }: TailorPanelProps) {
  const toast = useToast();
  const { result, loading, error, analyze } = useTailor(resume.id);
  const [jobTitle, setJobTitle] = useState<string>(resume.job_title ?? '');
  const [jobDescription, setJobDescription] = useState<string>(resume.job_description ?? '');
  const [pending, setPending] = useState<TailorSuggestion | null>(null);
  const [applying, setApplying] = useState<boolean>(false);
  const [savingJd, setSavingJd] = useState<boolean>(false);
  const [emptyError, setEmptyError] = useState<boolean>(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const jdUnsaved =
    jobTitle.trim() !== (resume.job_title ?? '') ||
    jobDescription.trim() !== (resume.job_description ?? '').trim();

  const handleAnalyze = async (): Promise<void> => {
    if (jobDescription.trim() === '') {
      setEmptyError(true);
      return;
    }
    setEmptyError(false);
    await analyze(jobDescription);
  };

  const handleSaveJd = async (): Promise<void> => {
    setSavingJd(true);
    try {
      await updateResume(resume.id, {
        job_title: jobTitle.trim() === '' ? null : jobTitle.trim(),
        job_description: jobDescription.trim() === '' ? null : jobDescription,
      });
      await onResumeChanged();
      toast({ title: 'Job description saved to this resume', status: 'success', duration: 3000 });
    } catch (err) {
      toast({
        title: 'Could not save the job description',
        description: getApiErrorMessage(err, 'Please try again.'),
        status: 'error',
        duration: 6000,
      });
    } finally {
      setSavingJd(false);
    }
  };

  const handleConfirmApply = async (): Promise<void> => {
    const action = pending?.action;
    if (!action) return;
    setApplying(true);
    try {
      const skills = skillsAfterAction(resume.skills, action);
      await updateResume(resume.id, { skills });
      await onResumeChanged();
      toast({ title: 'Suggestion applied', status: 'success', duration: 3000 });
      setPending(null);
      await analyze(jobDescription);
    } catch (err) {
      setPending(null);
      toast({
        title: 'Could not apply the suggestion',
        description: getApiErrorMessage(err, 'Please try again.'),
        status: 'error',
        duration: 6000,
      });
    } finally {
      setApplying(false);
    }
  };

  const missingByImportance = (level: KeywordImportance): MissingKeyword[] =>
    result ? result.missing.filter((m) => m.importance === level) : [];

  return (
    <GlassCard>
      <Heading as="h2" size="md" mb={1}>
        Tailor to a job
      </Heading>
      <Text fontSize="sm" color="gray.600" mb={4}>
        Paste a job description to see which keywords your resume already covers and what you could
        add. Nothing changes until you approve it.
      </Text>

      <VStack align="stretch" spacing={4}>
        <FormControl>
          <FormLabel>Job title</FormLabel>
          <Input
            value={jobTitle}
            placeholder="e.g. Marketing Manager"
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </FormControl>
        <FormControl isInvalid={emptyError}>
          <FormLabel>Paste the job description</FormLabel>
          <Textarea
            value={jobDescription}
            rows={8}
            maxLength={MAX_JOB_DESCRIPTION}
            placeholder="Paste the job posting here."
            onChange={(e) => {
              setJobDescription(e.target.value);
              setEmptyError(false);
            }}
          />
          <FormHelperText color={emptyError ? 'red.500' : undefined}>
            {emptyError
              ? 'Please paste a job description first.'
              : `${jobDescription.length.toLocaleString('en-US')} / ${MAX_JOB_DESCRIPTION.toLocaleString('en-US')} characters`}
          </FormHelperText>
        </FormControl>

        <HStack spacing={3} wrap="wrap">
          <Button
            colorScheme="purple"
            onClick={() => void handleAnalyze()}
            isLoading={loading}
            loadingText="Analyzing"
            isDisabled={applying}
          >
            Analyze match
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleSaveJd()}
            isLoading={savingJd}
            isDisabled={!jdUnsaved || applying}
          >
            Save job description to this resume
          </Button>
        </HStack>

        {error && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Text flex="1">{error}</Text>
          </Alert>
        )}

        {result && (
          <VStack align="stretch" spacing={5} aria-live="polite">
            <HStack spacing={4}>
              <CircularProgress
                value={result.match_score}
                size="90px"
                thickness="10px"
                color={scoreColor(result.match_score)}
              >
                <CircularProgressLabel fontWeight="bold">{result.match_score}</CircularProgressLabel>
              </CircularProgress>
              <Box>
                <Text fontWeight="bold">
                  {matchLabel(result.match_score)}: {result.match_score} out of 100
                </Text>
                <Text fontSize="sm" color="gray.600">
                  This is an estimate of keyword coverage, not a guarantee of how any applicant
                  tracking system will score or rank you.
                </Text>
              </Box>
            </HStack>

            <Box>
              <Heading as="h3" size="sm" mb={2}>
                Keywords you already cover ({result.matched.length})
              </Heading>
              {result.matched.length === 0 ? (
                <Text fontSize="sm" color="gray.600">
                  No matching keywords found yet.
                </Text>
              ) : (
                <Wrap>
                  {result.matched.map((m) => (
                    <WrapItem key={m.keyword}>
                      <Tag
                        colorScheme="green"
                        title={m.where.length > 0 ? `Found in: ${m.where.join(', ')}` : undefined}
                      >
                        {m.keyword}
                      </Tag>
                    </WrapItem>
                  ))}
                </Wrap>
              )}
            </Box>

            <Box>
              <Heading as="h3" size="sm" mb={2}>
                Keywords to consider ({result.missing.length})
              </Heading>
              {result.missing.length === 0 ? (
                <Text fontSize="sm" color="green.700">
                  No missing keywords. Nice work!
                </Text>
              ) : (
                <VStack align="stretch" spacing={3}>
                  {IMPORTANCE_ORDER.map((level) => {
                    const items = missingByImportance(level);
                    if (items.length === 0) return null;
                    return (
                      <Box key={level}>
                        <Text fontSize="sm" fontWeight="semibold" mb={1}>
                          {IMPORTANCE_LABEL[level]}
                        </Text>
                        <UnorderedList spacing={1} fontSize="sm">
                          {items.map((m) => (
                            <ListItem key={m.keyword}>
                              <Text as="span" fontWeight="semibold">
                                {m.keyword}
                              </Text>
                              {m.suggestion ? `: ${m.suggestion}` : ''}
                            </ListItem>
                          ))}
                        </UnorderedList>
                      </Box>
                    );
                  })}
                </VStack>
              )}
            </Box>

            {result.suggestions.length > 0 && (
              <Box>
                <Heading as="h3" size="sm" mb={2}>
                  Suggestions
                </Heading>
                <VStack align="stretch" spacing={3}>
                  {result.suggestions.map((s) => (
                    <HStack
                      key={`${s.code}-${s.message}`}
                      align="flex-start"
                      justify="space-between"
                      spacing={3}
                    >
                      <Box>
                        <Badge mr={2} colorScheme={SEVERITY_SCHEME[s.severity]}>
                          {IMPORTANCE_LABEL[s.severity]}
                        </Badge>
                        <Text as="span" fontSize="sm">
                          {s.message}
                        </Text>
                      </Box>
                      {s.action && (
                        <Button
                          size="sm"
                          variant="outline"
                          flexShrink={0}
                          aria-label={`Apply: ${s.message}`}
                          onClick={() => setPending(s)}
                          isDisabled={applying}
                        >
                          Apply
                        </Button>
                      )}
                    </HStack>
                  ))}
                </VStack>
              </Box>
            )}
          </VStack>
        )}
      </VStack>

      <AlertDialog
        isOpen={pending !== null}
        leastDestructiveRef={cancelRef}
        onClose={() => {
          if (!applying) setPending(null);
        }}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Apply this suggestion?</AlertDialogHeader>
            <AlertDialogBody>
              <Text mb={2}>{pending?.action ? `${describeAction(pending.action)}.` : ''}</Text>
              <Text fontWeight="semibold">Only add skills you really have.</Text>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setPending(null)} isDisabled={applying}>
                Cancel
              </Button>
              <Button
                colorScheme="purple"
                ml={3}
                onClick={() => void handleConfirmApply()}
                isLoading={applying}
              >
                Yes, apply it
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </GlassCard>
  );
}

export default TailorPanel;
