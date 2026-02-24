import { createTheme } from '@mui/material/styles';
import { green } from '@mui/material/colors';

const theme = createTheme({
  palette: {
    primary: {
      main: green[700],
      dark: green[900],
      light: green[500],
      contrastText: '#fff',
    },
    secondary: {
      main: green[600],
    },
    success: {
      main: green[600],
    },
    background: {
      default: green[50],
      paper: '#fff',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
});

export default theme;
