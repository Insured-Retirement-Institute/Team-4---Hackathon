# Master Prompt: Annuity E-Application Dynamic UI Renderer

---

## Role & Task

You are an expert frontend engineer specializing in financial services applications. Your task is to build a **complete, production-grade, single-page React application** that dynamically renders an annuity e-application form driven entirely by an API response.

The application must be capable of rendering any valid API response — not hardcoded to one form. Every page, question, disclosure, validation rule, and visibility condition is defined by the data. Your renderer must handle all of them correctly.

---

## What You Are Building

A multi-page e-application wizard for purchasing an annuity. The applicant progresses through sequentially ordered pages. Each page is either a **standard form page** (collecting inputs) or a **disclosure page** (presenting legal content for acknowledgment). Some pages repeat dynamically based on a prior answer.

The UI has two modes that must both work:

1. **Form Mode** — An agent or advisor fills out the application on behalf of a client sitting across from them. Desktop-first, efficient, data-dense.
2. **Review Mode** — A read-only summary of all collected answers grouped by page, shown before final submission.

---

## Data Model

### Application Definition

The API returns a single `ApplicationDefinition` object:

```
{
  id, version, carrier, productName, productId,
  effectiveDate, locale, description,
  pages: Page[]
}
```

Read `description` and display it prominently at the start before any pages are shown.

### Page Object

```
{
  id: string,
  title: string,
  description: string | null,
  order: number,               // ascending, no gaps guaranteed
  pageType: 'standard' | 'disclosure',
  visibility: ConditionExpression | null,
  pageRepeat: PageRepeatConfig | null,
  disclosures: Disclosure[] | null,  // populated when pageType = 'disclosure'
  questions: Question[],             // populated on standard pages; optional supplement on disclosure pages
  groupValidations: GroupValidationRule[]
}
```

**Page ordering rules:**
- Sort pages by `order` ascending before rendering.
- Evaluate `visibility` against current answers. Hidden pages are completely skipped — do not count them in progress indicators and do not attempt to submit their answers.
- Repeating pages (`pageRepeat` is non-null) occupy one logical position in the sequence but render as N sequential sub-pages. See the Page Repeat section below.

---

## Rendering: Standard Pages

### Question Types

Render each question based on its `type` field. All inputs must:
- Display `label` as the field label
- Show `hint` as collapsible help text (a `?` icon that expands inline)
- Show `placeholder` inside the input when provided
- Apply `visibility` conditions before rendering (hide the question entirely if the condition is false)
- Disable the field until all conditions for its visibility are met
- Mark required fields visually

| `type` | Render As |
|---|---|
| `short_text` | Single-line text input |
| `long_text` | Multi-line textarea, min 3 rows |
| `number` | Numeric input; no spinners; validate on blur |
| `currency` | Numeric input with `$` prefix and thousand-separator formatting; stored as raw decimal |
| `date` | Date picker; mask format `MM/DD/YYYY`; validate ISO output |
| `boolean` | Toggle switch with "Yes" / "No" labels — **not a checkbox** |
| `select` | Searchable dropdown using `options[]` |
| `multi_select` | Multi-select chip input using `options[]`; selected options appear as removable tags |
| `radio` | Horizontal radio button group for ≤4 options; vertical stacked for >4 |
| `phone` | Masked input: `(XXX) XXX-XXXX` |
| `email` | Text input with `@` keyboard hint on mobile |
| `ssn` | Masked input: `XXX-XX-XXXX`; always obscured with reveal-on-focus toggle |
| `signature` | Signature pad canvas with clear and undo controls; output as base64 PNG token |
| `initials` | Small inline signature pad (120×60px); labeled "Initials" above; output as token. Visually distinct from full `signature` — render it inline within its disclosure card rather than full-width |
| `file_upload` | Drag-and-drop zone with file type and size constraints |
| `repeatable_group` | See Repeatable Group section |
| `allocation_table` | See Allocation Table section |

### Validation

Validation rules are defined per question in `question.validation[]`. Apply them in this order:

