import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  HStack,
  IconButton,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useRef, useState } from 'react';
import type { ResumeSectionType } from '../../types';
import { SectionEditor } from './SectionEditor';
import { newSection, type FormErrors, type SectionDraft } from './resumeForm';

interface SectionListProps {
  type: ResumeSectionType;
  /** All sections of the resume; only those matching `type` are shown. */
  sections: SectionDraft[];
  onChange: (next: SectionDraft[]) => void;
  errors?: FormErrors;
  itemLabel: string;
  emptyHint: string;
}

export function SectionList({
  type,
  sections,
  onChange,
  errors = {},
  itemLabel,
  emptyHint,
}: SectionListProps) {
  const [pendingDelete, setPendingDelete] = useState<SectionDraft | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const visible = sections.filter((s) => s.type === type);

  const update = (next: SectionDraft): void =>
    onChange(sections.map((s) => (s.key === next.key ? next : s)));

  const move = (key: string, delta: -1 | 1): void => {
    const idx = visible.findIndex((s) => s.key === key);
    const target = visible[idx + delta];
    if (!target) return;
    const a = sections.findIndex((s) => s.key === key);
    const b = sections.findIndex((s) => s.key === target.key);
    const copy = [...sections];
    [copy[a], copy[b]] = [copy[b], copy[a]];
    onChange(copy);
  };

  const confirmDelete = (): void => {
    if (pendingDelete) onChange(sections.filter((s) => s.key !== pendingDelete.key));
    setPendingDelete(null);
  };

  return (
    <VStack spacing={5} align="stretch">
      {visible.length === 0 && <Text color="gray.600">{emptyHint}</Text>}
      {visible.map((section, i) => (
        <Box key={section.key} borderWidth="1px" borderRadius="xl" p={4} bg="whiteAlpha.800">
          <HStack justify="space-between" mb={3}>
            <Text fontWeight="semibold">
              {itemLabel} {i + 1}
            </Text>
            <HStack>
              <IconButton
                aria-label={`Move ${itemLabel} ${i + 1} up`}
                icon={<span aria-hidden="true">↑</span>}
                size="sm"
                variant="ghost"
                isDisabled={i === 0}
                onClick={() => move(section.key, -1)}
              />
              <IconButton
                aria-label={`Move ${itemLabel} ${i + 1} down`}
                icon={<span aria-hidden="true">↓</span>}
                size="sm"
                variant="ghost"
                isDisabled={i === visible.length - 1}
                onClick={() => move(section.key, 1)}
              />
              <Button size="sm" colorScheme="red" variant="ghost" onClick={() => setPendingDelete(section)}>
                Remove
              </Button>
            </HStack>
          </HStack>
          <SectionEditor section={section} onChange={update} error={errors[section.key]} />
        </Box>
      ))}
      <Button
        alignSelf="flex-start"
        colorScheme="purple"
        variant="outline"
        onClick={() => onChange([...sections, newSection(type)])}
      >
        + Add {itemLabel.toLowerCase()}
      </Button>

      <AlertDialog
        isOpen={pendingDelete !== null}
        leastDestructiveRef={cancelRef}
        onClose={() => setPendingDelete(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Remove this {itemLabel.toLowerCase()}?</AlertDialogHeader>
            <AlertDialogBody>
              {pendingDelete?.title ? `"${pendingDelete.title}" ` : 'This entry '}
              will be removed from your resume when you save.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setPendingDelete(null)}>
                Keep it
              </Button>
              <Button colorScheme="red" ml={3} onClick={confirmDelete}>
                Remove
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}
