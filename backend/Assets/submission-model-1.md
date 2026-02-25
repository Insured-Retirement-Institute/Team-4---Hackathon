# Annuity E-Application Submission Model
**Version:** 1.0.0  
**Status:** Draft  
**Owner:** FIG Platform Team

---

## Overview

This document defines the canonical submission payload sent from FIG's e-application platform to a carrier after an application is completed and reviewed. The model is carrier-agnostic — carriers consuming it as structured data use it directly; carriers requiring PDF form filling receive it as input to their own mapping layer.

The model is organized around **logical entities** (annuitant, owner, beneficiaries, etc.) rather than the page structure of the application. This separation means the downstream carrier system never needs to know how the data was collected.

---

## Design Principles

- Every section is independently nullable/optional so partial submissions and edge-case applicant configurations are representable
- Signatures carry **both** the captured image and a structured attestation record — consumers may use either or both
- All monetary values are stored as `number` (decimal, USD, unformatted)
- All dates are ISO 8601 strings: `YYYY-MM-DD` for dates, `YYYY-MM-DDTHH:mm:ssZ` for timestamps
- Encrypted values (SSN, TIN) are transmitted as encrypted strings; the `isEncrypted: true` flag signals this to consumers
- The `envelope.submissionMode` field signals whether to consume the data directly or transpose to a PDF form

---

## TypeScript Interfaces