1. **On blur** — run field-level rules immediately when the user leaves a field: `required`, `min`, `max`, `min_length`, `max_length`, `pattern`, `min_date`, `max_date`, `equals`, `equals_today`
2. **On change** — re-run when a referenced field changes: `cross_field` rules where this question is the `field`
3. **On page submit** — run all rules including `allocation_sum` and `async` before allowing page advance
4. **Page-level** — run `groupValidations` on page submit

**Rule implementations:**

- `required` — value is non-null, non-empty string, non-empty array
- `min` / `max` — numeric comparison
- `min_length` / `max_length` — string `.length`
- `pattern` — `new RegExp(rule.value).test(answer)`
- `min_date` / `max_date` — parse relative expressions: `"today"` = today, `"-18y"` = subtract 18 years from today, `"+1d"` = add 1 day. Compare as dates.
- `equals` — strict equality: `answer === rule.value`
- `equals_today` — `answer === new Date().toISOString().slice(0, 10)`
- `cross_field` — compare `answers[rule.field]` to `answers[rule.ref_field]` using `rule.op`
- `allocation_sum` — sum all non-null fund percentages; compare to `rule.value`
- `async` — POST to `/application/{applicationId}/validate` with `scope=page`; display returned errors inline

**Date relative expression parser:**

```
function resolveDate(expr) {
  if (expr === 'today') return new Date()
  const match = expr.match(/^([+-])(\d+)([ymd])$/)
  if (!match) return new Date(expr) // literal ISO date
  const [, sign, n, unit] = match
  const d = new Date()
  const delta = sign === '+' ? +n : -n
  if (unit === 'y') d.setFullYear(d.getFullYear() + delta)
  if (unit === 'm') d.setMonth(d.getMonth() + delta)
  if (unit === 'd') d.setDate(d.getDate() + delta)
  return d
}
```

**Inline error display:** Errors appear directly below the input field in red, using the rule's `description` field as the message if present, otherwise a sensible default. Do not use a toast or modal for field-level errors.

### Group Validation Rules

After all question validations pass on submit, evaluate `page.groupValidations[]`:

```
{
  type: 'group_sum',
  questionId,        // ID of the repeatable_group question
  field,             // sub-field within each group item to sum
  filterField,       // optional: only include items where item[filterField] === filterValue
  filterValue,
  operator,          // 'eq' | 'gte' | 'lte'
  value,             // target sum
  condition,         // optional: only run this rule if condition evaluates to true
  description        // error message
}
```

Display group validation errors at the top of the relevant repeatable group, not at the page level.

---

## Rendering: Repeatable Groups

When `question.type === 'repeatable_group'`, render a card-based list:

```
┌─────────────────────────────────────────────────────────┐
│  Primary Beneficiary #1                           [✕ Remove] │
│  First Name ________  Last Name ________                     │
│  Relationship [select ▾]  Percentage [____%]                 │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Primary Beneficiary #2                           [✕ Remove] │
│  ...                                                         │
└─────────────────────────────────────────────────────────┘
[ + Add Primary Beneficiary ]   ← groupConfig.addLabel
```

- Each card instance holds its own `fields[]` with independent validation
- The "Remove" button is hidden when `items.length <= groupConfig.minItems`
- The "Add" button is hidden when `items.length >= groupConfig.maxItems`
- Number each card header with a 1-based index (e.g., "Primary Beneficiary #1")
- Group fields are stored per-instance: `answers[questionId] = [{field1: val, field2: val}, ...]`

---

## Rendering: Allocation Table

When `question.type === 'allocation_table'`, render a responsive table with one row per fund:

```
┌──────────────────────────────────────────────┬──────────────┐
│ ANNUAL POINT-TO-POINT                         │              │
├──────────────────────────────────────────────┼──────────────┤
│ S&P 500® Index — Annual PP Cap               │  [  20  ] %  │
│ S&P 500® — Annual PP Non-Enhanced Part. Rate │  [  20  ] %  │
│ Fidelity MFY — Annual PP Enhanced ★         │  [   0  ] %  │  ← fee badge
├──────────────────────────────────────────────┼──────────────┤
│ TWO-YEAR POINT-TO-POINT                       │              │
├──────────────────────────────────────────────┼──────────────┤
│ S&P 500® — Two-Year PP Participation Rate    │  [  30  ] %  │
├──────────────────────────────────────────────┼──────────────┤
│ FIXED ACCOUNT                                 │              │
├──────────────────────────────────────────────┼──────────────┤
│ Fixed Account                                 │  [  30  ] %  │
└──────────────────────────────────────────────┴──────────────┘
                                   TOTAL:  100%  ✓
```

**Grouping:** Group funds by `fund.category`. Render each category as a section header row (non-input, visually distinct).

**Strategy fee warning:** When `fund.hasStrategyFee === true`, render a `★ Strategy Fee` badge inline on that row. On hover/click, show a tooltip:
> "This strategy deducts a {strategyFeeAnnualPct}% annual fee from your accumulation value each term — including years where the index earns nothing. Your account value may decrease below your premium paid if the index is flat or negative."

**Running total:** Show a live running total of all allocations below the table. Style it:
- Gray when total < `allocationConfig.totalRequired`
- Red with error when total > `allocationConfig.totalRequired`
- Green with checkmark when total === `allocationConfig.totalRequired`

**Input constraints:** Only accept whole-number integers (0–100) per fund. Prevent the user from typing a value that would push the total above 100 (clamp on input).

**Stored value:** `answers[questionId]` is an object map: `{ [fundId]: percentage }`. Only include funds with percentage > 0.

---

## Rendering: Disclosure Pages

When `page.pageType === 'disclosure'`, switch to the disclosure renderer:

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Page Title: "Important Disclosures"                         │
│  Page description                                            │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  1. NAIC Annuity Buyer's Guide        [REQUIRED]       │  │
│  │  ─────────────────────────────────────────────────── │  │
│  │  [disclosure content / document viewer]                │  │
│  │                                                         │  │
│  │  ─────────────────────────────────────────────────── │  │
│  │  ☐  I acknowledge receipt of the NAIC Buyer's Guide... │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  2. Free Look Period Notice           [REQUIRED]       │  │
│  │  ...                                                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

Each `Disclosure` in `page.disclosures[]` renders as a self-contained card, in array order. Apply each disclosure's individual `visibility` condition — hide the card entirely if the condition is false.

### Content Rendering by Type

| `content.type` | Render As |
|---|---|
| `markdown` | Parse and render as HTML using a Markdown renderer (e.g., `react-markdown`). Render in a scrollable container with a max height of `380px`. Add a subtle gradient fade at the bottom when scrollable. |
| `html` | Render in a sandboxed `<iframe>` or sanitized `dangerouslySetInnerHTML`. Max height `380px`, scrollable. |
| `url` | Render an embedded `<iframe>` pointing to the URL, height `480px`. Display the URL as a fallback link if the iframe fails to load. |

### viewRequired Scroll Gate

When `disclosure.viewRequired === true`:

1. Render the acknowledgment control (checkbox, initials pad, or signature pad) as **visually disabled and greyed out**
2. Track scroll position within the content container. When the user has scrolled to within 20px of the bottom (or the iframe fires a `load` event for URL content), enable the acknowledgment control
3. Show a subtle indicator: "Scroll to read before acknowledging" with a down-arrow that fades out once the scroll gate is cleared
4. For `url` content with `viewRequired: true`, gate is cleared after the iframe loads successfully plus a minimum 5-second dwell time

### Acknowledgment Controls

Each disclosure's `acknowledgment` object defines how it is acknowledged:

**`type: boolean`**
```
[ ☐ ] I acknowledge receipt of the NAIC Annuity Buyer's Guide and confirm...
```
Render as a large, clearly labeled checkbox. Clicking it sets `answers[acknowledgment.questionId] = true`. Unchecking sets `null` (the field is required, so `false` is not a valid non-acknowledgment — if already checked, the user cannot proceed without re-reading).

