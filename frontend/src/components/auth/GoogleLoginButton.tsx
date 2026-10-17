import { Button } from '@chakra-ui/react';
import { Browser } from '@capacitor/browser';
import { isNativeApp } from '../../lib/platform';
import { googleLoginUrl } from '../../services/authService';
import { GoogleGIcon } from '../ui/icons';

interface GoogleLoginButtonProps {
  label?: string;
}

export function GoogleLoginButton({ label = 'Continue with Google' }: GoogleLoginButtonProps) {
  const handleClick = (): void => {
    const url = googleLoginUrl();
    if (isNativeApp()) {
      // Google blocks OAuth inside embedded WebViews: use the system browser (Custom Tabs).
      // The backend returns to the app through the rajresumegenie:// deep link.
      void Browser.open({ url });
      return;
    }
    window.location.assign(url);
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      variant="outline"
      colorScheme="gray"
      w="full"
      size="lg"
      minH={12}
      rounded="full"
      bg="white"
      borderColor="gray.300"
      fontWeight="semibold"
      leftIcon={<GoogleGIcon boxSize={5} />}
      _hover={{ bg: 'gray.50' }}
    >
      {label}
    </Button>
  );
}
