//
// Creates a DocuSign envelope in DEMO and returns an embedded signing URL.
// Requirements:
// - backend/.env contains DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_AUTH_SERVER,
//   DOCUSIGN_PRIVATE_KEY_PATH, DOCUSIGN_RETURN_URL, DOCUSIGN_SIGNER_EMAIL, DOCUSIGN_SIGNER_NAME
// - backend/Assets/sample.pdf exists (any PDF)
// - Consent already granted for signature + impersonation

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const docusign = require("docusign-esign");

async function getJwtAccessTokenAndAccountContext() {
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

  const accessToken = token.body.access_token;

  const userInfo = await apiClient.getUserInfo(accessToken);

  const accounts = userInfo?.accounts || [];
  const acct =
    accounts.find((a) => a.is_default === "true" || a.is_default === true) ||
    accounts[0];

  if (!acct) {
    throw new Error(
      "No DocuSign accounts returned from getUserInfo(). userInfo=" +
        JSON.stringify(userInfo)
    );
  }

  const accountId = acct.accountId || acct.account_id;
  const baseUri = acct.baseUri || acct.base_uri;

  if (!accountId) {
    throw new Error("Could not determine accountId from: " + JSON.stringify(acct));
  }
  if (!baseUri) {
    throw new Error("Could not determine baseUri from: " + JSON.stringify(acct));
  }

  const basePath = `${baseUri}/restapi`;

  return { apiClient, accessToken, accountId, basePath };
}

async function main() {
  const { apiClient, accessToken, accountId, basePath } =
    await getJwtAccessTokenAndAccountContext();

  apiClient.setBasePath(basePath);
  apiClient.addDefaultHeader("Authorization", `Bearer ${accessToken}`);

  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  // Load PDF to sign
  const pdfPath = path.join(__dirname, "..", "Assets", "sample.pdf");
  if (!fs.existsSync(pdfPath)) {
    throw new Error(
      `Missing PDF at ${pdfPath}. Put a file at backend/Assets/sample.pdf`
    );
  }

  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBytes.toString("base64");
  if (!pdfBase64 || pdfBase64.length < 100) {
    throw new Error("PDF base64 looks too small; sample.pdf may be invalid.");
  }

  const signerEmail = process.env.DOCUSIGN_SIGNER_EMAIL;
  const signerName = process.env.DOCUSIGN_SIGNER_NAME;
  if (!signerEmail || !signerName) {
    throw new Error(
      "Missing DOCUSIGN_SIGNER_EMAIL or DOCUSIGN_SIGNER_NAME in backend/.env"
    );
  }

  const clientUserId = "signer-1"; // required for embedded signing

  const document = docusign.Document.constructFromObject({
    documentBase64: pdfBase64,
    name: "Annuity Application",
    fileExtension: "pdf",
    documentId: "1",
  });

  const signHere = docusign.SignHere.constructFromObject({
    documentId: "1",
    pageNumber: "1",
    xPosition: "160",
    yPosition: "650",
  });

  const tabs = docusign.Tabs.constructFromObject({
    signHereTabs: [signHere],
  });

  const signer = docusign.Signer.constructFromObject({
    email: signerEmail,
    name: signerName,
    recipientId: "1",
    clientUserId,
    tabs,
  });

  const recipients = docusign.Recipients.constructFromObject({
    signers: [signer],
  });

  const envelopeDefinition = docusign.EnvelopeDefinition.constructFromObject({
    emailSubject: "Please sign your annuity application",
    documents: [document],
    recipients,
    status: "sent",
  });

  // IMPORTANT: In this SDK build, createEnvelope expects the wrapper object
  const envelope = await envelopesApi.createEnvelope(accountId, { envelopeDefinition });

  console.log("Envelope created:", envelope.envelopeId);
  console.log("Account:", accountId);
  console.log("BasePath:", basePath);

  // Create embedded signing URL
  const returnUrl =
    process.env.DOCUSIGN_RETURN_URL || "http://localhost:5173/docusign/return";

  const viewRequest = docusign.RecipientViewRequest.constructFromObject({
    returnUrl,
    authenticationMethod: "none",
    email: signerEmail,
    userName: signerName,
    clientUserId,
  });

  const view = await envelopesApi.createRecipientView(accountId, envelope.envelopeId, {
    recipientViewRequest: viewRequest,
  });

  console.log("\nEmbedded signing URL:\n" + view.url + "\n");
  console.log("After signing, DocuSign will redirect to:", returnUrl);
}

main().catch((e) => {
  const body = e?.response?.data || e?.response?.body || e;
  console.error("Envelope test error:", body);
  process.exit(1);
});