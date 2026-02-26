import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useApplication } from '../context/ApplicationContext';
import { createSession, type ToolCallInfo } from '../services/aiService';
import { getProducts, getApplication, type Product } from '../services/apiService';
import ChatPanel from '../components/ChatPanel';
import FieldMappingPanel, { type MatchedField } from '../components/FieldMappingPanel';
import RetellCallPanel from '../components/RetellCallPanel';
import type { ApplicationDefinition } from '../types/application';

const ADVISOR_NAME = 'Andrew Barnett';
const CLIENT_PHONE = '+17042076820';

const camelToSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

// Aliases mapping CRM field names → product question IDs where automatic
// camelCase/snake_case conversion doesn't produce the right name.
const FIELD_ALIASES: Record<string, string[]> = {
  owner_street_address: ['ownerResidentialAddress'],
  owner_address_street: ['ownerResidentialAddress'],
  owner_phone: ['ownerHomePhone', 'ownerDaytimePhone'],
  owner_ssn: ['ownerTaxId'],
  owner_ssn_tin: ['ownerTaxId'],
  owner_middle_initial: ['ownerMiddleName'],
  owner_date_of_birth: ['ownerDob'],
  owner_same_as_annuitant: ['isOwnerSameAsAnnuitant'],
  annuitant_street_address: ['annuitantResidentialAddress'],
  annuitant_phone: ['annuitantHomePhone', 'annuitantDaytimePhone'],
  annuitant_ssn: ['annuitantTaxId'],
  annuitant_middle_initial: ['annuitantMiddleName'],
  annuitant_us_citizen: ['annuitantCitizenship'],
  owner_citizenship_status: ['ownerCitizenship'],
  signed_at_state: ['signedState'],
};

