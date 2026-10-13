import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import type { AccountSummary } from './UserMenu';

export interface NavItem {
  to: string;
  label: string;
}

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  items: NavItem[];
  account: AccountSummary;
  isActive: (to: string) => boolean;
  onSignOut: () => void;
  isSigningOut: boolean;
}

export function MobileNav({
  isOpen,
  onClose,
  items,
  account,
  isActive,
  onSignOut,
  isSigningOut,
}: MobileNavProps) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="xs">
      <DrawerOverlay />
      <DrawerContent
        pt="env(safe-area-inset-top)"
        pb="env(safe-area-inset-bottom)"
        aria-label="Main menu"
      >
        <DrawerCloseButton minW="44px" minH="44px" />
        <DrawerHeader>
          <Text fontWeight="semibold" noOfLines={1}>
            {account.name}
          </Text>
          <Text fontSize="sm" fontWeight="normal" color="gray.500" noOfLines={1}>
            {account.email}
          </Text>
        </DrawerHeader>
        <DrawerBody>
          <Stack as="nav" aria-label="Mobile" spacing={1}>
            {items.map((item) => (
              <Box
                key={item.to}
                as={RouterLink}
                to={item.to}
                onClick={onClose}
                aria-current={isActive(item.to) ? 'page' : undefined}
                display="flex"
                alignItems="center"
                minH="44px"
                px={3}
                rounded="lg"
                fontWeight="medium"
                _hover={{ bg: 'gray.100' }}
                _activeLink={{ bg: 'purple.50', color: 'purple.700' }}
              >
                {item.label}
              </Box>
            ))}
          </Stack>
        </DrawerBody>
        <DrawerFooter>
          <Button
            w="full"
            minH="48px"
            colorScheme="red"
            variant="solid"
            isLoading={isSigningOut}
            loadingText="Signing out"
            onClick={onSignOut}
          >
            Sign out
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
