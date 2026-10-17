import { Button, HStack, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { GradientButton } from '../ui/GradientButton';
import { downloadResume, type ExportFormat } from '../../services/exportService';

interface ExportButtonsProps {
  resumeId: number;
}

export function ExportButtons({ resumeId }: ExportButtonsProps) {
  const toast = useToast();
  const [active, setActive] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat): Promise<void> => {
    setActive(format);
    try {
      await downloadResume(resumeId, format);
      toast({ title: `${format.toUpperCase()} downloaded`, status: 'success', duration: 3000 });
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Export failed.';
      toast({ title: 'Export failed', description, status: 'error', duration: 6000 });
    } finally {
      setActive(null);
    }
  };

  return (
    <HStack spacing={3}>
      <GradientButton
        onClick={() => void handleExport('pdf')}
        isLoading={active === 'pdf'}
        isDisabled={active !== null}
        loadingText="Preparing PDF"
        aria-label="Download resume as PDF"
      >
        Download PDF
      </GradientButton>
      <Button
        variant="outline"
        rounded="full"
        onClick={() => void handleExport('docx')}
        isLoading={active === 'docx'}
        isDisabled={active !== null}
        loadingText="Preparing DOCX"
        aria-label="Download resume as Word document"
      >
        Download DOCX
      </Button>
    </HStack>
  );
}

export default ExportButtons;