```typescript
// ─────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────

interface ApplicationSubmission {
  envelope:               SubmissionEnvelope
  annuitant:              PersonParty
  jointAnnuitant:         PersonParty | null
  owner:                  OwnerParty
  jointOwner:             PersonParty | null
  ownerBeneficiaries:     Beneficiary[]
  annuitantBeneficiaries: Beneficiary[]
  identityVerification:   IdentityVerification
  product:                ProductDetail
  funding:                FundingDetail
  investmentAllocations:  AllocationEntry[]
  transfers:              TransferDetail[]
  replacement:            ReplacementDetail
  disclosures:            DisclosureRecord[]
  applicationSignatures:  ApplicationSignatures
  producerCertification:     ProducerCertification
}


// ─────────────────────────────────────────────────────────────────
// ENVELOPE
// ─────────────────────────────────────────────────────────────────

interface SubmissionEnvelope {
  /** FIG-assigned unique ID for this submission. UUIDv4. */
  submissionId:       string

  /** FIG-assigned ID for the in-progress application instance that produced this submission. */
  applicationId:      string

  /** Version of this submission model schema. Used by consumers to select the correct parser. */
  schemaVersion:      string          // e.g. "1.0.0"

  /** ISO 8601 UTC timestamp of when this submission payload was generated. */
  submittedAt:        string

  /** The e-application definition that was completed to produce this submission. */
  applicationDefinitionId:      string   // e.g. "midland-national-fixed-annuity-v1"
  applicationDefinitionVersion: string   // e.g. "1.0.0"

  /** Carrier routing information. */
  carrier: {
    name:       string   // "Midland National Life Insurance Company"
    carrierId:  string   // FIG internal carrier identifier
  }

  /** The product applied for. */
  product: {
    productId:   string   // carrier's product identifier
    productName: string   // "MNL RetireVantage® 14"
    formNumbers: string[] // e.g. ["AS124A", "AR153A"] — carrier form numbers on the contract
  }

  /**
   * Signals to the carrier system how to process this submission:
   * - "data_only"   — Consume the structured data directly (no PDF required)
   * - "pdf_fill"    — Use this data as input to PDF form mapping
   */
  submissionMode: 'data_only' | 'pdf_fill'

  /** Channel and producer context for the submission. */
  submissionSource: 'web' | 'mobile' | 'ai_agent' | 'phone'
  submittingProducerNpn: string | null    // NPN of the producer who submitted on behalf of the client

  /** Client IP address and user agent at time of submission, if available. */
  ipAddress:  string | null
  userAgent:  string | null
}


// ─────────────────────────────────────────────────────────────────
// SHARED PRIMITIVES
// ─────────────────────────────────────────────────────────────────

interface Address {
  street1: string
  street2: string | null
  city:    string
  state:   string   // 2-letter US state code
  zip:     string
}

/**
 * An encrypted sensitive value (SSN, TIN, EIN).
 * The `value` field contains the encrypted ciphertext.
 * Encryption algorithm and key management are defined separately in the
 * FIG platform security specification.
 */
interface EncryptedValue {
  isEncrypted: true
  value:     string   // encrypted ciphertext
  hint:      string   // last 4 digits for display: "6789"
}

/**
 * A captured electronic signature.
 * Contains both the visual artifact and a structured audit record.
 * Consumers may use either or both depending on their requirements.
 */
interface SignatureRecord {
  /** Base64-encoded PNG data URI of the captured signature or initials image.
   *  null when the acknowledgment was a boolean click-through with no image capture. */
  capturedImage: string | null

  /** Structured audit trail for this signature event. */
  attestation: {
    /** ISO 8601 UTC timestamp of when the signature was captured. */
    signedAt:    string

    /** How the signature was captured. */
    method:      'drawn' | 'typed' | 'clicked'

    /** Whether a licensed producer was present at the time of signing. */
    isProducerWitnessed:  boolean

    /** NPN of the witnessing producer, if isProducerWitnessed is true. */
    witnessProducerNpn: string | null

    /** Client IP at time of signing. */
    ipAddress:   string | null

    /** Browser/client user agent at time of signing. */
    userAgent:   string | null
  }
}


// ─────────────────────────────────────────────────────────────────
// PARTIES
// ─────────────────────────────────────────────────────────────────

interface PersonParty {
  firstName:      string
  middleName:  string | null
  lastName:       string
  dateOfBirth:    string              // YYYY-MM-DD
  gender:         'male' | 'female'
  taxId:            EncryptedValue
  address:        Address
  phone:          string
  email:          string | null
  isUsCitizen:      boolean
}

interface EntityParty {
  /** Legal entity name (trust, corporation, estate, etc.) */
  entityName:  string
  entityType:  'trust' | 'corporation' | 'estate' | 'other'
  /** Date the entity/trust was established. */
  entityDate:  string | null          // YYYY-MM-DD
  taxId:         EncryptedValue
  address:     Address
  phone:       string
  email:       string | null
}

/**
 * The owner may be:
 * 1. The same individual as the annuitant (isSameAsAnnuitant: true)
 * 2. A different natural person (type: 'individual')
 * 3. A legal entity such as a trust or corporation (type: 'entity')
 */
type OwnerParty =
  | { isSameAsAnnuitant: true }
  | { isSameAsAnnuitant: false; type: 'individual'; person: PersonParty }
  | { isSameAsAnnuitant: false; type: 'entity';     entity: EntityParty }


// ─────────────────────────────────────────────────────────────────
// BENEFICIARIES
// ─────────────────────────────────────────────────────────────────

interface Beneficiary {
  /** 1-based display index within the beneficiary list, ordered by entry. */
  index:               number

  type:                'primary' | 'contingent'
  entityType:          'individual' | 'trust' | 'corporation' | 'estate' | 'other'
  distributionMethod:  'per_stirpes' | 'per_capita'

  firstName:           string
  middleName:       string | null
  lastName:            string
  taxId:                 EncryptedValue | null   // null when not provided or entity beneficiary
  dateOfBirth:         string | null           // YYYY-MM-DD
  relationship:        'spouse' | 'child' | 'parent' | 'sibling' | 'grandchild' | 'estate' | 'trust' | 'other'

  address:             Address
  phone:               string | null
  email:               string | null

  /** Whole number 1–100. All primary beneficiary percentages must sum to 100.
   *  Contingent percentages must also sum to 100. */
  percentage:          number
}


// ─────────────────────────────────────────────────────────────────
// IDENTITY VERIFICATION
// ─────────────────────────────────────────────────────────────────

interface IdentityVerification {
  citizenshipStatus:  'us_citizen' | 'us_resident_alien' | 'non_resident_alien'
  countryOfCitizenship: string | null   // ISO 3166-1 alpha-2 when non-US

  governmentId: {
    type:       'drivers_license' | 'state_id' | 'passport' | 'military_id'
    number:     string
    /** Issuing state (US) or country (non-US). */
    issuedBy:   string
    expirationDate: string              // YYYY-MM-DD
  }

  occupation:     string
  employerName:   string | null
  yearsEmployed:  string | null

  /** For non-natural owners (trusts, corporations, estates). */
  nonNaturalDocumentType: 'trust_agreement' | 'articles_of_incorporation' | 'letters_testamentary' | null
}


// ─────────────────────────────────────────────────────────────────
// PRODUCT
// ─────────────────────────────────────────────────────────────────

interface ProductDetail {
  /**
   * The tax status of this annuity.
   * Maps to the carrier's contract plan type classification.
   */
  taxStatus:
    | 'non_qualified'
    | 'ira'
    | 'roth_ira'
    | 'sep_ira'
    | 'tsa_403b'
    | 'inherited_ira'

  /**
   * When taxStatus is 'ira' or 'roth_ira' and the purchase is a contribution
   * (not a rollover or transfer), the tax year the contribution applies to.
   * null for all other tax statuses.
   */
  iraContributionTaxYear: number | null   // e.g. 2025
}


// ─────────────────────────────────────────────────────────────────
// FUNDING
// ─────────────────────────────────────────────────────────────────

/**
 * All funding methods used and their corresponding premium amounts.
 * An application may use multiple funding methods simultaneously.
 * The sum of all non-null amounts equals the total initial premium.
 */
interface FundingDetail {
  methods: FundingMethod[]

  /**
   * When multiple checks are received, how to handle them if the
   * application cannot be processed immediately.
   */
  multipleCheckHandling: 'hold_all' | 'deposit_first_hold_others' | null

  /** Sum of all funding amounts. Computed field for carrier convenience. */
  totalPremium: number
}

interface FundingMethod {
  type:   'check' | 'direct_transfer' | 'exchange_1035' | 'qualified_rollover' | 'salary_reduction'
  amount: number
}


// ─────────────────────────────────────────────────────────────────
// INVESTMENT ALLOCATIONS
// ─────────────────────────────────────────────────────────────────

/**
 * A single fund allocation entry. All entries across the application
 * must sum to 100.
 */
interface AllocationEntry {
  /** Fund/crediting strategy identifier matching the application definition. */
  fundId:   string

  /** Human-readable strategy name for carrier display. */
  fundName: string

  /** Whole number percentage, 1–100. */
  percentage: number

  /**
   * Denormalized metadata for carrier convenience — mirrors the Fund schema
   * in the application definition. Carriers who perform PDF mapping can use
   * these fields to locate the correct checkbox or row on the allocation form.
   */
  creditingMethod: string | null
  index:           string | null
  termYears:       number | null
  hasStrategyFee:  boolean
  strategyFeeAnnualPct: number | null
}


// ─────────────────────────────────────────────────────────────────
// 1035 EXCHANGES / TRANSFERS
// ─────────────────────────────────────────────────────────────────

/**
 * Complete ACORD 951e data for a single surrendering company.
 * One entry per transfer. Ordered by the applicant's entry sequence.
 */
interface TransferDetail {
  /** 1-based index among all transfers on this application. */
  index: number

  /** Receiving company details — populated when funds go to an existing contract. */
  receiving: {
    contractNumber: string | null
    carrierDtcc:    string | null
  }

  surrenderingCompany: {
    name:     string
    address:  Address
    phone:    string | null
    phoneExt: string | null
    fax:      string | null
  }

  surrenderingContract: {
    accountNumber:  string
    planType:       'non_qualified' | 'ira' | 'roth_ira' | 'sep_ira' | 'tsa_403b' | 'inherited_ira' | '401k' | 'pension' | 'other'
    productType:    'life' | 'annuity' | 'cd' | 'mutual_fund' | '401k' | 'ira_account' | 'other'
    estimatedAmount: number
  }

  surrenderingParties: {
    ownerName:                   string
    ownerTaxId:                    EncryptedValue
    jointOwnerName:              string | null
    jointOwnerTaxId:               EncryptedValue | null
    annuitantName:               string | null
    annuitantTaxId:                EncryptedValue | null
    jointAnnuitantName:          string | null
    jointAnnuitantTaxId:           EncryptedValue | null
    contingentAnnuitantName:     string | null
    contingentAnnuitantTaxId:      EncryptedValue | null
  }

  transferInstructions: {
    scope:           'full' | 'partial' | 'penalty_free'
    partialAmountType:   'dollar' | 'percentage' | null
    partialDollarAmount: number | null
    partialPercentage:   number | null
    timing:          'asap' | 'specific_date'
    specificDate:    string | null   // YYYY-MM-DD
  }

  acknowledgments: {
    isRmdAcknowledged:             boolean | null   // null when not applicable
    isPartial1035Acknowledged:     boolean | null
    isTsa403bTransferAcknowledged: boolean | null
    isGeneralDisclosuresAcknowledged: boolean
    isBackupWithholding:           boolean
    isTaxpayerCertificationAcknowledged: boolean
  }

  signatures: {
    ownerSignature:         SignatureRecord
    ownerSignatureDate:     string             // YYYY-MM-DD
    jointOwnerSignature:    SignatureRecord | null
    jointOwnerSignatureDate: string | null
    annuitantSignature:     SignatureRecord | null
    spouseSignature:        SignatureRecord | null
    spouseSignatureDate:    string | null
    tsaEmployer: {
      name:           string
      title:          string
      signature:      SignatureRecord
      signatureDate:  string
    } | null
  }
}


// ─────────────────────────────────────────────────────────────────
// REPLACEMENT
// ─────────────────────────────────────────────────────────────────

interface ReplacementDetail {
  /** Does the applicant have any existing life insurance or annuity contracts? */
  hasExistingInsurance: boolean

  /** Will this new annuity replace or change any existing contract? */
  isReplacement: boolean

  /** Populated when isReplacement is true. */
  replacedContracts: ReplacedContract[]
}

interface ReplacedContract {
  index:          number
  companyName:    string
  contractNumber: string
}


// ─────────────────────────────────────────────────────────────────
// DISCLOSURES
// ─────────────────────────────────────────────────────────────────

/**
 * Audit record for a single disclosure acknowledgment.
 * One entry per disclosure that was presented and acknowledged.
 * Disclosures that were not shown (visibility condition was false)
 * are omitted from this array entirely.
 */
interface DisclosureRecord {
  /** Disclosure ID from the application definition (e.g., "disclosure-buyers-guide"). */
  disclosureId:   string

  /** Human-readable disclosure title for carrier display. */
  title:          string

  /**
   * How the applicant acknowledged this disclosure.
   * - "boolean"   — checked a checkbox; capturedImage will be null
   * - "signature" — signed a signature pad
   * - "initials"  — provided initials on an inline pad
   */
  acknowledgmentType: 'boolean' | 'signature' | 'initials'

  /**
   * The full acknowledgment label text the applicant agreed to.
   * Preserved verbatim from the application definition for audit purposes.
   */
  acknowledgmentLabel: string

  /** Whether the applicant was required to fully view the content before acknowledging. */
  isViewRequired:   boolean

  /** Whether the scroll/view gate was satisfied before acknowledgment was captured. */
  isViewCompleted:  boolean

  /** ISO 8601 UTC timestamp of when the acknowledgment was completed. */
  acknowledgedAt: string

  /** The signature record. For boolean acknowledgments, capturedImage will be null
   *  but the attestation (timestamp, method: 'clicked', ip, userAgent) is always present. */
  signature:      SignatureRecord
}


// ─────────────────────────────────────────────────────────────────
// APPLICATION SIGNATURES
// ─────────────────────────────────────────────────────────────────

interface ApplicationSignatures {
  /** The applicant's certification that all statements in the application are true. */
  isOwnerStatementAcknowledged: boolean

  isFraudWarningAcknowledged: boolean

  ownerSignature:          SignatureRecord
  ownerSignatureDate:      string          // YYYY-MM-DD; always equals submission date

  jointOwnerSignature:     SignatureRecord | null
  jointOwnerSignatureDate: string | null

  /** Spouse signature — required in community property states when applicable. */
  spouseSignature:         SignatureRecord | null

  /** City and state where the application was signed. */
  signedAtCity:   string
  signedAtState:  string

  ownerEmail:      string | null
  jointOwnerEmail: string | null
}


// ─────────────────────────────────────────────────────────────────
// PRODUCER CERTIFICATION
// ─────────────────────────────────────────────────────────────────

interface ProducerCertification {
  /**
   * Whether the producer is aware the applicant has existing insurance.
   * Maps to the replacement suitability questions on the producer certification page.
   */
  isProducerAwareOfExistingInsurance: boolean

  /**
   * Whether the producer believes this contract replaces existing insurance.
   */
  isProducerBelievesReplacement: boolean

  /**
   * Company name of the contract being replaced, if isProducerBelievesReplacement is true.
   */
  replacingCompanyName: string | null

  /** All producers (writing agents) on this application. Commissions must sum to 100%. */
  producers: Producer[]
}

interface Producer {
  /** 1-based index among all writing agents on this application. */
  index: number

  /** Producer's carrier-assigned writing/producer number. */
  producerNumber: string

  /** Producer's National Producer Number (NPN) from NIPR. */
  npn: string | null

  fullName:  string
  email:     string
  phone:     string

  /** Whole number percentage of total commission. All agents must sum to 100. */
  commissionPercentage: number

  /** Carrier-specific commission option code (e.g., 'A', 'B', 'C', 'D'). */
  commissionOption: string

  signature:     SignatureRecord
  signatureDate: string   // YYYY-MM-DD
}
```