export default function AIExperiencePage() {
  const navigate = useNavigate();
  const { mergeFields } = useApplication();

  // Core state
  const [sessionId, setLocalSessionId] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [definition, setDefinition] = useState<ApplicationDefinition | null>(null);
  const [gatheredFields, setGatheredFields] = useState<Map<string, { value: string; source: string }>>(new Map());
  const [matchedFields, setMatchedFields] = useState<MatchedField[]>([]);
  const [callActive, setCallActive] = useState(false);

  // Compute matched fields when gathered data or definition changes
  const computeMatchedFields = useCallback(
    (fields: Map<string, { value: string; source: string }>, def: ApplicationDefinition) => {
      console.log('[AIExperience] computeMatchedFields called with', fields.size, 'gathered fields');

      // Build lookup with camelCase, snake_case, AND explicit aliases
      // All keys are lowercased for case-insensitive matching since DynamoDB
      // may store question IDs in lowercase while CRM uses snake_case/camelCase.
      const lookup: Record<string, { value: string; source: string }> = {};
      const addKey = (key: string, v: { value: string; source: string }) => {
        lookup[key.toLowerCase()] = v;
      };
      for (const [k, v] of fields) {
        addKey(k, v);
        addKey(snakeToCamel(k), v);
        addKey(camelToSnake(k), v);
        // Apply field name aliases
        const aliases = FIELD_ALIASES[k] ?? FIELD_ALIASES[camelToSnake(k)];
        if (aliases) {
          for (const alias of aliases) {
            addKey(alias, v);
            addKey(camelToSnake(alias), v);
          }
        }
      }

      const allQuestions = def.pages.flatMap((p) =>
        p.questions.map((q) => ({ ...q, pageTitle: p.title })),
      );
      const matched: MatchedField[] = allQuestions.map((q) => {
        const qid = q.id.toLowerCase();
        const entry = lookup[qid];
        return {
          id: q.id,
          label: q.label,
          pageTitle: q.pageTitle,
          value: entry?.value ?? null,
          filled: qid in lookup,
          source: entry?.source,
        };
      });
      const filledCount = matched.filter((m) => m.filled).length;
      const lookupKeys = Object.keys(lookup);
      console.log('[AIExperience] Matched:', filledCount, '/', matched.length);
      console.log('[AIExperience] Lookup keys (' + lookupKeys.length + '):', lookupKeys.join(', '));
      console.log('[AIExperience] Question IDs (' + allQuestions.length + '):', allQuestions.slice(0, 20).map((q) => q.id).join(', '));
      setMatchedFields(matched);
    },
    [],
  );

  // On mount: load products + create session
  useEffect(() => {
    getProducts().then(setProducts).catch(console.error);

    createSession(undefined, undefined, ADVISOR_NAME)
      .then((session) => {
        setLocalSessionId(session.session_id);
        setGreeting(session.greeting || `Hi ${ADVISOR_NAME}! What client would you like to work on today?`);
      })
      .catch(console.error);
  }, []);

  // Merge tool call result data into gathered fields
  const mergeFieldsFromToolData = useCallback(
    (data: Record<string, unknown>, source: string) => {
      setGatheredFields((prev) => {
        const next = new Map(prev);
        for (const [key, val] of Object.entries(data)) {
          if (val != null && typeof val !== 'object' && String(val).trim()) {
            next.set(key, { value: String(val), source });
          }
        }
        return next;
      });
    },
    [],
  );

  // When gatheredFields or definition change, recompute matched fields
  useEffect(() => {
    console.log('[AIExperience] useEffect fired: gatheredFields.size=', gatheredFields.size, 'definition=', !!definition);
    if (definition) {
      computeMatchedFields(gatheredFields, definition);
    }
  }, [gatheredFields, definition, computeMatchedFields]);

  // Handle tool calls from chat
  const handleToolCalls = useCallback(
    (tools: ToolCallInfo[]) => {
      console.log('[AIExperience] handleToolCalls received:', tools.map((t) => ({
        name: t.name,
        hasResultData: !!t.result_data,
        resultDataKeys: t.result_data ? Object.keys(t.result_data).length : 0,
        sourceLabel: t.source_label,
      })));

      for (const tool of tools) {
        if (!tool.result_data || !tool.source_label) {
          console.log(`[AIExperience] Skipping ${tool.name}: result_data=${!!tool.result_data}, source_label=${tool.source_label}`);
          continue;
        }

        const data = tool.result_data;
        const source = tool.source_label;

        if (tool.name === 'lookup_family_members') {
          // Family members data may be nested in a family_members array
          const members = (data.family_members as Array<Record<string, unknown>>) ?? [];
          for (const member of members) {
            for (const [k, v] of Object.entries(member)) {
              if (v != null && typeof v !== 'object' && String(v).trim()) {
                setGatheredFields((prev) => {
                  const next = new Map(prev);
                  next.set(k, { value: String(v), source });
                  return next;
                });
              }
            }
          }
          // Also merge top-level fields
          const { family_members: _, ...rest } = data;
          if (Object.keys(rest).length > 0) {
            mergeFieldsFromToolData(rest as Record<string, unknown>, source);
          }
        } else if (tool.name === 'call_client') {
          // call_client doesn't return field data, it initiates a call
          // The call panel handles field extraction
        } else {
          // General case: merge all key-value pairs
          console.log(`[AIExperience] Merging ${Object.keys(data).length} fields from ${tool.name} (${source}):`, Object.keys(data));
          mergeFieldsFromToolData(data as Record<string, unknown>, source);
        }
      }
    },
    [mergeFieldsFromToolData],
  );

  // Product selection — just set definition, let useEffect handle matching
  const handleProductSelect = useCallback(
    (productId: string) => {
      setSelectedProductId(productId);
      getApplication(productId)
        .then((def) => {
          console.log('[AIExperience] Product definition loaded:', def.productName, '—', def.pages?.length, 'pages');
          setDefinition(def);
        })
        .catch(console.error);
    },
    [],
  );

  // Call client
  const handleCallClient = useCallback(() => {
    setCallActive(true);
  }, []);

  const handleCallFieldsExtracted = useCallback(
    (fields: Record<string, string>) => {
      setGatheredFields((prev) => {
        const next = new Map(prev);
        for (const [k, v] of Object.entries(fields)) {
          if (v != null && String(v).trim()) {
            next.set(k, { value: String(v), source: 'Client Call' });
          }
        }
        return next;
      });
    },
    [],
  );

  const handleCallComplete = useCallback(() => {
    setCallActive(false);
  }, []);

  // Launch wizard
  const handleLaunchWizard = useCallback(() => {
    if (!selectedProductId) return;
    // Normalize fields for wizard — include camelCase, aliases, AND lowercase
    // since DynamoDB may store question IDs in lowercase
    const normalized: Record<string, string> = {};
    for (const [k, entry] of gatheredFields) {
      const camel = snakeToCamel(k);
      normalized[camel] = entry.value;
      normalized[camel.toLowerCase()] = entry.value;
      normalized[k] = entry.value;
      // Also set aliased names so wizard fields get populated
      const aliases = FIELD_ALIASES[k] ?? FIELD_ALIASES[camelToSnake(k)];
      if (aliases) {
        for (const alias of aliases) {
          normalized[alias] = entry.value;
          normalized[alias.toLowerCase()] = entry.value;
        }
      }
    }
    mergeFields(normalized);
    navigate(`/wizard-v2/${encodeURIComponent(selectedProductId)}`, { state: { fromAIExperience: true } });
  }, [selectedProductId, gatheredFields, navigate, mergeFields]);

  const missingFields = matchedFields
    .filter((f) => !f.filled)
    .map((f) => ({ id: f.id, label: f.label }));

  // Get the client name from gathered fields for the call panel
  const clientName =
    gatheredFields.get('owner_first_name')?.value && gatheredFields.get('owner_last_name')?.value
      ? `${gatheredFields.get('owner_first_name')!.value} ${gatheredFields.get('owner_last_name')!.value}`
      : 'the client';

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ bgcolor: 'grey.900', color: 'white', py: 3, px: 3 }}>
        <Container maxWidth="xl">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <AutoAwesomeIcon color="secondary" />
            <Typography variant="h5" fontWeight={700}>AI Experience</Typography>
            <Typography variant="body2" sx={{ color: 'grey.400', ml: 2 }}>
              Chat-driven advisor workflow
            </Typography>
          </Stack>
        </Container>
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, py: 2, px: 3, bgcolor: 'background.default', overflow: 'hidden' }}>
        <Container maxWidth="xl" sx={{ height: '100%' }}>
          <Grid container spacing={2} sx={{ height: 'calc(100vh - 120px)' }}>
            {/* Left: Chat panel */}
            <Grid size={{ xs: 12, md: 7 }} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Retell call panel (appears above chat when call is active) */}
              {callActive && selectedProductId && (
                <Paper sx={{ mb: 2, borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                  <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Client Phone Call
                    </Typography>
                  </Box>
                  <RetellCallPanel
                    missingFields={missingFields}
                    clientPhone={CLIENT_PHONE}
                    clientName={clientName}
                    advisorName={ADVISOR_NAME}
                    onFieldsExtracted={handleCallFieldsExtracted}
                    onCallComplete={handleCallComplete}
                  />
                </Paper>
              )}

              {/* Chat */}
              <Paper sx={{ flex: 1, borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Advisor Chat -- {ADVISOR_NAME}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, overflow: 'hidden' }}>
                  <ChatPanel
                    sessionId={sessionId}
                    greeting={greeting}
                    onToolCalls={handleToolCalls}
                  />
                </Box>
              </Paper>
            </Grid>

            {/* Right: Field mapping panel */}
            <Grid size={{ xs: 12, md: 5 }} sx={{ height: '100%' }}>
              <FieldMappingPanel
                gatheredFields={gatheredFields}
                products={products}
                selectedProductId={selectedProductId}
                onProductSelect={handleProductSelect}
                definition={definition}
                matchedFields={matchedFields}
                onCallClient={handleCallClient}
                onLaunchWizard={handleLaunchWizard}
                callInProgress={callActive}
              />
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}
