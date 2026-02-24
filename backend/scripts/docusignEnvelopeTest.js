require("dotenv").config();
const fs = require("fs");
const path = require("path");
const docusign = require("docusign-esign");

async function getJwtAccessToken() {
  const apiClient = new docusign.ApiClient();
  apiClient.setOAuthBasePath(process.env.DOCUSIGN_AUTH_SERVER);

  const privateKey = fs.readFileSync(process.env.DOCUSIGN_PRIVATE_KEY_PATH);

  const token = await apiClient.requestJWTUserToken(
    process.env.DOCUSIGN_INTEGRATION_KEY,
    process.env.DOCUSIGN_USER_ID,
    "signature impersonation",
    privateKey,
    3600
  );

  return { apiClient, accessToken: token.body.access_token };
}

async function main() {
  const { apiClient, accessToken } = await getJwtAccessToken();

  // Important: set basePath AFTER auth (demo env)
  apiClient.setBasePath(process.env.DOCUSIGN_BASE_PATH);
  apiClient.addDefaultHeader("Authorization", `Bearer ${accessToken}`);

  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  // Load PDF
  const pdfPath = path.join(__dirname, "..", "Assets", "sample.pdf");
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBytes.toString("base64");

  const signerEmail = process.env.DOCUSIGN_SIGNER_EMAIL;
  const signerName = process.env.DOCUSIGN_SIGNER_NAME;
  const clientUserId = "signer-1"; // required for embedded signing

  // Document
  const document = new docusign.Document.constructFromObject({
    documentBase64: pdfBase64,
    name: "Annuity Application",
    fileExtension: "pdf",
    documentId: "1",
  });

  // Tabs (put a SignHere on page 1)
  const signHere = docusign.SignHere.constructFromObject({
    documentId: "1",
    pageNumber: "1",
    xPosition: "160",
    yPosition: "650",
  });

  const tabs = docusign.Tabs.constructFromObject({
    signHereTabs: [signHere],
  });

  // Recipient
  const signer = docusign.Signer.constructFromObject({
    email: signerEmail,
    name: signerName,
    recipientId: "1",
    clientUserId, // embedded signing
    tabs,
  });

  const recipients = docusign.Recipients.constructFromObject({
    signers: [signer],
  });

  // Envelope
  const envelopeDefinition = docusign.EnvelopeDefinition.constructFromObject({
    emailSubject: "Please sign your annuity application",
    documents: [document],
    recipients,
    status: "sent", // "created" would save as draft
  });

  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;

  const envelope = await envelopesApi.createEnvelope(accountId, {
    envelopeDefinition,
  });

  console.log("Envelope created:", envelope.envelopeId);

  // Recipient View (embedded signing URL)
  const viewRequest = docusign.RecipientViewRequest.constructFromObject({
    returnUrl: process.env.DOCUSIGN_RETURN_URL,
    authenticationMethod: "none",
    email: signerEmail,
    userName: signerName,
    clientUserId,
  });

  const view = await envelopesApi.createRecipientView(accountId, envelope.envelopeId, {
    recipientViewRequest: viewRequest,
  });

  console.log("Embedded signing URL:\n", view.url);
}

main().catch((e) => {
  const body = e?.response?.data || e;
  console.error("Envelope test error:", body);
  process.exit(1);
});