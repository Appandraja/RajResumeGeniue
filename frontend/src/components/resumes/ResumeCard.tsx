import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Button,
  HStack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import type { Resume } from '../../types';
import { GlassCard } from '../ui/GlassCard';

interface ResumeCardProps {
  resume: Resume;
  onDelete: (id: number) => Promise<void>;
  onDuplicate: (id: number) => Promise<void>;
}

function scoreScheme(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 50) return 'orange';
  return 'red';
}

export function ResumeCard({ resume, onDelete, onDuplicate }: ResumeCardProps) {
  const [confirming, setConfirming] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const updated = new Date(resume.updated_at).toLocaleDateString();

  return (
    <GlassCard>
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="start">
          <Text fontWeight="bold" fontSize="lg" noOfLines={2}>
            {resume.title}
          </Text>
          {resume.ats_score !== null && (
            <Badge colorScheme={scoreScheme(resume.ats_score)}>ATS {resume.ats_score}</Badge>
          )}
        </HStack>
        <Text fontSize="sm" color="gray.600">
          {resume.full_name ?? 'No name yet'} · Updated {updated}
        </Text>
        <HStack spacing={2} wrap="wrap">
          <Button as={RouterLink} to={`/resumes/${resume.id}`} size="sm" colorScheme="purple">
            Open
          </Button>
          <Button as={RouterLink} to={`/resumes/${resume.id}/edit`} size="sm" variant="outline">
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isLoading={busy && !confirming}
            onClick={() => void run(() => onDuplicate(resume.id))}
          >
            Duplicate
          </Button>
          <Button size="sm" variant="ghost" colorScheme="red" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        </HStack>
      </VStack>

      <AlertDialog
        isOpen={confirming}
        leastDestructiveRef={cancelRef}
        onClose={() => setConfirming(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete this resume?</AlertDialogHeader>
            <AlertDialogBody>
              &quot;{resume.title}&quot; will be permanently deleted. This cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setConfirming(false)}>
                Keep it
              </Button>
              <Button
                colorScheme="red"
                ml={3}
                isLoading={busy}
                onClick={() => void run(() => onDelete(resume.id))}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </GlassCard>
  );
}
