# Wizard Workflow

## Flow
1. `/wizard-v2` → `ProductSelectionPage` — fetches `GET /products`, user picks a product, navigates to `/wizard-v2/:productId`
2. `/wizard-v2/:productId` → `WizardPageV2` — reads `:productId` from route params, fetches `GET /application/:productId` to get an `ApplicationDefinition`, then renders the dynamic form wizard

## Key Files
- `src/pages/ProductSelectionPage.tsx` — product picker; navigates on selection, does NOT prefetch the application definition
- `src/features/wizard-v2/WizardPage.tsx` — outer shell fetches the definition; inner `WizardPageContent` drives the step-by-step wizard UI
- `src/features/wizard-v2/formController.tsx` — React context provider; accepts `definition: ApplicationDefinition` as a prop; owns all form values, errors, validation, and dummy-data population
- `src/features/wizard-v2/WizardField.tsx` — renders any `QuestionDefinition` dynamically; already fully generic, no product-specific logic
- `src/features/wizard-v2/WizardSidebar.tsx` — step navigation sidebar; driven by `pages[]`, `productName`, and `carrier` props
- `src/types/application.ts` — canonical types: `ApplicationDefinition`, `PageDefinition`, `QuestionDefinition`, `AnswerMap`
- `src/services/applicationService.ts` — `getProducts()`, `getApplication(productId)`, `validateApplication()`, `submitApplication()`

## ApplicationDefinition Shape
Pages → Questions → `QuestionDefinition` (id, label, type, options, groupConfig, allocationConfig, …).
All question types are handled in `WizardField.tsx`: `short_text`, `long_text`, `number`, `currency`, `date`, `boolean`, `select`, `radio`, `phone`, `email`, `ssn`, `signature`, `repeatable_group`, `allocation_table`.

---

# MUI + React Design System Guidelines

Use this file to provide the AI with rules and guidelines to follow when generating React code with Material UI (MUI).

> **TIP:** These guidelines are optimized for MUI v7+ with React 18+. Focus on the most critical rules for consistent, maintainable output.

---

# General Guidelines

## Code Organization
* Keep components small and focused—each component should do one thing well
* Use TypeScript for type safety when possible
* Prefer functional components with React hooks over class components
* Extract reusable logic into custom hooks
* Keep file sizes manageable; split large components into smaller ones

## Layout Approach
* Use MUI's layout components (`Box`, `Stack`, `Grid`, `Container`) instead of raw CSS
* Prefer `Stack` for one-dimensional layouts (vertical or horizontal)
* Use `Grid` for two-dimensional responsive layouts
* Avoid absolute positioning—use flexbox and grid for responsive layouts
* Always consider mobile-first responsive design

## Styling Strategy
* Use the `sx` prop for component-specific styling (preferred for one-off styles)
* Use `styled()` utility for reusable styled components
* Access theme values through the `sx` prop: `sx={{ color: 'primary.main', p: 2 }}`
* Never use inline styles directly; always use `sx` or `styled()`
* Avoid `!important`—use specificity through proper MUI styling patterns

---

# Design System Guidelines

## Theme & Colors

### Palette Usage
* Always use theme palette colors, never hardcode hex values
* Primary actions: `color="primary"` or `sx={{ color: 'primary.main' }}`
* Secondary actions: `color="secondary"`
* Semantic colors: `error`, `warning`, `info`, `success`
* Text colors: `text.primary`, `text.secondary`, `text.disabled`
* Background colors: `background.paper`, `background.default`

### Color Prop Values
```jsx
// ✅ Correct
<Button color="primary">Submit</Button>
<Typography color="text.secondary">Helper text</Typography>
<Box sx={{ bgcolor: 'background.paper' }}>Content</Box>

// ❌ Avoid
<Button sx={{ backgroundColor: '#1976d2' }}>Submit</Button>
```

---

## Typography

### Variant Usage
| Variant | Use Case | HTML Element |
|---------|----------|--------------|
| `h1`–`h6` | Page/section headings | `<h1>`–`<h6>` |
| `subtitle1`, `subtitle2` | Subheadings | `<h6>` |
| `body1` | Primary body text (16px) | `<p>` |
| `body2` | Secondary body text (14px) | `<p>` |
| `caption` | Small helper text | `<span>` |
| `overline` | Labels, categories | `<span>` |
| `button` | Button text | `<span>` |

### Typography Rules
* Always use the `Typography` component for text—never raw HTML tags
* Use `variant` prop to set the visual style
* Use `component` prop to override the semantic HTML element when needed
* Use `gutterBottom` sparingly for spacing below headings
* Use `noWrap` with `textOverflow: 'ellipsis'` for truncating long text

```jsx
// Heading styled as h1 but rendered as h2 for SEO
<Typography variant="h1" component="h2">Page Title</Typography>

// Body text with bottom margin
<Typography variant="body1" gutterBottom>Paragraph text</Typography>
```

---

## Spacing

### Spacing Scale
MUI uses an 8px base unit by default. Always use theme spacing values:

