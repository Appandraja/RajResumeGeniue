import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Link,
  Tag,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { FileDropZone } from '../components/import/FileDropZone';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import {
  importResume,
  SUPPORTED_IMPORT_FORMATS,
  validateImportFile,
} from '../services/importService';
import type { ImportedDraftNavState } from '../types/importer';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportResumePage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelected = (selected: File): void => {
    const problem = validateImportFile(selected);
    if (problem) {
      setFile(null);
      setError(problem);
      return;
    }
    setError(null);
    setFile(selected);
  };

  const handleRemove = (): void => {
    setFile(null);
    setError(null);
  };

  const handleImport = async (): Promise<void> => {
    if (!file || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await importResume(file);
      const state = {
        importedDraft: result.draft,
        warnings: result.warnings,
        sourceFileName: file.name,
      } satisfies ImportedDraftNavState;
      navigate('/resumes/new', { state });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import your resume.');
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <Container maxW="container.md" py={10}>
        <VStack align="stretch" spacing={6}>
          <Box>
            <Heading as="h1" size="xl">
              Import your resume
            </Heading>
            <Text color="gray.600" mt={2}>
              Already have a resume? Upload it and we will fill in the form for you. You can check
              and fix everything before it is saved.
            </Text>
          </Box>

          <GlassCard p={{ base: 4, md: 6 }}>
            <VStack align="stretch" spacing={5}>
              <FileDropZone onFileSelected={handleSelected} isDisabled={loading} />

              <Box>
                <Text fontSize="sm" color="gray.700" mb={2}>
                  Supported files (up to 5 MB):
                </Text>
                <Wrap>
                  {SUPPORTED_IMPORT_FORMATS.map((format) => (
                    <WrapItem key={format}>
                      <Tag colorScheme="purple" variant="subtle">
                        {format}
                      </Tag>
                    </WrapItem>
                  ))}
                </Wrap>
              </Box>

              {file && (
                <HStack
                  justify="space-between"
                  borderWidth="1px"
                  rounded="lg"
                  p={3}
                  data-testid="selected-file"
                >
                  <Box minW={0}>
                    <Text fontWeight="semibold" noOfLines={1}>
                      {file.name}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      {formatSize(file.size)}
                    </Text>
                  </Box>
                  <Button size="sm" variant="ghost" onClick={handleRemove} isDisabled={loading}>
                    Remove
                  </Button>
                </HStack>
              )}

              {error && (
                <Alert status="error" borderRadius="md" role="alert">
                  <AlertIcon />
                  <Text>{error}</Text>
                </Alert>
              )}

              <GradientButton
                onClick={() => void handleImport()}
                isDisabled={!file}
                isLoading={loading}
                loadingText="Reading your resume..."
              >
                Import
              </GradientButton>

              <Text fontSize="sm" color="gray.600">
                Your file is processed to extract text and is not stored.
              </Text>
            </VStack>
          </GlassCard>

          <Text textAlign="center">
            <Link as={RouterLink} to="/resumes/new" color="purple.600">
              Start from scratch instead
            </Link>
          </Text>
        </VStack>
      </Container>
    </PageWrapper>
  );
}
