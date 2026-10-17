import { Box, Button, Menu, MenuButton, MenuItem, MenuList, Text, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { EXPORT_FORMATS, type ExportFormat } from '../../lib/exportFormats';
import { downloadResume } from '../../services/exportService';

interface ExportButtonsProps {
  resumeId: number;
}

/** Format picker: one Download menu listing every export format with a short description. */
export function ExportButtons({ resumeId }: ExportButtonsProps) {
  const toast = useToast();
  const [active, setActive] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat): Promise<void> => {
    setActive(format);
    const label = EXPORT_FORMATS.find((f) => f.id === format)?.label ?? format.toUpperCase();
    try {
      await downloadResume(resumeId, format);
      toast({ title: `${label} downloaded`, status: 'success', duration: 3000 });
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Export failed.';
      toast({ title: 'Export failed', description, status: 'error', duration: 8000 });
    } finally {
      setActive(null);
    }
  };

  const activeLabel = EXPORT_FORMATS.find((f) => f.id === active)?.label;

  return (
    <Menu placement="bottom-end">
      <MenuButton
        as={Button}
        px={6}
        py={6}
        rounded="full"
        fontWeight="semibold"
        color="white"
        bgGradient="linear(to-r, purple.500, pink.500)"
        _hover={{ bgGradient: 'linear(to-r, purple.600, pink.600)', shadow: 'lg' }}
        _active={{ bgGradient: 'linear(to-r, purple.700, pink.700)' }}
        isLoading={active !== null}
        isDisabled={active !== null}
        loadingText={activeLabel ? `Preparing ${activeLabel}` : 'Preparing'}
        aria-label="Download resume"
      >
        Download as...
      </MenuButton>
      <MenuList maxW="sm" zIndex="dropdown">
        {EXPORT_FORMATS.map((format) => (
          <MenuItem
            key={format.id}
            onClick={() => void handleExport(format.id)}
            aria-label={`Download resume as ${format.label}`}
          >
            <Box>
              <Text fontWeight="semibold">{format.label}</Text>
              <Text fontSize="xs" color="gray.600" whiteSpace="normal">
                {format.description}
              </Text>
            </Box>
          </MenuItem>
        ))}
      </MenuList>
    </Menu>
  );
}

export default ExportButtons;