| Value | Pixels |
|-------|--------|
| `0.5` | 4px |
| `1` | 8px |
| `2` | 16px |
| `3` | 24px |
| `4` | 32px |
| `5` | 40px |
| `6` | 48px |

### Spacing Props
* `m` = margin, `p` = padding
* `t` = top, `b` = bottom, `l` = left, `r` = right
* `x` = horizontal (left + right), `y` = vertical (top + bottom)

```jsx
<Box sx={{ p: 2, mt: 3, mx: 'auto' }}>
  {/* padding: 16px, margin-top: 24px, horizontal margin: auto */}
</Box>
```

---

## Grid System

### Breakpoints
| Key | Min-Width | Device |
|-----|-----------|--------|
| `xs` | 0px | Mobile |
| `sm` | 600px | Tablet |
| `md` | 900px | Small laptop |
| `lg` | 1200px | Desktop |
| `xl` | 1536px | Large screen |

### Grid v2 Usage (MUI v7+)
```jsx
<Grid container spacing={2}>
  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
    <Item>Content</Item>
  </Grid>
  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
    <Item>Content</Item>
  </Grid>
  <Grid size={{ xs: 12, sm: 12, md: 4 }}>
    <Item>Content</Item>
  </Grid>
</Grid>
```

### Grid Rules
* Always set `container` on the parent Grid
* Use `spacing` prop for gaps between items (uses theme spacing units)
* Use `size` prop with breakpoint objects for responsive column widths
* Column values should total 12 per row for a full-width layout
* Use `size="grow"` for auto-expanding items
* Use `size="auto"` for content-based sizing

---

## Components

### Button
**Variants:**
| Variant | Use Case |
|---------|----------|
| `contained` | Primary actions, high emphasis |
| `outlined` | Secondary actions, medium emphasis |
| `text` | Tertiary actions, low emphasis (dialogs, cards) |

**Sizes:** `small`, `medium` (default), `large`

**Rules:**
* Use `contained` for the primary action on a page/form
* Use `outlined` for secondary actions
* Use `text` for less important actions in cards or dialogs
* Add `startIcon` or `endIcon` for icon buttons
* Use `disabled` prop, not CSS, to disable buttons
* Use `disableElevation` for flat contained buttons

```jsx
<Button variant="contained" startIcon={<SaveIcon />}>
  Save Changes
</Button>
<Button variant="outlined" color="secondary">
  Cancel
</Button>
```

### TextField
**Variants:** `outlined` (default), `filled`, `standard`

**Rules:**
* Prefer `outlined` variant for most forms
* Always provide a `label` prop for accessibility
* Use `helperText` for guidance or error messages
* Use `error` prop with `helperText` for validation errors
* Use `required` prop for mandatory fields
* Use `fullWidth` for form fields that should span container width
* Provide unique `id` props for accessibility

```jsx
<TextField
  id="email"
  label="Email Address"
  variant="outlined"
  required
  fullWidth
  error={!!errors.email}
  helperText={errors.email || "We'll never share your email"}
/>
```

### Card
**Structure:**
```jsx
<Card>
  <CardMedia
    component="img"
    height="140"
    image="/image.jpg"
    alt="Description"
  />
  <CardContent>
    <Typography variant="h5" component="h2">
      Card Title
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Card description text goes here.
    </Typography>
  </CardContent>
  <CardActions>
    <Button size="small">Learn More</Button>
  </CardActions>
</Card>
```

### Dialog
**Rules:**
* Always include proper ARIA labels
* Trap focus within the dialog when open
* Include a close mechanism (button or click-away)
* Use `maxWidth` prop to control dialog width

```jsx
<Dialog
  open={open}
  onClose={handleClose}
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
  maxWidth="sm"
  fullWidth
>
  <DialogTitle id="dialog-title">Confirm Action</DialogTitle>
  <DialogContent>
    <DialogContentText id="dialog-description">
      Are you sure you want to proceed?
    </DialogContentText>
  </DialogContent>
  <DialogActions>
    <Button onClick={handleClose}>Cancel</Button>
    <Button onClick={handleConfirm} variant="contained">
      Confirm
    </Button>
  </DialogActions>
</Dialog>
```

### Table
**Rules:**
* Use `TableContainer` with `Paper` for elevated tables
* Include proper `<thead>` structure with `TableHead`
* Use `TableSortLabel` for sortable columns
* Consider `TablePagination` for large datasets
* Use `stickyHeader` for tables with many rows

```jsx
<TableContainer component={Paper}>
  <Table stickyHeader aria-label="data table">
    <TableHead>
      <TableRow>
        <TableCell>Name</TableCell>
        <TableCell align="right">Value</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {rows.map((row) => (
        <TableRow key={row.id} hover>
          <TableCell>{row.name}</TableCell>
          <TableCell align="right">{row.value}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
```

---

## Icons

### Import Method
Always import icons individually for optimal bundle size:

```jsx
// ✅ Correct - tree-shakeable
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';

// ❌ Avoid - imports entire icon library
import { Delete, Edit } from '@mui/icons-material';
```

