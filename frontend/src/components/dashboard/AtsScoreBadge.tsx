import { Badge } from '@chakra-ui/react';

export type AtsLevel = 'low' | 'medium' | 'high';

interface AtsScoreBadgeProps {
  score: number | null;
}

export function getAtsLevel(score: number): AtsLevel {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

const LEVELS: Record<AtsLevel, { scheme: string; label: string }> = {
  low: { scheme: 'red', label: 'Needs work' },
  medium: { scheme: 'yellow', label: 'Good' },
  high: { scheme: 'green', label: 'Excellent' },
};

export function AtsScoreBadge({ score }: AtsScoreBadgeProps) {
  if (score === null) {
    return <Badge colorScheme="gray">Not scored</Badge>;
  }
  const level = getAtsLevel(score);
  const { scheme, label } = LEVELS[level];
  return (
    <Badge colorScheme={scheme} data-level={level}>
      ATS {score} · {label}
    </Badge>
  );
}
