import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Badge from '@mui/material/Badge';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { useApplication } from '../context/ApplicationContext';
import { useWidgetSync } from '../hooks/useWidgetSync';
import { countInProgress } from '../services/applicationStorageService';

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { collectedFields } = useApplication();
  const inProgressCount = countInProgress();

  // Bridge widget.js events (iri:field_updated, etc.) into ApplicationContext
  useWidgetSync();

  const fieldCount = Object.keys(collectedFields).length;

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Applications', path: '/applications', badge: inProgressCount },
    { label: 'New Application', path: '/wizard-v2', badge: fieldCount },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Annuity E-Application
          </Typography>
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            const btn = (
              <Button
                key={item.path}
                color="inherit"
                onClick={() => navigate(item.path)}
                variant={active ? 'contained' : 'outlined'}
                size="small"
                disableElevation
                sx={{
                  ml: 1,
                  borderColor: active ? 'transparent' : 'rgba(255,255,255,0.5)',
                  bgcolor: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
                }}
              >
                {item.label}
              </Button>
            );

            if (item.badge) {
              return (
                <Badge key={item.path} badgeContent={item.badge} color="secondary" max={999}>
                  {btn}
                </Badge>
              );
            }

            return btn;
          })}
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </Box>
    </Box>
  );
}

export default Layout;
