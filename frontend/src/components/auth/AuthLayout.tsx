import type { ReactNode } from 'react';
import { Box, Center, Flex, Heading, HStack, Stack, Text } from '@chakra-ui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { DownloadIcon, FileTextIcon, SparklesIcon } from '../ui/icons';

const MotionBox = motion(Box);

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const BENEFITS = [
  { icon: FileTextIcon, text: 'ATS-friendly formats that recruiters actually parse' },
  { icon: SparklesIcon, text: 'Tailor your resume to any job description' },
  { icon: DownloadIcon, text: 'Import and export in every format you need' },
] as const;

function Logo({ light = false }: { light?: boolean }) {
  return (
    <HStack spacing={3}>
      <Center boxSize={10} rounded="xl" bg="whiteAlpha.300" color="white" backdropFilter="blur(8px)">
        <SparklesIcon boxSize={6} />
      </Center>
      <Text fontWeight="bold" fontSize="xl" color={light ? 'white' : 'gray.800'}>
        RajResumeGenie
      </Text>
    </HStack>
  );
}

/**
 * Shared shell for the auth screens. Split screen on >= md (brand panel + form),
 * compact gradient header with an overlapping card on mobile.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const reduceMotion = useReducedMotion();

  return (
    <Flex minH="100dvh" direction={{ base: 'column', md: 'row' }} bg="gray.50">
      {/* Desktop brand panel */}
      <Box
        display={{ base: 'none', md: 'flex' }}
        flexDirection="column"
        justifyContent="center"
        position="relative"
        overflow="hidden"
        w={{ md: '45%', lg: '42%' }}
        px={{ md: 10, lg: 16 }}
        py={12}
        color="white"
        bgGradient="linear(to-br, purple.600, pink.500)"
      >
        <Box
          aria-hidden
          position="absolute"
          top="-120px"
          right="-120px"
          boxSize="360px"
          rounded="full"
          bg="whiteAlpha.200"
          filter="blur(40px)"
        />
        <Box
          aria-hidden
          position="absolute"
          bottom="-140px"
          left="-100px"
          boxSize="400px"
          rounded="full"
          bg="purple.300"
          opacity={0.35}
          filter="blur(60px)"
        />
        <Box
          aria-hidden
          position="absolute"
          top="55%"
          right="12%"
          boxSize="120px"
          rounded="3xl"
          border="2px solid"
          borderColor="whiteAlpha.300"
          transform="rotate(18deg)"
        />
        <Stack spacing={10} position="relative" maxW="md">
          <Logo light />
          <Heading as="p" size="2xl" lineHeight="1.15">
            Resumes that get past the robots
          </Heading>
          <Stack spacing={5}>
            {BENEFITS.map(({ icon: BenefitIcon, text }) => (
              <HStack key={text} spacing={4} align="center">
                <Center boxSize={11} flexShrink={0} rounded="xl" bg="whiteAlpha.300">
                  <BenefitIcon boxSize={6} />
                </Center>
                <Text fontSize="md" fontWeight="medium">
                  {text}
                </Text>
              </HStack>
            ))}
          </Stack>
        </Stack>
      </Box>

      {/* Mobile compact header */}
      <Box
        display={{ base: 'block', md: 'none' }}
        px={6}
        pt={8}
        pb={20}
        position="relative"
        overflow="hidden"
        bgGradient="linear(to-br, purple.600, pink.500)"
      >
        <Box
          aria-hidden
          position="absolute"
          top="-60px"
          right="-60px"
          boxSize="200px"
          rounded="full"
          bg="whiteAlpha.200"
          filter="blur(30px)"
        />
        <Box position="relative">
          <Logo light />
        </Box>
      </Box>

      {/* Form area */}
      <Center flex={1} px={4} pb={{ base: 8, md: 12 }} pt={{ base: 0, md: 12 }} mt={{ base: -12, md: 0 }}>
        <MotionBox
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.35 }}
          w="full"
          maxW="md"
          bg="white"
          rounded="2xl"
          shadow="xl"
          border="1px solid"
          borderColor="gray.100"
          p={{ base: 6, md: 8 }}
        >
          <Stack spacing={6}>
            <Stack spacing={1}>
              <Heading as="h1" size="lg">
                {title}
              </Heading>
              {subtitle && <Text color="gray.600">{subtitle}</Text>}
            </Stack>
            {children}
            {footer && (
              <Box textAlign="center" fontSize="sm" color="gray.700">
                {footer}
              </Box>
            )}
          </Stack>
        </MotionBox>
      </Center>
    </Flex>
  );
}
