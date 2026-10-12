import type { KeyboardEvent } from 'react';
import { Badge, Box, Flex, Heading, Text } from '@chakra-ui/react';
import { GlassCard } from '../ui/GlassCard';
import { TemplatePreview } from './TemplatePreview';
import type { Template } from '../../types';

export interface TemplateCardProps {
  template: Template;
  /** Highlights the card as the current choice. */
  selected?: boolean;
  /** When provided, the card becomes clickable and keyboard-selectable. */
  onSelect?: (template: Template) => void;
}

export function TemplateCard({ template, selected = false, onSelect }: TemplateCardProps) {
  const selectable = onSelect !== undefined;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (onSelect && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onSelect(template);
    }
  };

  return (
    <GlassCard
      p={4}
      cursor={selectable ? 'pointer' : 'default'}
      border="2px solid"
      borderColor={selected ? template.accent_color : 'whiteAlpha.600'}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? selected : undefined}
      onClick={onSelect ? () => onSelect(template) : undefined}
      onKeyDown={selectable ? handleKeyDown : undefined}
      data-testid={`template-card-${template.slug}`}
    >
      <TemplatePreview template={template} />
      <Flex mt={4} align="center" justify="space-between" gap={2}>
        <Heading size="sm">{template.name}</Heading>
        {selected && <Badge colorScheme="green">Selected</Badge>}
      </Flex>
      {template.description && (
        <Text mt={1} fontSize="sm" color="gray.600">
          {template.description}
        </Text>
      )}
      <Flex mt={3} align="center" gap={2} fontSize="xs" color="gray.500">
        <Box w={3} h={3} rounded="full" bg={template.accent_color} />
        <Text>{template.font_family}</Text>
      </Flex>
    </GlassCard>
  );
}

export default TemplateCard;