---

## Full Example Payload

```json
{
  "envelope": {
    "submissionId": "sub_01j9kx2m4n8p3q7r5t6v",
    "applicationId": "app_01j8mw1k3n7p2q6r4s5u",
    "schemaVersion": "1.0.0",
    "submittedAt": "2025-06-15T14:30:00Z",
    "applicationDefinitionId": "midland-national-fixed-annuity-v1",
    "applicationDefinitionVersion": "1.0.0",
    "carrier": {
      "name": "Midland National Life Insurance Company",
      "carrierId": "fig-carrier-midland-national"
    },
    "product": {
      "productId": "midland-retirevantage-14",
      "productName": "MNL RetireVantage® 14",
      "formNumbers": ["AS124A", "AR153A", "AR327A", "AR163A-1"]
    },
    "submissionMode": "pdf_fill",
    "submissionSource": "web",
    "submittingProducerNpn": "12345678",
    "ipAddress": "198.51.100.42",
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
  },

  "annuitant": {
    "firstName": "Jane",
    "middleName": "M",
    "lastName": "Smith",
    "dateOfBirth": "1965-03-15",
    "gender": "female",
    "taxId": { "isEncrypted": true, "value": "enc_aes256_abc123...", "hint": "6789" },
    "address": {
      "street1": "742 Evergreen Terrace",
      "street2": null,
      "city": "Springfield",
      "state": "IL",
      "zip": "62701"
    },
    "phone": "2175550100",
    "email": "jane.smith@example.com",
    "isUsCitizen": true
  },

  "jointAnnuitant": null,

  "owner": {
    "isSameAsAnnuitant": false,
    "type": "individual",
    "person": {
      "firstName": "Jane",
      "middleName": "M",
      "lastName": "Smith",
      "dateOfBirth": "1965-03-15",
      "gender": "female",
      "taxId": { "isEncrypted": true, "value": "enc_aes256_abc123...", "hint": "6789" },
      "address": {
        "street1": "742 Evergreen Terrace",
        "street2": null,
        "city": "Springfield",
        "state": "IL",
        "zip": "62701"
      },
      "phone": "2175550100",
      "email": "jane.smith@example.com",
      "isUsCitizen": true
    }
  },

  "jointOwner": null,

  "ownerBeneficiaries": [
    {
      "index": 1,
      "type": "primary",
      "entityType": "individual",
      "distributionMethod": "per_stirpes",
      "firstName": "Robert",
      "middleName": null,
      "lastName": "Smith",
      "taxId": { "isEncrypted": true, "value": "enc_aes256_def456...", "hint": "4321" },
      "dateOfBirth": "1962-07-20",
      "relationship": "spouse",
      "address": {
        "street1": "742 Evergreen Terrace",
        "street2": null,
        "city": "Springfield",
        "state": "IL",
        "zip": "62701"
      },
      "phone": "2175550101",
      "email": null,
      "percentage": 100
    }
  ],

  "annuitantBeneficiaries": [],

  "identityVerification": {
    "citizenshipStatus": "us_citizen",
    "countryOfCitizenship": null,
    "governmentId": {
      "type": "drivers_license",
      "number": "IL-D123-4567-8901",
      "issuedBy": "IL",
      "expirationDate": "2028-03-15"
    },
    "occupation": "Registered Nurse",
    "employerName": "Springfield General Hospital",
    "yearsEmployed": "12",
    "nonNaturalDocumentType": null
  },

  "product": {
    "taxStatus": "ira",
    "iraContributionTaxYear": null
  },

  "funding": {
    "methods": [
      { "type": "exchange_1035", "amount": 75000.00 },
      { "type": "check",         "amount": 25000.00 }
    ],
    "multipleCheckHandling": null,
    "totalPremium": 100000.00
  },

  "investmentAllocations": [
    {
      "fundId": "sp500-annual-pp-cap",
      "fundName": "S&P 500® Index — Annual Point-to-Point Cap",
      "percentage": 40,
      "creditingMethod": "annual_point_to_point_cap",
      "index": "S&P 500® Index",
      "termYears": 1,
      "hasStrategyFee": false,
      "strategyFeeAnnualPct": null
    },
    {
      "fundId": "fidelity-mfy-annual-pp-enhanced",
      "fundName": "Fidelity Multifactor Yield Index 5% ER — Annual PP Enhanced Participation Rate",
      "percentage": 30,
      "creditingMethod": "annual_point_to_point_participation_enhanced",
      "index": "Fidelity Multifactor Yield Index 5% ER",
      "termYears": 1,
      "hasStrategyFee": true,
      "strategyFeeAnnualPct": 1.00
    },
    {
      "fundId": "fixed-account",
      "fundName": "Fixed Account",
      "percentage": 30,
      "creditingMethod": "fixed",
      "index": null,
      "termYears": null,
      "hasStrategyFee": false,
      "strategyFeeAnnualPct": null
    }
  ],

  "transfers": [
    {
      "index": 1,
      "receiving": {
        "contractNumber": null,
        "carrierDtcc": null
      },
      "surrenderingCompany": {
        "name": "Lincoln Financial Group",
        "address": {
          "street1": "1300 South Clinton Street",
          "street2": null,
          "city": "Fort Wayne",
          "state": "IN",
          "zip": "46802"
        },
        "phone": "8005248765",
        "phoneExt": null,
        "fax": null
      },
      "surrenderingContract": {
        "accountNumber": "ANN-9876543",
        "planType": "ira",
        "productType": "annuity",
        "estimatedAmount": 75000.00
      },
      "surrenderingParties": {
        "ownerName": "Jane M Smith",
        "ownerTaxId": { "isEncrypted": true, "value": "enc_aes256_abc123...", "hint": "6789" },
        "jointOwnerName": null,
        "jointOwnerTaxId": null,
        "annuitantName": null,
        "annuitantTaxId": null,
        "jointAnnuitantName": null,
        "jointAnnuitantTaxId": null,
        "contingentAnnuitantName": null,
        "contingentAnnuitantTaxId": null
      },
      "transferInstructions": {
        "scope": "full",
        "partialAmountType": null,
        "partialDollarAmount": null,
        "partialPercentage": null,
        "timing": "asap",
        "specificDate": null
      },
      "acknowledgments": {
        "isRmdAcknowledged": true,
        "isPartial1035Acknowledged": null,
        "isTsa403bTransferAcknowledged": null,
        "isGeneralDisclosuresAcknowledged": true,
        "isBackupWithholding": false,
        "isTaxpayerCertificationAcknowledged": true
      },
      "signatures": {
        "ownerSignature": {
          "capturedImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
          "attestation": {
            "signedAt": "2025-06-15T14:22:10Z",
            "method": "drawn",
            "isProducerWitnessed": true,
            "witnessProducerNpn": "12345678",
            "ipAddress": "198.51.100.42",
            "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
          }
        },
        "ownerSignatureDate": "2025-06-15",
        "jointOwnerSignature": null,
        "jointOwnerSignatureDate": null,
        "annuitantSignature": null,
        "spouseSignature": null,
        "spouseSignatureDate": null,
        "tsaEmployer": null
      }
    }
  ],

  "replacement": {
    "hasExistingInsurance": true,
    "isReplacement": false,
    "replacedContracts": []
  },

  "disclosures": [
    {
      "disclosureId": "disclosure-buyers-guide",
      "title": "NAIC Annuity Buyer's Guide",
      "acknowledgmentType": "boolean",
      "acknowledgmentLabel": "I acknowledge that I have received the NAIC Annuity Buyer's Guide and have had the opportunity to review it prior to signing this application.",
      "isViewRequired": true,
      "isViewCompleted": true,
      "acknowledgedAt": "2025-06-15T14:10:05Z",
      "signature": {
        "capturedImage": null,
        "attestation": {
          "signedAt": "2025-06-15T14:10:05Z",
          "method": "clicked",
          "isProducerWitnessed": true,
          "witnessProducerNpn": "12345678",
          "ipAddress": "198.51.100.42",
          "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
        }
      }
    },
    {
      "disclosureId": "disclosure-retirevantage14-product",
      "title": "MNL RetireVantage® 14 Annuity Disclosure Statement",
      "acknowledgmentType": "initials",
      "acknowledgmentLabel": "Owner initials confirming receipt and review of the MNL RetireVantage 14 Annuity Disclosure Statement (REQUIRED)",
      "isViewRequired": true,
      "isViewCompleted": true,
      "acknowledgedAt": "2025-06-15T14:18:30Z",
      "signature": {
        "capturedImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAH...",
        "attestation": {
          "signedAt": "2025-06-15T14:18:30Z",
          "method": "drawn",
          "isProducerWitnessed": true,
          "witnessProducerNpn": "12345678",
          "ipAddress": "198.51.100.42",
          "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
        }
      }
    },
    {
      "disclosureId": "disclosure-strategy-fee-enhanced",
      "title": "Strategy Fee Risk Disclosure",
      "acknowledgmentType": "boolean",
      "acknowledgmentLabel": "I understand that the Enhanced Participation Rate crediting strategy I have selected includes a 1.00% annual strategy fee...",
      "isViewRequired": true,
      "isViewCompleted": true,
      "acknowledgedAt": "2025-06-15T14:19:45Z",
      "signature": {
        "capturedImage": null,
        "attestation": {
          "signedAt": "2025-06-15T14:19:45Z",
          "method": "clicked",
          "isProducerWitnessed": true,
          "witnessProducerNpn": "12345678",
          "ipAddress": "198.51.100.42",
          "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
        }
      }
    }
  ],

  "applicationSignatures": {
    "isOwnerStatementAcknowledged": true,
    "isFraudWarningAcknowledged": true,
    "ownerSignature": {
      "capturedImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
      "attestation": {
        "signedAt": "2025-06-15T14:28:00Z",
        "method": "drawn",
        "isProducerWitnessed": true,
        "witnessProducerNpn": "12345678",
        "ipAddress": "198.51.100.42",
        "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
      }
    },
    "ownerSignatureDate": "2025-06-15",
    "jointOwnerSignature": null,
    "jointOwnerSignatureDate": null,
    "spouseSignature": null,
    "signedAtCity": "Springfield",
    "signedAtState": "IL",
    "ownerEmail": "jane.smith@example.com",
    "jointOwnerEmail": null
  },

  "producerCertification": {
    "isProducerAwareOfExistingInsurance": true,
    "isProducerBelievesReplacement": false,
    "replacingCompanyName": null,
    "producers": [
      {
        "index": 1,
        "producerNumber": "MN-98765",
        "npn": "12345678",
        "fullName": "Michael J. Davis",
        "email": "mdavis@figbroker.com",
        "phone": "3175550200",
        "commissionPercentage": 100,
        "commissionOption": "A",
        "signature": {
          "capturedImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
          "attestation": {
            "signedAt": "2025-06-15T14:29:15Z",
            "method": "drawn",
            "isProducerWitnessed": false,
            "witnessProducerNpn": null,
            "ipAddress": "198.51.100.42",
            "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
          }
        },
        "signatureDate": "2025-06-15"
      }
    ]
  }
}
```

