import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

function DocusignReturnPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const event = new URLSearchParams(location.search).get("event");
  const isSuccess = event === "signing_complete";

  const message = isSuccess
    ? "Thanks! Your signature is complete."
    : "We received your response. You may now return to the application.";

  return (
    <Box
      sx={{
        minHeight: "65vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
      }}
    >
      <Paper elevation={3} sx={{ width: "100%", maxWidth: 560, p: { xs: 3, sm: 4 } }}>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Typography variant="h5" component="h1">
            {isSuccess ? "All set!" : "Thank you"}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {message}
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate("/wizard-v2")}
          >
            Start New Application
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export default DocusignReturnPage;