**`type: signature`**
```
  Owner signature — MNL RetireVantage 14 Disclosure
  ┌────────────────────────────────────────────────┐
  │                                                │  ← signature pad canvas
  │              Sign here                         │
  └────────────────────────────────────────────────┘
  [Clear]
```
Full-width signature pad. Output stored as base64 PNG token. Display the `acknowledgment.label` as the caption above the pad.

**`type: initials`**
```
  Owner initials (REQUIRED)
  ┌──────────────┐
  │              │  ← small initials pad (120×60px)
  └──────────────┘
```
Render as a compact inline signature pad. Display `acknowledgment.label` above it. Stored as a token.

### Page Completion Check

The disclosure page cannot be submitted until ALL visible `disclosure.acknowledgment` controls with `required: true` have been completed (boolean = true, or signature/initials = non-empty token).

If `page.questions` is non-empty on a disclosure page, render those questions **below** all disclosure cards, in a clearly separated section labeled "Additional Information". Apply the same validation rules as standard pages.

---

## Page Repeat

When `page.pageRepeat` is non-null:

```
{
  sourceField: 'transfer_count',  // question ID whose answer = N
  minRepeat: 1,
  maxRepeat: 10,
  titleTemplate: '1035 Exchange / Rollover / Transfer – #{index} of #{total}'
}
```

**Rendering:**

1. Look up `answers[sourceField]` to get `N`.
2. Render `N` sequential sub-pages using the template page's `questions[]`.
3. Replace `#{index}` with the 1-based instance number and `#{total}` with `N` in `titleTemplate`.
4. Show a clear sub-page indicator: `"Transfer 2 of 3"` with back/next navigation between instances.

**ID namespacing:**

Within a repeating page instance, question IDs are namespaced as `{questionId}#{index}` for UI element keys and validation purposes. However, `visibility` conditions within the page reference bare IDs — resolve them against the **current instance's answers only**.

**Answer storage:**

```
answers['page-1035-transfer'] = [
  { surrendering_company_name: 'Lincoln', ... },  // instance 1
  { surrendering_company_name: 'Nationwide', ... } // instance 2
]
```

Each instance's answers are stored as a plain object with bare question IDs. Cross-page conditions use `answers['page-1035-transfer'][0].surrendering_company_name` etc. but the visibility engine only needs to handle the current-instance and global-map cases.

---

## Condition Evaluation Engine

Build a `evaluate(condition, answers)` function that handles the full expression tree.

### Leaf Conditions

```javascript
function evaluateLeaf(cond, answers) {
  const leftRaw = answers[cond.field]
  const right = cond.ref_field ? answers[cond.ref_field] : cond.value

  // For date fields, resolve relative expressions
  const left = isDateValue(leftRaw) ? parseDate(leftRaw) : leftRaw
  const rightResolved = typeof right === 'string' && isRelativeDate(right)
    ? resolveDate(right)
    : (isDateValue(right) ? parseDate(right) : right)

  switch (cond.op) {
    case 'eq':       return left === rightResolved
    case 'neq':      return left !== rightResolved
    case 'gt':       return left > rightResolved
    case 'gte':      return left >= rightResolved
    case 'lt':       return left < rightResolved
    case 'lte':      return left <= rightResolved
    case 'in':       return Array.isArray(rightResolved) && rightResolved.includes(left)
    case 'not_in':   return Array.isArray(rightResolved) && !rightResolved.includes(left)
    case 'contains': return Array.isArray(left) && left.includes(rightResolved)
    case 'min_items': return Array.isArray(left) && left.length >= rightResolved
    case 'max_items': return Array.isArray(left) && left.length <= rightResolved
    default: return false
  }
}
```

### Compound Conditions

```javascript
function evaluate(cond, answers) {
  if (cond.operator) {
    const results = cond.conditions.map(c => evaluate(c, answers))
    if (cond.operator === 'AND') return results.every(Boolean)
    if (cond.operator === 'OR')  return results.some(Boolean)
    if (cond.operator === 'NOT') return !results[0]
  }
  return evaluateLeaf(cond, answers)
}
```

