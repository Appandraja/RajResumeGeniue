import { Box } from '@chakra-ui/react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';

/** Layout route for authenticated pages: global header above the routed page. */
export function AppLayout() {
  return (
    <Box minH="100vh">
      <AppHeader />
      {/* Pages wrap themselves in PageWrapper (min-height 100vh); trim that by the header height. */}
      <Box as="main" sx={{ '& > *': { minH: 'calc(100vh - 64px)' } }}>
        <Outlet />
      </Box>
    </Box>
  );
}
