import { Box } from '@chakra-ui/react';
import { motion, type Variants } from 'framer-motion';
import { Children, type ReactNode } from 'react';

const MotionBox = motion(Box);

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface AnimatedListProps {
  children: ReactNode;
}

export function AnimatedList({ children }: AnimatedListProps) {
  return (
    <MotionBox initial="hidden" animate="visible" variants={containerVariants}>
      {Children.toArray(children).map((child, i) => (
        <MotionBox key={i} variants={itemVariants}>
          {child}
        </MotionBox>
      ))}
    </MotionBox>
  );
}
