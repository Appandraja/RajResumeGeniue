import {
  Avatar,
  Box,
  Button,
  HStack,
  Icon,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Text,
  type IconProps,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

export interface AccountSummary {
  name: string;
  firstName: string;
  email: string;
  initials: string;
}

interface UserMenuProps {
  account: AccountSummary;
  onSignOut: () => void;
  isSigningOut: boolean;
}

function SignOutIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" />
      <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}

export function UserMenu({ account, onSignOut, isSigningOut }: UserMenuProps) {
  return (
    <Menu placement="bottom-end">
      <MenuButton
        as={Button}
        variant="ghost"
        rounded="full"
        minH="44px"
        px={2}
        aria-label="Account menu"
      >
        <HStack spacing={2}>
          <Avatar
            size="sm"
            name={account.initials}
            getInitials={() => account.initials}
            bgGradient="linear(to-br, purple.500, pink.500)"
            color="white"
          />
          <Text display={{ base: 'none', md: 'inline' }} fontWeight="medium" fontSize="sm">
            {account.firstName}
          </Text>
        </HStack>
      </MenuButton>
      <MenuList rounded="xl" shadow="xl" py={2}>
        <Box px={4} py={2}>
          <Text fontWeight="semibold" noOfLines={1}>
            {account.name}
          </Text>
          <Text fontSize="sm" color="gray.500" noOfLines={1}>
            {account.email}
          </Text>
        </Box>
        <MenuDivider />
        <MenuItem as={RouterLink} to="/profile" minH="44px">
          Profile
        </MenuItem>
        <MenuItem as={RouterLink} to="/settings" minH="44px">
          Settings
        </MenuItem>
        <MenuDivider />
        <MenuItem
          minH="44px"
          color="red.600"
          fontWeight="semibold"
          icon={<SignOutIcon boxSize={4} />}
          isDisabled={isSigningOut}
          onClick={onSignOut}
          _hover={{ bg: 'red.50' }}
          _focus={{ bg: 'red.50' }}
        >
          Sign out
        </MenuItem>
      </MenuList>
    </Menu>
  );
}
