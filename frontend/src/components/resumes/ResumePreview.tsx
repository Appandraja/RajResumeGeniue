import { Box, Divider, Heading, HStack, Text, VStack } from '@chakra-ui/react';
import type { Template } from '../../types';
import { dateRange, type ResumeFormState, type SectionDraft } from './resumeForm';

interface ResumePreviewProps {
  form: ResumeFormState;
  /** Selected template; falls back to a neutral style when unknown. */
  template: Pick<Template, 'font_family' | 'accent_color'> | null;
}

const FALLBACK_FONT = 'Arial, Helvetica, sans-serif';
const FALLBACK_ACCENT = '#2D3748';

interface SectionBlockProps {
  heading: string;
  accent: string;
  items: SectionDraft[];
}

function SectionBlock({ heading, accent, items }: SectionBlockProps) {
  if (items.length === 0) return null;
  return (
    <Box as="section">
      <Heading as="h2" size="sm" textTransform="uppercase" letterSpacing="wide" color={accent}>
        {heading}
      </Heading>
      <Divider borderColor={accent} mb={2} />
      <VStack align="stretch" spacing={3}>
        {items.map((s) => {
          const range = dateRange(s.start_date || null, s.end_date || null);
          const bullets = s.bullets.map((b) => b.trim()).filter((b) => b.length > 0);
          return (
            <Box key={s.key}>
              <HStack justify="space-between" align="baseline">
                <Text fontWeight="bold">{s.title || 'Untitled'}</Text>
                {range && <Text fontSize="sm">{range}</Text>}
              </HStack>
              {(s.organization || s.location) && (
                <Text fontSize="sm" fontStyle="italic">
                  {[s.organization, s.location].filter(Boolean).join(', ')}
                </Text>
              )}
              {bullets.length > 0 && (
                <Box as="ul" pl={5} mt={1} fontSize="sm">
                  {bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </Box>
              )}
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
}

export function ResumePreview({ form, template }: ResumePreviewProps) {
  const font = template?.font_family ?? FALLBACK_FONT;
  const accent = template?.accent_color ?? FALLBACK_ACCENT;
  const contact = [form.email, form.phone, form.location, form.linkedin_url, form.website_url]
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  const byType = (type: SectionDraft['type']): SectionDraft[] =>
    form.sections.filter((s) => s.type === type);

  const isBlank =
    !form.full_name && !form.summary && form.skills.length === 0 && form.sections.length === 0;

  return (
    <Box
      data-testid="resume-preview"
      bg="white"
      color="black"
      shadow="lg"
      borderRadius="md"
      p={{ base: 5, md: 8 }}
      fontFamily={font}
      lineHeight="1.5"
    >
      {isBlank ? (
        <Text color="gray.500" textAlign="center" py={10}>
          Your resume will appear here as you fill in the form.
        </Text>
      ) : (
        <VStack align="stretch" spacing={4}>
          <Box textAlign="center">
            <Heading as="h1" size="lg" color={accent}>
              {form.full_name || 'Your Name'}
            </Heading>
            {contact.length > 0 && <Text fontSize="sm">{contact.join('  |  ')}</Text>}
          </Box>
          {form.summary.trim() && (
            <Box as="section">
              <Heading as="h2" size="sm" textTransform="uppercase" letterSpacing="wide" color={accent}>
                Summary
              </Heading>
              <Divider borderColor={accent} mb={2} />
              <Text fontSize="sm">{form.summary}</Text>
            </Box>
          )}
          <SectionBlock heading="Experience" accent={accent} items={byType('experience')} />
          <SectionBlock heading="Education" accent={accent} items={byType('education')} />
          <SectionBlock heading="Projects" accent={accent} items={byType('project')} />
          <SectionBlock heading="Certifications" accent={accent} items={byType('certification')} />
          {form.skills.length > 0 && (
            <Box as="section">
              <Heading as="h2" size="sm" textTransform="uppercase" letterSpacing="wide" color={accent}>
                Skills
              </Heading>
              <Divider borderColor={accent} mb={2} />
              <Text fontSize="sm">{form.skills.join(', ')}</Text>
            </Box>
          )}
        </VStack>
      )}
    </Box>
  );
}
