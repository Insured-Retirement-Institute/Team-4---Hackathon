import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@mui/material/AppBar';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useApplication } from '../context/ApplicationContext';
import { useWidgetSync } from '../hooks/useWidgetSync';
import { countInProgress } from '../services/applicationStorageService';

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { collectedFields } = useApplication();
  const inProgressCount = countInProgress();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Bridge widget.js events (iri:field_updated, etc.) into ApplicationContext
  useWidgetSync();

  const fieldCount = Object.keys(collectedFields).length;

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'AI Experience', path: '/ai-experience' },
    { label: 'Applications', path: '/applications', badge: inProgressCount },
    { label: 'New Application', path: '/wizard-v2', badge: fieldCount },
    { label: 'Settings', path: '/settings' },
  ];

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleNavigate = (path: string) => {
    navigate(path);
    handleClose();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="sticky" sx={{ top: 0, zIndex: 'appBar' }}>
        <Toolbar variant="dense">
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Annuity E-Application
          </Typography>

          {/* ── Desktop: inline nav buttons ─────────────────────────── */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5 }}>
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              const btn = (
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

              return (item.badge ?? 0) > 0 ? (
                <Badge key={item.path} badgeContent={item.badge} color="secondary" max={99}>
                  {btn}
                </Badge>
              ) : btn;
            })}
          </Box>

          {/* ── Mobile: hamburger ────────────────────────────────────── */}
          <IconButton
            color="inherit"
            onClick={handleOpen}
            size="small"
            sx={{ display: { xs: 'flex', md: 'none' } }}
          >
            <Badge
              badgeContent={(inProgressCount || 0) + (fieldCount || 0)}
              color="secondary"
              max={99}
            >
              <MenuIcon />
            </Badge>
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
                  sx={{ gap: 1.5 }}
                >
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: active ? 600 : 400 }}>
                    {item.label}
                  </Typography>
                  {(item.badge ?? 0) > 0 && (
                    <Chip
                      label={item.badge}
                      size="small"
                      color="secondary"
                      sx={{ height: 20, fontSize: 11, minWidth: 28 }}
                    />
                  )}
                </MenuItem>
              );
            })}
          </Menu>
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </Box>
    </Box>
  );
}

export default Layout;
