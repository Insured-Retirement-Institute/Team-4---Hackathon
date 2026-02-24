import { createTheme } from '@mui/material/styles';
import { grey, orange } from '@mui/material/colors';

const theme = createTheme({
  palette: {
    primary: {
      main: grey[700],
      dark: grey[900],
      light: grey[500],
      contrastText: '#fff',
    },
    secondary: {
      main: orange[500],
    },
    success: {
      main: orange[500],
    },
    background: {
      default: grey[100],
      paper: '#fff',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
});

export default theme;
