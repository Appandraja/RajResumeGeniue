import { Box, Button, Icon, Text, VStack } from '@chakra-ui/react';
import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { IMPORT_ACCEPT } from '../../services/importService';

interface FileDropZoneProps {
  onFileSelected: (file: File) => void;
  isDisabled?: boolean;
}

function UploadIcon() {
  return (
    <Icon viewBox="0 0 24 24" boxSize={10} color="purple.500" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"
      />
    </Icon>
  );
}

export function FileDropZone({ onFileSelected, isDisabled = false }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = (): void => {
    if (!isDisabled) inputRef.current?.click();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) onFileSelected(file);
    // Allow choosing the same file again after removing it.
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragging(false);
    if (isDisabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <Box
      role="group"
      aria-label="Resume file drop area"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onDragOver={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!isDisabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      borderWidth="2px"
      borderStyle="dashed"
      borderColor={dragging ? 'purple.500' : 'gray.300'}
      bg={dragging ? 'purple.50' : 'white'}
      rounded="2xl"
      p={{ base: 6, md: 10 }}
      textAlign="center"
      transition="all 0.15s"
      _focusVisible={{ outline: '3px solid', outlineColor: 'purple.400', outlineOffset: '2px' }}
      data-testid="import-dropzone"
    >
      <VStack spacing={3}>
        <UploadIcon />
        <Text fontWeight="semibold">Drag and drop your resume here</Text>
        <Text color="gray.600" fontSize="sm">
          or
        </Text>
        <Button
          colorScheme="purple"
          variant="outline"
          onClick={openPicker}
          isDisabled={isDisabled}
          size="lg"
        >
          Choose file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={IMPORT_ACCEPT}
          onChange={handleChange}
          hidden
          disabled={isDisabled}
          aria-label="Resume file"
          data-testid="import-file-input"
        />
      </VStack>
    </Box>
  );
}
