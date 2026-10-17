import { Box, Divider, Heading, ListItem, Text, UnorderedList } from '@chakra-ui/react';
import type { Template } from '../../types';

export interface TemplatePreviewProps {
  template: Pick<Template, 'font_family' | 'accent_color'>;
}

interface SectionHeadingProps {
  accent: string;
  children: string;
}

function SectionHeading({ accent, children }: SectionHeadingProps) {
  return (
    <Box mt={3}>
      <Heading
        as="h4"
        fontSize="9px"
        letterSpacing="wider"
        textTransform="uppercase"
        color={accent}
        fontFamily="inherit"
      >
        {children}
      </Heading>
      <Divider borderColor={accent} mb={1} />
    </Box>
  );
}

/** Static, ATS-style sample resume: single column, standard headings, no images/tables. */
export function TemplatePreview({ template }: TemplatePreviewProps) {
  const accent = template.accent_color;
  return (
    <Box
      bg="white"
      color="gray.800"
      fontFamily={template.font_family}
      fontSize="8px"
      lineHeight="1.4"
      p={4}
      rounded="md"
      border="1px solid"
      borderColor="gray.200"
      aria-label="Resume template preview"
    >
      <Heading as="h3" fontSize="16px" color={accent} fontFamily="inherit">
        Alex Morgan
      </Heading>
      <Text>alex.morgan@email.com | (555) 123-4567 | San Francisco, CA</Text>

      <SectionHeading accent={accent}>Summary</SectionHeading>
      <Text>Software engineer with 5 years of experience building reliable web applications.</Text>

      <SectionHeading accent={accent}>Experience</SectionHeading>
      <Text fontWeight="bold">Senior Software Engineer, Acme Corp</Text>
      <Text fontStyle="italic">Jan 2021 - Present</Text>
      <UnorderedList ml={3} mt={0.5}>
        <ListItem>Led migration to a modular API, cutting response time by 40%.</ListItem>
        <ListItem>Mentored 4 engineers and improved test coverage to 90%.</ListItem>
      </UnorderedList>

      <SectionHeading accent={accent}>Education</SectionHeading>
      <Text fontWeight="bold">B.S. Computer Science, State University</Text>

      <SectionHeading accent={accent}>Skills</SectionHeading>
      <Text>Python, TypeScript, React, SQL, Docker</Text>
    </Box>
  );
}

export default TemplatePreview;
