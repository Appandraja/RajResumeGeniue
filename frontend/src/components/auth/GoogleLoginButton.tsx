import { Button } from '@chakra-ui/react';
import { googleLoginUrl } from '../../services/authService';

interface GoogleLoginButtonProps {
  label?: string;
}

export function GoogleLoginButton({ label = 'Continue with Google' }: GoogleLoginButtonProps) {
  const handleClick = (): void => {
    window.location.assign(googleLoginUrl());
  };

  return (
    <Button type="button" onClick={handleClick} variant="outline" w="full" rounded="full" py={6} bg="white">
      {label}
    </Button>
  );
}
