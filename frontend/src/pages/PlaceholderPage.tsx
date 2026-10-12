import { Container, Heading, Text } from '@chakra-ui/react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';

interface PlaceholderPageProps {
  title: string;
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <PageWrapper>
      <Container maxW="container.md" py={16}>
        <GlassCard>
          <Heading size="lg" mb={2}>
            {title}
          </Heading>
          <Text color="gray.600">This page is coming soon.</Text>
        </GlassCard>
      </Container>
    </PageWrapper>
  );
}
