import { Button, type ButtonProps } from '@chakra-ui/react';
import { motion } from 'framer-motion';

const MotionButton = motion(Button);

type MotionConflictingProps =
  | 'transition'
  | 'onAnimationStart'
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd';

type GradientButtonProps = Omit<ButtonProps, MotionConflictingProps>;

export function GradientButton({ children, ...rest }: GradientButtonProps) {
  return (
    <MotionButton
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      px={6}
      py={6}
      rounded="full"
      fontWeight="semibold"
      color="white"
      bgGradient="linear(to-r, purple.500, pink.500)"
      _hover={{ bgGradient: 'linear(to-r, purple.600, pink.600)', shadow: 'lg' }}
      _active={{ bgGradient: 'linear(to-r, purple.700, pink.700)' }}
      {...rest}
    >
      {children}
    </MotionButton>
  );
}