**Null conditions:** When `visibility` is `null`, always render (return `true`).

**Within repeating pages:** When evaluating a visibility condition for a question on a repeating page, create a merged answer context: `{ ...globalAnswers, ...currentInstanceAnswers }`. This allows in-page sibling field references to resolve from the current instance.

---

## Answer Map

Maintain a single `answers` object in state (React `useState` or `useReducer`). The shape follows the `AnswerMap` schema:

```javascript
{
  // Standard questions
  annuitant_first_name: 'Jane',
  tax_status: 'ira',

  // Repeatable group
  owner_beneficiaries: [
    { bene_first_name: 'John', bene_type: 'primary', bene_percentage: 100 }
  ],

  // Repeating page instances
  'page-1035-transfer': [
    { surrendering_company_name: 'Lincoln Financial', transfer_scope: 'full' },
    { surrendering_company_name: 'Nationwide', transfer_scope: 'partial' }
  ],

  // Allocation table
  investment_allocations: {
    'sp500-annual-pp-cap': 50,
    'fixed-account': 50
  },

  // Disclosure acknowledgments (same flat namespace)
  disc_buyers_guide_ack: true,
  disc_rv14_owner_signature: 'sig_token_...'
}
```

**Important:** Disclosure acknowledgment IDs live in the same flat namespace as question IDs. Do not namespace them separately.

---

## Navigation & Progress

### Sidebar / Progress Bar

Show a vertical progress indicator listing all **visible** pages in order:
- Completed pages (all required answers filled, validation passed) → checkmark, muted style
- Current page → highlighted, bold
- Future pages → neutral, accessible

Do not show hidden pages (visibility = false) in the progress indicator at all.

For repeating page groups, show them as a single collapsible item: `"1035 Transfers (2)"` that expands to show sub-page progress.

### Navigation Controls

Each page has:
- **Back** button (disabled on page 1)
- **Continue** / **Next** button that:
  1. Runs all visible required field validations on the current page
  2. Runs group validations
  3. If errors exist, scrolls to the first error and blocks navigation
  4. If clean, saves the page answers and advances

On the final page, "Continue" becomes **"Review & Submit"**.

### Review Screen

Before submission, show a full read-only summary of all collected answers, grouped by page. Each group shows:
- Page title
- All answered questions with label and formatted value
- Disclosure acknowledgments as `✓ Acknowledged` or `✓ Signed`
- An "Edit" link that jumps back to that page

After the applicant confirms on the review screen, POST to `/application/{applicationId}/submit`.

---

## UX Requirements

**Auto-save:** Debounce saves of `answers` to `localStorage` every 500ms keyed by `applicationId`. Restore on load.

**Field clearing:** When a field's `visibility` condition becomes false (because a dependency changed), **clear its value** from the answer map. This prevents stale answers from being submitted for hidden questions.

**Date auto-fill:** For all fields with `type: 'date'` and an `equals_today` validation rule, pre-fill today's date and disable the field (the applicant cannot change a signature date).

**SSN masking:** Once an SSN is entered and the field loses focus, display only the last 4 digits (`***-**-6789`). The full value is stored in state but never re-displayed.

**Signature timestamps:** When a signature or initials pad is completed, record `new Date().toISOString()` as `{questionId}_timestamp` in answers. This is not surfaced in the UI but is included in the submission payload metadata.

**Scroll restoration:** When navigating back to a previous page, scroll to the top of that page, not the last field.

**Mobile responsiveness:** The form must be fully usable on a tablet (768px+). On mobile (<768px), stack all two-column layouts to single column. The allocation table scrolls horizontally on small screens.

---

## Aesthetic Direction

This is a professional financial services application used by licensed agents and advisors in a regulated context. Design accordingly:

