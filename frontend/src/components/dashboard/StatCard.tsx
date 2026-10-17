import { Stat, StatHelpText, StatLabel, StatNumber } from '@chakra-ui/react';
import { GlassCard } from '../ui/GlassCard';

interface StatCardProps {
  label: string;
  value: string;
  helpText?: string;
}

export function StatCard({ label, value, helpText }: StatCardProps) {
  return (
    <GlassCard>
      <Stat>
        <StatLabel>{label}</StatLabel>
        <StatNumber>{value}</StatNumber>
        {helpText && <StatHelpText mb={0}>{helpText}</StatHelpText>}
      </Stat>
    </GlassCard>
  );
}