---

## Validation Rules for Submission

Before a payload is accepted for transmission to a carrier, the following constraints must pass:

| Rule | Condition |
|---|---|
| Owner beneficiary percentages | Primary beneficiaries sum to 100. Contingent beneficiaries (if any) sum to 100. |
| Annuitant beneficiary percentages | Same as owner beneficiary rule, applied independently. |
| Investment allocations | All `percentage` values sum to 100. |
| Producer commissions | All `commissionPercentage` values sum to 100. |
| Transfer count consistency | `transfers` array length equals `funding.methods` count for `exchange_1035` + `direct_transfer` types. |
| All required disclosure records present | Every disclosure with `required: true` in the application definition that was visible must have a corresponding entry in `disclosures[]`. |
| Signature dates equal submission date | `ownerSignatureDate`, `producerCertification.producers[*].signatureDate`, and transfer signature dates must all equal the date portion of `envelope.submittedAt`. |
| SSN encrypted | All `EncryptedValue` fields must have `isEncrypted: true`. Plaintext SSNs are rejected. |

---

## Versioning

The `envelope.schemaVersion` field follows semver. Consumers should:
- Accept any payload with a matching major version
- Tolerate unknown fields (forward compatibility)
- Reject payloads with a higher major version than they support

Breaking changes (new required fields, type changes, renamed fields) increment the major version. Additive changes (new optional fields) increment the minor version.
