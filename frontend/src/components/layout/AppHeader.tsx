import {
  Box,
  Flex,
  HStack,
  Icon,
  IconButton,
  Text,
  useDisclosure,
  useToast,
  type IconProps,
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { MobileNav, type NavItem } from './MobileNav';
import { UserMenu, type AccountSummary } from './UserMenu';

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/resumes', label: 'My resumes' },
  { to: '/templates', label: 'Templates' },
  { to: '/resumes/import', label: 'Import' },
];

function isRouteActive(to: string, pathname: string): boolean {
  if (to === '/resumes') {
    // Matches the list and resume detail/edit/new pages, but not the import page.
    return pathname.startsWith('/resumes') && !pathname.startsWith('/resumes/import');
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

function LogoMark(props: IconProps) {
  return (
    <Icon viewBox="0 0 32 32" {...props}>
      <defs>
        <linearGradient id="rrg-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#rrg-logo)" />
      <path
        d="M10 8h8a4 4 0 0 1 0 8h-8zM10 16h5l6 8"
        stroke="#fff"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

function MenuIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </Icon>
  );
}

export function buildAccountSummary(
  fullName: string | null | undefined,
  email: string | undefined,
): AccountSummary {
  const trimmed = fullName?.trim() ?? '';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  let initials = '?';
  if (parts.length > 0) {
    initials = (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  } else if (email) {
    initials = email[0].toUpperCase();
  }
  return {
    name: trimmed || email || 'Account',
    firstName: parts[0] ?? email?.split('@')[0] ?? 'Account',
    email: email ?? '',
    initials,
  };
}

export function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { pathname } = useLocation();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);
  const mounted = useRef<boolean>(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  const account = buildAccountSummary(user?.full_name, user?.email);
  const isActive = (to: string): boolean => isRouteActive(to, pathname);

  const handleSignOut = async (): Promise<void> => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await logout();
    } finally {
      if (mounted.current) setIsSigningOut(false);
    }
    onClose();
    navigate('/login', { replace: true });
    toast({
      title: "You've been signed out",
      status: 'success',
      duration: 4000,
      isClosable: true,
    });
  };

  const signOut = (): void => {
    void handleSignOut();
  };

  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex="sticky"
      mt="calc(-1 * env(safe-area-inset-top))"
      pt="env(safe-area-inset-top)"
      bg="whiteAlpha.900"
      backdropFilter="blur(12px)"
      borderBottom="1px solid"
      borderColor="gray.200"
    >
      <Flex maxW="container.xl" mx="auto" px={{ base: 3, md: 6 }} h="64px" align="center" gap={4}>
        <HStack
          as={RouterLink}
          to="/dashboard"
          spacing={2}
          minH="44px"
          aria-label="RajResumeGenie home"
        >
          <LogoMark boxSize={8} />
          <Text
            fontWeight="extrabold"
            fontSize="lg"
            bgGradient="linear(to-r, purple.600, pink.500)"
            bgClip="text"
          >
            RajResumeGenie
          </Text>
        </HStack>

        <HStack
          as="nav"
          aria-label="Main"
          spacing={1}
          ml={6}
          display={{ base: 'none', md: 'flex' }}
        >
          {NAV_ITEMS.map((item) => (
            <Box
              key={item.to}
              as={RouterLink}
              to={item.to}
              aria-current={isActive(item.to) ? 'page' : undefined}
              display="flex"
              alignItems="center"
              minH="44px"
              px={3}
              rounded="full"
              fontSize="sm"
              fontWeight="medium"
              color="gray.600"
              _hover={{ bg: 'gray.100', color: 'gray.900' }}
              _activeLink={{ bg: 'purple.50', color: 'purple.700', fontWeight: 'semibold' }}
            >
              {item.label}
            </Box>
          ))}
        </HStack>

        <Box flex="1" />

        <UserMenu account={account} onSignOut={signOut} isSigningOut={isSigningOut} />

        <IconButton
          display={{ base: 'inline-flex', md: 'none' }}
          aria-label="Open menu"
          variant="ghost"
          minW="44px"
          minH="44px"
          icon={<MenuIcon boxSize={6} />}
          onClick={onOpen}
        />
      </Flex>

      <MobileNav
        isOpen={isOpen}
        onClose={onClose}
        items={NAV_ITEMS}
        account={account}
        isActive={isActive}
        onSignOut={signOut}
        isSigningOut={isSigningOut}
      />
    </Box>
  );
}
