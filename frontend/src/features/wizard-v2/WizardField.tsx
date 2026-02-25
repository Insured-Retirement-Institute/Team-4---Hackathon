import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
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

function formatPhoneInput(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
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

  const renderPrimitiveField = (
    field: QuestionDefinition,
    fieldValue: string | boolean,
    onChange: (nextValue: string | boolean) => void,
    fieldError?: string,
  ) => {
    if (field.type === 'boolean') {
      return (
        <FormControl error={Boolean(fieldError)}>
          <FormLabel sx={{ mb: 1 }}>
            <Typography variant="body2" component="span" fontWeight="medium" color="text.primary">
              {field.label}
            </Typography>
          </FormLabel>
          <FormControlLabel
            control={<Switch checked={Boolean(fieldValue)} onChange={(event) => onChange(event.target.checked)} color="secondary" />}
            label={Boolean(fieldValue) ? 'Yes' : 'No'}
          />
          {fieldError && <FormHelperText>{fieldError}</FormHelperText>}
        </FormControl>
      );
    }

    if (field.type === 'radio') {
      if ((field.options?.length ?? 0) > 2) {
        return (
          <TextField
            select
            label={field.label}
            required={field.required}
            value={typeof fieldValue === 'string' ? fieldValue : ''}
            onChange={(event) => onChange(event.target.value)}
            error={Boolean(fieldError)}
            helperText={fieldError}
            fullWidth
          >
            <MenuItem value="">Select</MenuItem>
            {field.options?.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        );
      }

      return (
        <FormControl error={Boolean(fieldError)}>
          <FormLabel sx={{ mb: 1 }}>
            <Typography variant="body2" component="span" fontWeight="medium" color="text.primary">
              {field.label}
            </Typography>
          </FormLabel>
          <RadioGroup row={(field.options?.length ?? 0) <= 4} value={typeof fieldValue === 'string' ? fieldValue : ''} onChange={(event) => onChange(event.target.value)}>
            {field.options?.map((option) => (
              <FormControlLabel key={option.value} value={option.value} control={<Radio color="secondary" />} label={option.label} />
            ))}
          </RadioGroup>
          {fieldError && <FormHelperText>{fieldError}</FormHelperText>}
        </FormControl>
      );
    }

    if (field.type === 'select') {
      return (
        <TextField
          select
          label={field.label}
          required={field.required}
          value={typeof fieldValue === 'string' ? fieldValue : ''}
          onChange={(event) => onChange(event.target.value)}
          error={Boolean(fieldError)}
          helperText={fieldError}
          fullWidth
        >
          <MenuItem value="">Select</MenuItem>
          {field.options?.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      );
    }

    return (
        <TextField
          label={field.label}
          required={field.required}
          value={typeof fieldValue === 'string' ? fieldValue : ''}
          onChange={(event) =>
            onChange(field.type === 'phone' ? formatPhoneInput(event.target.value) : event.target.value)
          }
          error={Boolean(fieldError)}
          helperText={fieldError}
          fullWidth
        multiline={field.type === 'long_text'}
        minRows={field.type === 'long_text' ? 3 : undefined}
        type={field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
        placeholder={field.placeholder}
        slotProps={{
          inputLabel: {
            shrink: field.type === 'date' ? true : undefined,
          },
          input: {
            startAdornment: field.type === 'currency' ? <InputAdornment position="start">$</InputAdornment> : undefined,
            inputMode: field.type === 'number' || field.type === 'currency' || field.type === 'phone' ? 'numeric' : undefined,
          },
        }}
      />
    );
  };

  if (question.type === 'allocation_table') {
    const allocations = Array.isArray(value)
      ? value.map((item) => ({
          fundId: typeof item.fundId === 'string' ? item.fundId : '',
          percentage: typeof item.percentage === 'string' ? item.percentage : '',
        }))
      : [];
    const funds = question.allocationConfig?.funds ?? [];
    const minPerFund = question.allocationConfig?.minPerFund ?? 0;
    const maxPerFund = question.allocationConfig?.maxPerFund ?? 100;
    const requiredTotal = question.allocationConfig?.totalRequired ?? 100;
    const total = allocations.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0);

    const updateAllocation = (index: number, field: 'fundId' | 'percentage', nextValue: string) => {
      const next = [...allocations];
      const current = next[index] ?? { fundId: '', percentage: '' };
      next[index] = { ...current, [field]: nextValue };
      setValue(question.id, next);
    };

    const addAllocation = () => {
      setValue(question.id, [...allocations, { fundId: '', percentage: '' }]);
    };

    const removeAllocation = (index: number) => {
      setValue(
        question.id,
        allocations.filter((_, itemIndex) => itemIndex !== index),
      );
    };

    return (
      <FormControl error={Boolean(error)} fullWidth>
        <FormLabel sx={{ mb: 1 }}>{labelWithHint}</FormLabel>

        <Stack spacing={2}>
          {allocations.map((item, index) => {
            const selectedFundIds = allocations
              .map((allocation, allocationIndex) => (allocationIndex === index ? null : allocation.fundId))
              .filter((fundId): fundId is string => Boolean(fundId));

            const availableFunds = funds.filter((fund) => !selectedFundIds.includes(fund.id) || fund.id === item.fundId);

            return (
              <Paper key={`${question.id}-${index}`} variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                  <TextField
                    select
                    label="Fund"
                    value={item.fundId}
                    onChange={(event) => updateAllocation(index, 'fundId', event.target.value)}
                    fullWidth
                  >
                    <MenuItem value="">Select fund</MenuItem>
                    {availableFunds.map((fund) => (
                      <MenuItem key={fund.id} value={fund.id}>
                        {fund.name}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    label="Allocation %"
                    value={item.percentage}
                    onChange={(event) => updateAllocation(index, 'percentage', event.target.value)}
                    type="number"
                    slotProps={{
                      htmlInput: {
                        min: minPerFund,
                        max: maxPerFund,
                        step: 1,
                      },
                    }}
                    sx={{ width: { xs: '100%', sm: 160 } }}
                  />

                  <Button color="inherit" onClick={() => removeAllocation(index)}>
                    Remove
                  </Button>
                </Stack>
              </Paper>
            );
          })}

          <Box>
            <Button variant="outlined" color="secondary" onClick={addAllocation}>
              Add Allocation
            </Button>
            <Typography
              variant="caption"
              color={total === requiredTotal ? 'text.secondary' : 'error.main'}
              sx={{ display: 'block', mt: 0.75 }}
            >
              Total Allocation: {total}% / {requiredTotal}%
            </Typography>
          </Box>
        </Stack>

        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }

  if (question.type === 'repeatable_group' && question.groupConfig) {
    const items = Array.isArray(value) ? value : [];
    const { fields, minItems, maxItems, addLabel } = question.groupConfig;

    const createEmptyItem = () =>
      fields.reduce<Record<string, string | boolean>>((acc, field) => {
        acc[field.id] = field.type === 'boolean' ? false : '';
        return acc;
      }, {});

    const updateItemField = (index: number, fieldId: string, nextValue: string | boolean) => {
      const nextItems = [...items];
      const current = nextItems[index] ?? createEmptyItem();
      nextItems[index] = { ...current, [fieldId]: nextValue };
      setValue(question.id, nextItems);
    };

    const handleAddItem = () => {
      if (items.length >= maxItems) return;
      setValue(question.id, [...items, createEmptyItem()]);
    };

    const handleRemoveItem = (index: number) => {
      if (items.length <= Math.max(1, minItems)) return;
      setValue(
        question.id,
        items.filter((_, itemIndex) => itemIndex !== index),
      );
    };

    return (
      <FormControl error={Boolean(error)} fullWidth>
        <FormLabel sx={{ mb: 1 }}>{labelWithHint}</FormLabel>

        <Stack spacing={2}>
          {items.map((item, index) => (
            <Paper key={`${question.id}-${index}`} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" color="text.primary">
                  {question.label} #{index + 1}
                </Typography>
                {items.length > Math.max(1, minItems) && (
                  <Button size="small" color="inherit" onClick={() => handleRemoveItem(index)}>
                    Remove
                  </Button>
                )}
              </Stack>

              <Divider sx={{ mb: 2 }} />

              <Grid container spacing={2}>
                {fields.map((field) => (
                  <Grid key={`${question.id}-${index}-${field.id}`} size={{ xs: 12, md: field.type === 'long_text' ? 12 : 6 }}>
                    {renderPrimitiveField(field, item[field.id] ?? (field.type === 'boolean' ? false : ''), (nextValue) =>
                      updateItemField(index, field.id, nextValue),
                    )}
                  </Grid>
                ))}
              </Grid>
            </Paper>
          ))}

          <Box>
            <Button variant="outlined" color="secondary" onClick={handleAddItem} disabled={items.length >= maxItems}>
              {addLabel || `Add ${question.label}`}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
              {items.length} of {maxItems} items
            </Typography>
          </Box>
        </Stack>
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }

  if (question.type === 'boolean') {
    return (
      <FormControl error={Boolean(error)}>
        <FormLabel sx={{ mb: 1 }}>{labelWithHint}</FormLabel>
        <FormControlLabel
          control={
            <Switch
              checked={Boolean(value)}
              onChange={(event) => setValue(question.id, event.target.checked)}
              color="secondary"
            />
          }
          label={Boolean(value) ? 'Yes' : 'No'}
        />
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }

  if (question.type === 'radio') {
    if ((question.options?.length ?? 0) > 2) {
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
              control={<Radio color="secondary" />}
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
    renderPrimitiveField(question, typeof value === 'string' || typeof value === 'boolean' ? value : '', (nextValue) =>
      setValue(question.id, nextValue),
      error,
    )
  );
}

export default WizardField;
