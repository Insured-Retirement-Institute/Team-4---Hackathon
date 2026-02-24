import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import InputAdornment from '@mui/material/InputAdornment';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { QuestionDefinition } from './applicationDefinition';
import { useWizardV2Controller } from './formController';

interface WizardFieldProps {
  question: QuestionDefinition;
}

function WizardField({ question }: WizardFieldProps) {
  const { values, errors, setValue } = useWizardV2Controller();
  const value = values[question.id];
  const error = errors[question.id];

  const labelWithHint = (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Typography variant="body2" component="span" fontWeight="medium" color="text.primary">
        {question.label}
      </Typography>
      {question.hint && (
        <Tooltip title={question.hint}>
          <IconButton aria-label={`${question.label} hint`} size="small" sx={{ p: 0.25 }}>
            <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );

  if (question.type === 'boolean') {
    return (
      <FormControl error={Boolean(error)}>
        <FormLabel sx={{ mb: 1 }}>{labelWithHint}</FormLabel>
        <FormControlLabel
          control={
            <Switch
              checked={Boolean(value)}
              onChange={(event) => setValue(question.id, event.target.checked)}
              color="success"
            />
          }
          label={Boolean(value) ? 'Yes' : 'No'}
        />
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }

  if (question.type === 'radio') {
    return (
      <FormControl error={Boolean(error)}>
        <FormLabel sx={{ mb: 1 }}>{labelWithHint}</FormLabel>
        <RadioGroup
          row={(question.options?.length ?? 0) <= 4}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => setValue(question.id, event.target.value)}
        >
          {question.options?.map((option) => (
            <FormControlLabel
              key={option.value}
              value={option.value}
              control={<Radio color="success" />}
              label={option.label}
            />
          ))}
        </RadioGroup>
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }

  if (question.type === 'select') {
    return (
      <TextField
        select
        label={question.label}
        required={question.required}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => setValue(question.id, event.target.value)}
        error={Boolean(error)}
        helperText={error}
        fullWidth
      >
        <MenuItem value="">Select</MenuItem>
        {question.options?.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  return (
    <TextField
      label={question.label}
      required={question.required}
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => setValue(question.id, event.target.value)}
      error={Boolean(error)}
      helperText={error}
      fullWidth
      multiline={question.type === 'long_text'}
      minRows={question.type === 'long_text' ? 3 : undefined}
      type={question.type === 'date' ? 'date' : question.type === 'email' ? 'email' : 'text'}
      placeholder={question.placeholder}
      slotProps={{
        inputLabel: {
          shrink: question.type === 'date' ? true : undefined,
        },
        input: {
          startAdornment:
            question.type === 'currency' ? <InputAdornment position="start">$</InputAdornment> : undefined,
          inputMode:
            question.type === 'number' || question.type === 'currency' || question.type === 'phone' ? 'numeric' : undefined,
        },
      }}
    />
  );
}

export default WizardField;
