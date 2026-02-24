import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';

const items = [
  { id: 1, title: 'Getting Started', description: 'Learn the basics of React and MUI to build modern web applications.' },
  { id: 2, title: 'Components', description: 'Explore the rich set of pre-built MUI components for rapid development.' },
  { id: 3, title: 'Theming', description: 'Customize the look and feel of your app with the MUI theme system.' },
  { id: 4, title: 'Responsive Design', description: 'Build layouts that work seamlessly across all screen sizes.' },
  { id: 5, title: 'Accessibility', description: 'Create inclusive apps with built-in accessibility features.' },
  { id: 6, title: 'Performance', description: 'Optimize your app with tree-shaking, lazy loading, and more.' },
];

function HomePage() {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Welcome
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        A React + MUI starter project scaffolded with Vite and TypeScript.
      </Typography>
      <Grid container spacing={3}>
        {items.map((item) => (
          <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" component="h2" gutterBottom>
                  {item.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default HomePage;
