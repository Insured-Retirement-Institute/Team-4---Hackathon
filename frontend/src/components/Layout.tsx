import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useWidgetSync } from '../hooks/useWidgetSync';

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  // Bridge widget.js events (iri:field_updated, etc.) into ApplicationContext
  useWidgetSync();

  // Hide the floating assistant widget on App Builder routes.
  useEffect(() => {
    const onAppBuilderRoute = location.pathname.startsWith('/app-builder');
    const applyWidgetVisibility = () => {
      const widgetHost = document.getElementById('iri-chat-widget');
      if (!widgetHost) return;
      widgetHost.style.display = onAppBuilderRoute ? 'none' : '';
    };

    applyWidgetVisibility();
    const observer = new MutationObserver(() => applyWidgetVisibility());
    observer.observe(document.body, { childList: true, subtree: true });

    if (onAppBuilderRoute) {
      const instance = window.IRIChat?._instance as ({ _closePanel?: () => void } | undefined);
      instance?._closePanel?.();
    }

    return () => observer.disconnect();
  }, [location.pathname]);

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'AI Experience', path: '/ai-experience' },
    { label: 'Applications', path: '/applications' },
    { label: 'New Application', path: '/wizard-v2' },
    { label: 'App Builder', path: '/app-builder' },
  ];

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleNavigate = (path: string) => {
    navigate(path);
    handleClose();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={4}
        sx={{
          top: 0,
          zIndex: 'appBar',
          bgcolor: 'rgba(18, 20, 36, 0.97)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Toolbar variant="dense">
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, cursor: 'pointer' }} onClick={() => navigate('/')}>
            Talk Annuity To Me
          </Typography>

          {/* ── Desktop: inline nav buttons ─────────────────────────── */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5 }}>
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Button
                  key={item.path}
                  color="inherit"
                  onClick={() => navigate(item.path)}
                  sx={{
                    fontWeight: active ? 700 : 400,
                    opacity: active ? 1 : 0.8,
                    borderBottom: active ? '2px solid white' : '2px solid transparent',
                    borderRadius: 0,
                    px: 1.5,
                    '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Box>

          {/* ── Mobile: hamburger ────────────────────────────────────── */}
          <IconButton
            color="inherit"
            onClick={handleOpen}
            size="small"
            sx={{ display: { xs: 'flex', md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            slotProps={{ paper: { sx: { minWidth: 200, mt: 0.5 } } }}
          >
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <MenuItem
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  selected={active}
                >
                  <Typography variant="body2" sx={{ fontWeight: active ? 600 : 400 }}>
                    {item.label}
                  </Typography>
                </MenuItem>
              );
            })}
          </Menu>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Push content below the fixed AppBar */}
        <Box sx={{ height: 48 }} />
        <Outlet />
      </Box>
    </Box>
  );
}

export default Layout;