- **Tone:** Refined, institutional, trustworthy. Think private wealth management, not consumer fintech.
- **Typography:** A high-quality serif for headings (e.g., a transitional or humanist serif) paired with a clean, legible sans for body and inputs. Avoid all system fonts and generic sans-serifs.
- **Color palette:** A deeply considered two-tone palette — a rich dark neutral (near-black, deep navy, or dark slate) paired with a restrained warm or cool accent. White space is generous. No gradients except for subtle depth.
- **Disclosure cards:** Should feel like premium legal documents — cream or very light gray background, fine border, generous internal padding, distinct from the form fields.
- **Signature / initials pads:** Subtly lined paper texture, ink-blue stroke color.
- **Strategy fee badge (★):** Amber/gold — distinct enough to warn without alarming.
- **Error states:** Deep red text, no red backgrounds (too alarming for a financial context).
- **Animation:** Subtle and purposeful — page transitions use a simple vertical slide; field errors fade in; the allocation total counter animates numerically when values change.
- **Form fields:** Generous hit targets, clear focus rings, no floating labels (they reduce legibility in dense forms). Labels above fields always.

---

## Technical Constraints

- **Framework:** React with hooks (`useState`, `useReducer`, `useEffect`, `useCallback`, `useMemo`)
- **Single file:** Output as a single `.jsx` artifact unless explicitly told otherwise
- **No external API calls in the artifact:** Mock the API response inline. Define a `const APP_DEFINITION = { ... }` constant at the top of the file containing a representative subset of the actual application definition (at minimum: 3 standard pages with a variety of question types, 1 disclosure page with 3 disclosures, and 1 repeating page).
- **Signature pads:** Use an inline canvas-based implementation; do not import an external signature library
- **Markdown rendering:** Use `react-markdown` if available; otherwise implement a minimal renderer for headers, bold, italic, bullet lists, tables, and blockquotes
- **Date handling:** Use native `Date` only; no external date libraries
- **Tailwind:** Use only Tailwind core utility classes (no JIT, no arbitrary values). Supplement with inline styles where Tailwind classes cannot achieve the required aesthetic.
- **Accessible:** All inputs must have associated `<label>` elements. Error messages must use `role="alert"`. Keyboard navigation must be fully functional. Color is never the sole differentiator for required information.

---

## What NOT To Do

- Do not hardcode any page titles, question labels, or option values. Every string comes from the API response.
- Do not show hidden pages in navigation or progress.
- Do not clear the entire answer map when navigating between pages — only clear answers for fields whose visibility just became false.
- Do not disable the Back button mid-page if there are validation errors — only disable Continue.
- Do not render disclosure acknowledgment controls as plain HTML checkboxes. Use styled, custom controls.
- Do not submit hidden questions' answers. Filter the answer map before POSTing by walking the visible question tree.
- Do not use `alert()`, `confirm()`, or `prompt()`.
- Do not use purple-gradient-on-white aesthetics. This is a financial document workflow, not a SaaS landing page.
- Do not forget to handle the `null` case for every nullable field (`visibility`, `description`, `options`, `groupConfig`, `allocationConfig`, `pageRepeat`, `disclosures`).

---

## Mock Data Guidance

When constructing `APP_DEFINITION` for the artifact, include at minimum:

1. **An annuitant info page** — with `short_text`, `date`, `radio`, `select`, and `boolean` questions; at least two with `visibility` conditions
2. **A product selection page** — with a `multi_select`, `currency`, and an `allocation_table` containing at least 6 funds across 3 categories, including 2 with `hasStrategyFee: true`
3. **A 1035 transfer page** — with `pageRepeat` config, `sourceField: 'transfer_count'`, containing 6–8 questions of varied types with in-page visibility conditions
4. **A disclosures page** — `pageType: 'disclosure'` with 4 disclosures: one `markdown` with `viewRequired: true` and `boolean` ack; one `url` with `viewRequired: true` and `boolean` ack; one with `signature` ack always visible; one with `initials` ack and a `visibility` condition
5. **A signature page** — with `signature`, `date` (today-locked), and `boolean` questions

This coverage exercises all major rendering branches and ensures the UI is demonstrably dynamic.
