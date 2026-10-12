import { Box, type BoxProps } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const MotionBox = motion(Box);

type MotionConflictingProps =
  | 'transition'
  | 'onAnimationStart'
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd';

interface GlassCardProps extends Omit<BoxProps, MotionConflictingProps> {
  children: ReactNode;
}

export function GlassCard({ children, ...rest }: GlassCardProps) {
  return (
    <MotionBox
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -5 }}
      p={6}
      rounded="2xl"
      bg="whiteAlpha.700"
      backdropFilter="blur(16px)"
      border="1px solid"
      borderColor="whiteAlpha.600"
      shadow="xl"
      {...rest}
    >
      {children}
    </MotionBox>
  );
}