### Icon Themes
| Theme | Suffix | Example |
|-------|--------|---------|
| Filled | (none) | `Delete` |
| Outlined | `Outlined` | `DeleteOutlined` |
| Rounded | `Rounded` | `DeleteRounded` |
| Two-tone | `TwoTone` | `DeleteTwoTone` |
| Sharp | `Sharp` | `DeleteSharp` |

### Icon Usage Rules
* Maintain consistent icon theme throughout the app
* Use `IconButton` for clickable icons
* Always provide `aria-label` for icon-only buttons
* Use `fontSize` prop (`small`, `medium`, `large`, `inherit`)
* Icons inherit parent text color by default

```jsx
<IconButton aria-label="delete item" color="error">
  <DeleteIcon />
</IconButton>

<Button startIcon={<SaveIcon />}>Save</Button>
```

---

## Accessibility

### Required Practices
* All form inputs must have associated labels (via `label` prop or `aria-label`)
* Icon-only buttons must have `aria-label`
* Dialogs must have `aria-labelledby` pointing to title
* Interactive elements must be keyboard navigable
* Ensure 4.5:1 color contrast ratio for text
* Use semantic HTML elements via `component` prop when needed

### TextField Accessibility
```jsx
<TextField
  id="username"
  label="Username"
  aria-describedby="username-helper"
  helperText="Enter your username"
  FormHelperTextProps={{ id: 'username-helper' }}
/>
```

### Icon Button Accessibility
```jsx
// ✅ Correct
<IconButton aria-label="Close dialog">
  <CloseIcon />
</IconButton>

// ❌ Avoid - no accessible name
<IconButton>
  <CloseIcon />
</IconButton>
```

---

## Responsive Design

### Responsive Props
Many MUI props accept responsive values:

```jsx
<Box
  sx={{
    display: 'flex',
    flexDirection: { xs: 'column', md: 'row' },
    gap: { xs: 1, sm: 2, md: 3 },
    p: { xs: 2, md: 4 },
  }}
>
  Content
</Box>
```

### Hide/Show by Breakpoint
```jsx
<Box sx={{ display: { xs: 'none', md: 'block' } }}>
  Desktop only content
</Box>

<Box sx={{ display: { xs: 'block', md: 'none' } }}>
  Mobile only content
</Box>
```

---

## Anti-Patterns to Avoid

### ❌ DON'T
* Hardcode colors, spacing, or font sizes
* Use inline styles (`style={{}}`)
* Skip accessibility attributes
* Nest typography components
* Use deprecated `classes` prop when `sx` works
* Import entire icon library
* Use `GridLegacy` (deprecated)—use `Grid` v2

### ✅ DO
* Use theme values for all design tokens
* Use `sx` prop for component styling
* Provide proper ARIA labels and attributes
* Use `Typography` variants consistently
* Use `styled()` for reusable styled components
* Import icons individually
* Use `Grid` v2 with `size` prop

---

## Common Patterns

### Form Layout
```jsx
<Box component="form" onSubmit={handleSubmit} noValidate>
  <Stack spacing={3}>
    <TextField label="Name" required fullWidth />
    <TextField label="Email" type="email" required fullWidth />
    <TextField
      label="Message"
      multiline
      rows={4}
      fullWidth
    />
    <Button type="submit" variant="contained" size="large">
      Submit
    </Button>
  </Stack>
</Box>
```

### Card Grid
```jsx
<Grid container spacing={3}>
  {items.map((item) => (
    <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
      <Card>
        <CardContent>
          <Typography variant="h6">{item.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {item.description}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  ))}
</Grid>
```

### Navigation AppBar
```jsx
<AppBar position="static">
  <Toolbar>
    <IconButton
      edge="start"
      color="inherit"
      aria-label="menu"
      sx={{ mr: 2 }}
    >
      <MenuIcon />
    </IconButton>
    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
      App Name
    </Typography>
    <Button color="inherit">Login</Button>
  </Toolbar>
</AppBar>
```

---

## Quick Reference

### Import Statements
```jsx
// Core components
import { Box, Stack, Grid, Container } from '@mui/material';
import { Typography, Button, TextField } from '@mui/material';
import { Card, CardContent, CardActions, CardMedia } from '@mui/material';
import { AppBar, Toolbar, IconButton } from '@mui/material';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

// Theming
import { ThemeProvider, createTheme, styled } from '@mui/material/styles';

// Icons (import individually)
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
```

### sx Prop Cheatsheet
```jsx
sx={{
  // Spacing
  m: 2,           // margin: 16px
  p: 2,           // padding: 16px
  mt: 2,          // margin-top: 16px
  px: 2,          // padding-left & right: 16px
  
  // Colors
  color: 'primary.main',
  bgcolor: 'background.paper',
  
  // Typography
  typography: 'body1',
  fontWeight: 'bold',
  
  // Layout
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  
  // Sizing
  width: '100%',
  maxWidth: 600,
  minHeight: 200,
  
  // Responsive
  width: { xs: '100%', md: '50%' },
  
  // Pseudo-selectors
  '&:hover': { bgcolor: 'action.hover' },
}}
```