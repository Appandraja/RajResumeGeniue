import { Button, Heading, Text, VStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { GradientButton } from '../ui/GradientButton';

export function EmptyState() {
  const navigate = useNavigate();
  return (
    <VStack spacing={4} py={16} textAlign="center" data-testid="resumes-empty">
      <Heading size="lg">You have no resumes yet</Heading>
      <Text color="gray.600" maxW="md">
        Create your first resume in a few minutes. We will guide you step by step and check that it
        works well with employer software.
      </Text>
      <GradientButton onClick={() => navigate('/resumes/new')}>
        Create my first resume
      </GradientButton>
      <Button variant="outline" rounded="full" onClick={() => navigate('/resumes/import')}>
        Import an existing resume
      </Button>
    </VStack>
  );
}
