import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            MUI App
          </Typography>
          <Button
            color="inherit"
            onClick={() => navigate('/')}
            sx={{
              fontWeight: location.pathname === '/' ? 'bold' : 'normal',
            }}
          >
            Home
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/about')}
            sx={{
              fontWeight: location.pathname === '/about' ? 'bold' : 'normal',
            }}
          >
            About
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/wizard-v1')}
            variant="outlined"
            size="small"
            sx={{ ml: 1, borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white' } }}
          >
            Annuity Application
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/wizard-v2')}
            variant="outlined"
            size="small"
            sx={{ ml: 1, borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white' } }}
          >
            Green Wizard
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4, flex: 1 }}>
        <Outlet />
      </Container>
    </Box>
  );
}

export default Layout;
