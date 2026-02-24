import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'AI Assistant', path: '/ai-chat' },
    { label: 'New Application', path: '/wizard-v2' },
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
            return (
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
