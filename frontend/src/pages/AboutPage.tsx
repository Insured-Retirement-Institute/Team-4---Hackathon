import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

function AboutPage() {
  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1" gutterBottom>
        About
      </Typography>
      <Typography variant="body1">
        This project demonstrates a React application built with Material UI,
        TypeScript, and Vite. It follows the MUI design system guidelines for
        consistent, accessible, and responsive user interfaces.
      </Typography>
      <Typography variant="h5" component="h2" gutterBottom>
        Tech Stack
      </Typography>
      <Typography variant="body1" component="ul" sx={{ pl: 3 }}>
        <li>React 18+ with TypeScript</li>
        <li>Material UI (MUI) v7</li>
        <li>React Router v6</li>
        <li>Vite for fast development and builds</li>
        <li>Emotion for CSS-in-JS styling</li>
      </Typography>
      <Typography variant="h5" component="h2" gutterBottom>
        Design Principles
      </Typography>
      <Typography variant="body1">
        The application uses MUI layout components for structure, the sx prop for
        styling, theme palette colors instead of hardcoded values, and follows
        accessibility best practices throughout.
      </Typography>
    </Stack>
  );
}

export default AboutPage;
