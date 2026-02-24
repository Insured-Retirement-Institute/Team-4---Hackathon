# Submission Model — Postman Test Plan

**Base URL:** `https://y5s8xyzi3v.us-east-1.awsapprunner.com`
(or `http://localhost:8080` for local testing)

**Content-Type:** `application/json` on all requests

---

## Variable Setup

Create a Postman environment with these variables (they'll be populated automatically by test scripts):

| Variable | Initial Value |
|----------|--------------|
| `baseUrl` | `https://y5s8xyzi3v.us-east-1.awsapprunner.com` |
| `applicationId` | *(empty — set by Test 1)* |
| `submissionId` | *(empty — set by Test 3)* |
| `today` | *(set manually to today's date in YYYY-MM-DD format)* |

---

## Test 1: Create Application

**Purpose:** Create a new in-progress application to work with.

```
POST {{baseUrl}}/applications
```

**Body:**
```json
{
  "productId": "midland-fixed-annuity-001"
}
```

**Expected Response:** `201 Created`
```json
{
  "id": "<uuid>",
  "productId": "midland-fixed-annuity-001",
  "answers": {},
  "status": "in_progress",
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Postman Test Script:**
```javascript
pm.test("Status 201", () => pm.response.to.have.status(201));
pm.test("Status is in_progress", () => {
  pm.expect(pm.response.json().status).to.eql("in_progress");
});
pm.environment.set("applicationId", pm.response.json().id);
```

---

## Test 2: Save Complete Answer Set

**Purpose:** Save a full set of valid answers that will pass both answer-level and submission-level validation.

> **Important:** Replace `{{today}}` in `date_signed` and `agent_date_signed` with today's date in `YYYY-MM-DD` format, or set the `today` variable in your Postman environment.

```
PUT {{baseUrl}}/applications/{{applicationId}}/answers
```

**Body:**
```json
{
  "answers": {
    "annuitant_first_name": "Jane",
    "annuitant_middle_initial": "M",
    "annuitant_last_name": "Smith",
    "annuitant_dob": "1965-03-15",
    "annuitant_gender": "female",
    "annuitant_ssn": "123-45-6789",
    "annuitant_street_address": "742 Evergreen Terrace",
    "annuitant_city": "Springfield",
    "annuitant_state": "IL",
    "annuitant_zip": "62701",
    "annuitant_phone": "2175550100",
    "annuitant_us_citizen": "yes",

    "has_joint_annuitant": false,

    "owner_same_as_annuitant": true,

    "has_joint_owner": false,

    "owner_beneficiaries": [
      {
        "bene_type": "primary",
        "bene_entity_type": "individual",
        "bene_distribution_method": "per_stirpes",
        "bene_first_name": "Robert",
        "bene_middle_initial": "",
        "bene_last_name": "Smith",
        "bene_ssn": "987-65-4321",
        "bene_dob": "1962-07-20",
        "bene_relationship": "spouse",
        "bene_phone": "2175550101",
        "bene_street_address": "742 Evergreen Terrace",
        "bene_city": "Springfield",
        "bene_state": "IL",
        "bene_zip": "62701",
        "bene_email": "",
        "bene_percentage": 100
      }
    ],

    "owner_citizenship_status": "us_citizen",
    "owner_id_type": "drivers_license",
    "owner_id_state": "IL",
    "owner_id_number": "IL-D123-4567-8901",
    "owner_id_expiration": "2028-03-15",
    "owner_occupation": "Registered Nurse",
    "owner_employer_name": "Springfield General Hospital",
    "owner_years_employed": "12",

    "tax_status": "non_qualified",
    "funding_methods": ["check"],
    "check_amount": 50000,

    "investment_allocations": [
      { "fundId": "sp500-annual-pp-cap", "percentage": 40 },
      { "fundId": "fixed-account", "percentage": 60 }
    ],

    "has_existing_insurance": "no",
    "is_replacement": "no",

    "disc_buyers_guide_ack": true,
    "disc_free_look_ack": true,
    "disc_fixed_annuity_ack": true,
    "disc_fraud_warning_ack": true,
    "disc_rv14_product_initials": "data:image/png;base64,iVBORw0KGgo",
    "disc_rv14_owner_signature": "data:image/png;base64,iVBORw0KGgo",

    "owner_statement_acknowledged": true,
    "fraud_warning_acknowledged": true,
    "owner_signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",
    "date_signed": "{{today}}",
    "signed_at_city": "Springfield",
    "signed_at_state": "IL",

    "agent_replacement_existing": "no",
    "agent_replacement_replacing": "no",
    "writing_agents": [
      {
        "agent_number": "MN-98765",
        "agent_full_name": "Michael J. Davis",
        "agent_email": "mdavis@figbroker.com",
        "agent_phone": "3175550200",
        "agent_commission_percentage": 100,
        "agent_commission_option": "A",
        "agent_signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",
        "agent_date_signed": "{{today}}"
      }
    ]
  }
}
```

**Expected Response:** `200 OK` — returns the full application with merged answers.

**Postman Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Answers saved", () => {
  const body = pm.response.json();
  pm.expect(body.answers.annuitant_first_name).to.eql("Jane");
  pm.expect(body.answers.owner_beneficiaries).to.have.length(1);
});
```

---

## Test 3: Submit Application (Happy Path)

**Purpose:** Submit the application. Verifies the full pipeline: answer validation → transformation → submission validation → persistence.

```
POST {{baseUrl}}/application/{{applicationId}}/submit
```

**Body:**
```json
{}
```

**Expected Response:** `200 OK`
```json
{
  "id": "<submission-uuid>",
  "confirmationNumber": "ANN-2026-XXXXXXXX",
  "status": "received",
  "submittedAt": "2026-...",
  "message": "Your application has been received and is pending review. You will be contacted within 2 business days."
}
```

**Verify:**
- [ ] Response has `id` (UUID)
- [ ] `confirmationNumber` starts with `ANN-` followed by the current year
- [ ] `status` is `"received"`
- [ ] `submittedAt` is a valid ISO 8601 timestamp
- [ ] `message` is present

**Postman Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
const body = pm.response.json();
pm.test("Has confirmation number", () => {
  pm.expect(body.confirmationNumber).to.match(/^ANN-\d{4}-\d{8}$/);
});
pm.test("Status is received", () => pm.expect(body.status).to.eql("received"));
pm.test("Has submittedAt", () => pm.expect(body.submittedAt).to.be.a("string"));
pm.environment.set("submissionId", body.id);
```

---

## Test 4: Duplicate Submission Rejected

**Purpose:** Submitting the same application a second time should fail with 409.

```
POST {{baseUrl}}/application/{{applicationId}}/submit
```

**Body:**
```json
{}
```

**Expected Response:** `409 Conflict`
```json
{
  "code": "APPLICATION_ALREADY_SUBMITTED",
  "message": "This application has already been submitted.",
  "details": null
}
```

**Postman Test Script:**
```javascript
pm.test("Status 409", () => pm.response.to.have.status(409));
pm.test("Correct error code", () => {
  pm.expect(pm.response.json().code).to.eql("APPLICATION_ALREADY_SUBMITTED");
});
```

---

## Test 5: Beneficiary Percentages Don't Sum to 100

**Purpose:** Verify that answer-level validation rejects beneficiary percentages that don't sum to 100.

### 5a. Create a new application
```
POST {{baseUrl}}/applications
```
```json
{ "productId": "midland-fixed-annuity-001" }
```
Save the `id` as `{{badBeneAppId}}`.

### 5b. Save answers with bad beneficiary percentages

```
PUT {{baseUrl}}/applications/{{badBeneAppId}}/answers
```

Use the same answer body as Test 2, but change `owner_beneficiaries` to:

```json
"owner_beneficiaries": [
  {
    "bene_type": "primary",
    "bene_entity_type": "individual",
    "bene_distribution_method": "per_stirpes",
    "bene_first_name": "Robert",
    "bene_last_name": "Smith",
    "bene_ssn": "987-65-4321",
    "bene_dob": "1962-07-20",
    "bene_relationship": "spouse",
    "bene_phone": "2175550101",
    "bene_street_address": "742 Evergreen Terrace",
    "bene_city": "Springfield",
    "bene_state": "IL",
    "bene_zip": "62701",
    "bene_percentage": 50
  },
  {
    "bene_type": "primary",
    "bene_entity_type": "individual",
    "bene_distribution_method": "per_stirpes",
    "bene_first_name": "Alice",
    "bene_last_name": "Smith",
    "bene_ssn": "111-22-3333",
    "bene_dob": "1990-01-01",
    "bene_relationship": "child",
    "bene_phone": "2175550102",
    "bene_street_address": "100 Main St",
    "bene_city": "Springfield",
    "bene_state": "IL",
    "bene_zip": "62701",
    "bene_percentage": 30
  }
]
```

### 5c. Submit
```
POST {{baseUrl}}/application/{{badBeneAppId}}/submit
```
```json
{}
```

**Expected Response:** `422 Unprocessable Entity`

**Verify:**
- [ ] `valid` is `false`
- [ ] `errors` array contains at least one error with `type: "group_sum"` referencing `owner_beneficiaries`

**Postman Test Script:**
```javascript
pm.test("Status 422", () => pm.response.to.have.status(422));
pm.test("Validation failed", () => pm.expect(pm.response.json().valid).to.eql(false));
pm.test("Has group_sum error", () => {
  const errors = pm.response.json().errors;
  pm.expect(errors.some(e => e.type === "group_sum")).to.be.true;
});
```

---

## Test 6: Investment Allocations Don't Sum to 100

**Purpose:** Verify that answer-level validation rejects allocations that don't sum to 100.

### 6a–b. Create application and save answers

Same as Test 2 but change `investment_allocations` to:

```json
"investment_allocations": [
  { "fundId": "sp500-annual-pp-cap", "percentage": 40 },
  { "fundId": "fixed-account", "percentage": 40 }
]
```
*(Sums to 80, not 100)*

### 6c. Submit

**Expected Response:** `422 Unprocessable Entity`

**Verify:**
- [ ] `errors` array contains an error with `type: "allocation_sum"`

---

## Test 7: Missing Required Disclosure Acknowledgment

**Purpose:** Verify that submitting without a required disclosure acknowledgment fails validation.

### 7a–b. Create application and save answers

Same as Test 2 but **remove** `disc_buyers_guide_ack` (or set it to `false`).

### 7c. Submit

**Expected Response:** `422 Unprocessable Entity`

**Verify:**
- [ ] `errors` array contains an error with `questionId: "disc_buyers_guide_ack"` and `type: "required"`

---

## Test 8: Signature Date Not Today

**Purpose:** Verify that a signature date that doesn't match today's date is rejected.

### 8a–b. Create application and save answers

Same as Test 2 but change:
```json
"date_signed": "2025-01-01"
```

### 8c. Submit

**Expected Response:** `422 Unprocessable Entity`

**Verify:**
- [ ] `errors` array contains an error with `questionId: "date_signed"` and `type: "equals_today"`

---

## Test 9: Transfer Count Mismatch

**Purpose:** Verify that selecting a 1035 exchange funding method without providing transfer page data is rejected.

### 9a–b. Create application and save answers

Same as Test 2 but change funding to include `exchange_1035`:
```json
"funding_methods": ["check", "exchange_1035"],
"check_amount": 25000,
"exchange_1035_amount": 75000,
"transfer_count": 1
```

But **do not** include any `page-1035-transfer` data.

### 9c. Submit

**Expected Response:** `422 Unprocessable Entity`

**Verify:**
- [ ] Errors include a validation error related to the 1035 transfer page (required fields on the repeating page) OR a submission-level `transfer_count_consistency` error

---

## Test 10: Full Submission with 1035 Exchange

**Purpose:** End-to-end test with a more complex scenario including a 1035 exchange transfer.

### 10a. Create application
```
POST {{baseUrl}}/applications
```
```json
{ "productId": "midland-fixed-annuity-001" }
```

### 10b. Save answers

```
PUT {{baseUrl}}/applications/{{applicationId}}/answers
```

```json
{
  "answers": {
    "annuitant_first_name": "Jane",
    "annuitant_middle_initial": "M",
    "annuitant_last_name": "Smith",
    "annuitant_dob": "1965-03-15",
    "annuitant_gender": "female",
    "annuitant_ssn": "123-45-6789",
    "annuitant_street_address": "742 Evergreen Terrace",
    "annuitant_city": "Springfield",
    "annuitant_state": "IL",
    "annuitant_zip": "62701",
    "annuitant_phone": "2175550100",
    "annuitant_us_citizen": "yes",

    "has_joint_annuitant": false,
    "owner_same_as_annuitant": true,
    "has_joint_owner": false,

    "owner_beneficiaries": [
      {
        "bene_type": "primary",
        "bene_entity_type": "individual",
        "bene_distribution_method": "per_stirpes",
        "bene_first_name": "Robert",
        "bene_last_name": "Smith",
        "bene_ssn": "987-65-4321",
        "bene_dob": "1962-07-20",
        "bene_relationship": "spouse",
        "bene_phone": "2175550101",
        "bene_street_address": "742 Evergreen Terrace",
        "bene_city": "Springfield",
        "bene_state": "IL",
        "bene_zip": "62701",
        "bene_email": "",
        "bene_percentage": 100
      }
    ],

    "owner_citizenship_status": "us_citizen",
    "owner_id_type": "drivers_license",
    "owner_id_state": "IL",
    "owner_id_number": "IL-D123-4567-8901",
    "owner_id_expiration": "2028-03-15",
    "owner_occupation": "Registered Nurse",
    "owner_employer_name": "Springfield General Hospital",
    "owner_years_employed": "12",

    "tax_status": "ira",
    "ira_contribution_tax_year": "2025",
    "funding_methods": ["exchange_1035", "check"],
    "exchange_1035_amount": 75000,
    "check_amount": 25000,
    "transfer_count": 1,

    "investment_allocations": [
      { "fundId": "sp500-annual-pp-cap", "percentage": 40 },
      { "fundId": "fidelity-mfy-annual-pp-enhanced", "percentage": 30 },
      { "fundId": "fixed-account", "percentage": 30 }
    ],

    "page-1035-transfer": [
      {
        "receiving_contract_number": "",
        "receiving_carrier_dtcc": "",
        "surrendering_company_name": "Lincoln Financial Group",
        "surrendering_account_number": "ANN-9876543",
        "surrendering_street_address_1": "1300 South Clinton Street",
        "surrendering_address_2": "",
        "surrendering_city": "Fort Wayne",
        "surrendering_state": "IN",
        "surrendering_zip": "46802",
        "surrendering_phone": "8005248765",
        "surrendering_phone_ext": "",
        "surrendering_fax": "",
        "surrendering_plan_type": "ira",
        "surrendering_product_type": "annuity",
        "estimated_transfer_amount": 75000,
        "surrendering_owner_name": "Jane M Smith",
        "surrendering_owner_ssn": "123-45-6789",
        "surrendering_joint_owner_name": "",
        "surrendering_annuitant_name": "",
        "surrendering_joint_annuitant_name": "",
        "surrendering_contingent_annuitant_name": "",
        "transfer_scope": "full",
        "transfer_timing": "asap",
        "rmd_acknowledged": true,
        "general_disclosures_acknowledged": true,
        "backup_withholding": false,
        "taxpayer_certification_acknowledged": true,
        "transfer_owner_signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",
        "transfer_owner_signature_date": "{{today}}"
      }
    ],

    "has_existing_insurance": "yes",
    "is_replacement": "no",

    "disc_buyers_guide_ack": true,
    "disc_free_look_ack": true,
    "disc_fixed_annuity_ack": true,
    "disc_qualified_tax_ack": true,
    "disc_fraud_warning_ack": true,
    "disc_rv14_product_initials": "data:image/png;base64,iVBORw0KGgo",
    "disc_rv14_owner_signature": "data:image/png;base64,iVBORw0KGgo",
    "disc_strategy_fee_ack": true,

    "owner_statement_acknowledged": true,
    "fraud_warning_acknowledged": true,
    "owner_signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",
    "date_signed": "{{today}}",
    "signed_at_city": "Springfield",
    "signed_at_state": "IL",

    "agent_replacement_existing": "yes",
    "agent_replacement_replacing": "no",
    "writing_agents": [
      {
        "agent_number": "MN-98765",
        "agent_full_name": "Michael J. Davis",
        "agent_email": "mdavis@figbroker.com",
        "agent_phone": "3175550200",
        "agent_commission_percentage": 60,
        "agent_commission_option": "A",
        "agent_signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",
        "agent_date_signed": "{{today}}"
      },
      {
        "agent_number": "MN-11111",
        "agent_full_name": "Sarah J. Connor",
        "agent_email": "sconnor@figbroker.com",
        "agent_phone": "3175550300",
        "agent_commission_percentage": 40,
        "agent_commission_option": "B",
        "agent_signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",
        "agent_date_signed": "{{today}}"
      }
    ]
  }
}
```

### 10c. Submit
```
POST {{baseUrl}}/application/{{applicationId}}/submit
```
```json
{}
```

**Expected Response:** `200 OK` with confirmation number.

**Verify:**
- [ ] Submission succeeds with confirmation number
- [ ] Payload in DynamoDB has:
  - `envelope.applicationDefinitionId` = `"midland-national-fixed-annuity-v1"`
  - `annuitant.ssn.encrypted` = `true`
  - `owner.sameAsAnnuitant` = `true`
  - `product.taxStatus` = `"ira"`
  - `product.iraContributionTaxYear` = `2025`
  - `funding.methods` has 2 entries (exchange_1035 + check)
  - `funding.totalPremium` = `100000`
  - `investmentAllocations` has 3 entries summing to 100%
  - `investmentAllocations[1].hasStrategyFee` = `true` (fidelity enhanced)
  - `transfers` has 1 entry with `surrenderingCompany.name` = `"Lincoln Financial Group"`
  - `disclosures` includes `disclosure-qualified-tax` (visible because tax_status is ira)
  - `disclosures` includes `disclosure-strategy-fee-enhanced` (visible because enhanced fund selected)
  - `agentCertification.writingAgents` has 2 agents, commissions sum to 100%
  - `rawAnswers` is present alongside `payload`

---

## Test 11: Entity Owner (Trust)

**Purpose:** Verify the discriminated union for owner type works with a trust entity.

### 11a–b. Create application and save answers

Same as Test 2 but change owner fields to:
```json
"owner_same_as_annuitant": false,
"owner_type": "trust",
"owner_trust_name": "Smith Family Revocable Trust",
"owner_trust_date": "2010-06-15",
"owner_ssn_tin": "12-3456789",
"owner_street_address": "742 Evergreen Terrace",
"owner_city": "Springfield",
"owner_state": "IL",
"owner_zip": "62701",
"owner_phone": "2175550100"
```

And add identity verification fields for non-natural owner:
```json
"owner_non_natural_doc_type": "trust_agreement"
```

### 11c. Submit

**Expected Response:** `200 OK`

**Verify:**
- [ ] `owner.sameAsAnnuitant` = `false`
- [ ] `owner.type` = `"entity"`
- [ ] `owner.entity.entityName` = `"Smith Family Revocable Trust"`
- [ ] `owner.entity.entityType` = `"trust"`
- [ ] `owner.entity.tin.encrypted` = `true`
- [ ] `identityVerification.nonNaturalDocumentType` = `"trust_agreement"`

---

## Test 12: Application Not Found

**Purpose:** Verify 404 for a nonexistent application.

```
POST {{baseUrl}}/application/00000000-0000-0000-0000-000000000000/submit
```
```json
{}
```

**Expected Response:** `404 Not Found`
```json
{
  "code": "APPLICATION_NOT_FOUND",
  "message": "Application '00000000-0000-0000-0000-000000000000' not found.",
  "details": null
}
```

---

## Test 13: Writing Agent Commissions Don't Sum to 100

**Purpose:** Verify submission-level validation catches agent commission sum errors.

### 13a–b. Create application and save answers

Same as Test 2 but change `writing_agents` to two agents whose commissions sum to 90:
```json
"writing_agents": [
  {
    "agent_number": "MN-98765",
    "agent_full_name": "Michael J. Davis",
    "agent_email": "mdavis@figbroker.com",
    "agent_phone": "3175550200",
    "agent_commission_percentage": 50,
    "agent_commission_option": "A",
    "agent_signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",
    "agent_date_signed": "{{today}}"
  },
  {
    "agent_number": "MN-11111",
    "agent_full_name": "Sarah Connor",
    "agent_email": "sc@figbroker.com",
    "agent_phone": "3175550300",
    "agent_commission_percentage": 40,
    "agent_commission_option": "B",
    "agent_signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",
    "agent_date_signed": "{{today}}"
  }
]
```

### 13c. Submit

**Expected Response:** `422 Unprocessable Entity`

**Verify:**
- [ ] `errors` includes `rule: "group_sum"` from answer-level validation (the page-level `groupValidation` on `page-agent-certification` fires), OR `rule: "commission_percentage_sum"` from submission-level validation

---

## Quick Reference: Test Matrix

| # | Test Case | Expected Status | Validates |
|---|-----------|-----------------|-----------|
| 1 | Create application | 201 | Application creation |
| 2 | Save answers | 200 | Answer persistence |
| 3 | Submit (happy path) | 200 | Full pipeline end-to-end |
| 4 | Duplicate submit | 409 | Idempotency guard |
| 5 | Bad bene percentages | 422 | Answer-level group_sum |
| 6 | Bad allocation percentages | 422 | Answer-level allocation_sum |
| 7 | Missing disclosure ack | 422 | Disclosure required check |
| 8 | Wrong signature date | 422 | equals_today rule |
| 9 | Transfer count mismatch | 422 | Transfer/funding consistency |
| 10 | Full 1035 exchange flow | 200 | Complex happy path |
| 11 | Trust entity owner | 200 | Owner discriminated union |
| 12 | App not found | 404 | Error handling |
| 13 | Bad agent commissions | 422 | Commission sum validation |

---

## DynamoDB Verification (Optional)

After a successful submission, verify the persisted record directly:

```bash
aws dynamodb get-item \
  --table-name Submissions \
  --key '{"id": {"S": "<submissionId>"}}' \
  --region us-east-1
```

Check:
- `payload` key exists (canonical ApplicationSubmission)
- `rawAnswers` key exists (original answer blob)
- No `answers` key (old field should be absent)
- `payload.envelope.schemaVersion` = `"1.0.0"`
- `payload.annuitant.ssn.encrypted` = `true`
