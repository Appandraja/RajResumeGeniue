import type { ReactNode } from 'react';
import { Center, Spinner } from '@chakra-ui/react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  children?: ReactNode;
}

/** Works as a wrapper (`<ProtectedRoute><Page/></ProtectedRoute>`) or as a layout route. */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Center minH="100vh">
        <Spinner size="xl" color="purple.500" thickness="4px" label="Loading your session" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children ?? <Outlet />}</>;
}
