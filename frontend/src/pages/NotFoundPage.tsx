import { useNavigate } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Stack spacing={2} sx={{ textAlign: 'center', mt: 8 }}>
      <Typography variant="h3" component="h1">
        404
      </Typography>
      <Typography variant="body1" color="text.secondary">
        The page you are looking for does not exist.
      </Typography>
      <div>
        <Button variant="contained" onClick={() => navigate('/')}>
          Go Home
        </Button>
      </div>
    </Stack>
  );
}

export default NotFoundPage;
