const fs = require('fs');
const path = require('path');
const docusign = require('docusign-esign');

async function getJwtAccessTokenAndAccountContext() {
  const apiClient = new docusign.ApiClient();
  apiClient.setOAuthBasePath(process.env.DOCUSIGN_AUTH_SERVER);

  const privateKey = fs.readFileSync(process.env.DOCUSIGN_PRIVATE_KEY_PATH);

  const token = await apiClient.requestJWTUserToken(
    process.env.DOCUSIGN_INTEGRATION_KEY,
    process.env.DOCUSIGN_USER_ID,
    'signature impersonation',
    privateKey,
    3600
  );

  const accessToken = token.body.access_token;
  const userInfo = await apiClient.getUserInfo(accessToken);

  const accounts = userInfo?.accounts || [];
  const acct =
    accounts.find((a) => a.is_default === 'true' || a.is_default === true) ||
    accounts[0];

  if (!acct) {
    throw new Error(
      'No DocuSign accounts returned from getUserInfo(). userInfo=' +
        JSON.stringify(userInfo)
    );
  }

  const accountId = acct.accountId || acct.account_id;
  const baseUri = acct.baseUri || acct.base_uri;

  if (!accountId) {
    throw new Error('Could not determine accountId from: ' + JSON.stringify(acct));
  }
  if (!baseUri) {
    throw new Error('Could not determine baseUri from: ' + JSON.stringify(acct));
  }

  const basePath = `${baseUri}/restapi`;

  return { apiClient, accessToken, accountId, basePath };
}

async function startEmbeddedSigning({ applicationId, signerEmail, signerName }) {
  const { apiClient, accessToken, accountId, basePath } =
    await getJwtAccessTokenAndAccountContext();

  apiClient.setBasePath(basePath);
  apiClient.addDefaultHeader('Authorization', `Bearer ${accessToken}`);

  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  const pdfPath = path.join(__dirname, '..', '..', 'Assets', 'sample.pdf');
  if (!fs.existsSync(pdfPath)) {
    throw new Error(
      `Missing PDF at ${pdfPath}. Put a file at backend/Assets/sample.pdf`
    );
  }

  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBytes.toString('base64');
  if (!pdfBase64 || pdfBase64.length < 100) {
    throw new Error('PDF base64 looks too small; sample.pdf may be invalid.');
  }

  const clientUserId = `${applicationId}-signer-1`;

  const document = docusign.Document.constructFromObject({
    documentBase64: pdfBase64,
    name: 'Annuity Application',
    fileExtension: 'pdf',
    documentId: '1'
  });

  const signHere = docusign.SignHere.constructFromObject({
    documentId: '1',
    pageNumber: '1',
    xPosition: '160',
    yPosition: '650'
  });

  const tabs = docusign.Tabs.constructFromObject({
    signHereTabs: [signHere]
  });

  const signer = docusign.Signer.constructFromObject({
    email: signerEmail,
    name: signerName,
    recipientId: '1',
    clientUserId,
    tabs
  });

  const recipients = docusign.Recipients.constructFromObject({
    signers: [signer]
  });

  const envelopeDefinition = docusign.EnvelopeDefinition.constructFromObject({
    emailSubject: 'Please sign your annuity application',
    documents: [document],
    recipients,
    status: 'sent'
  });

  const envelope = await envelopesApi.createEnvelope(accountId, { envelopeDefinition });

  const returnUrl = process.env.DOCUSIGN_RETURN_URL;
  if (!returnUrl) {
    throw new Error('DOCUSIGN_RETURN_URL is not configured.');
  }

  const viewRequest = docusign.RecipientViewRequest.constructFromObject({
    returnUrl,
    authenticationMethod: 'none',
    email: signerEmail,
    userName: signerName,
    clientUserId
  });

  const view = await envelopesApi.createRecipientView(accountId, envelope.envelopeId, {
    recipientViewRequest: viewRequest
  });

  return { envelopeId: envelope.envelopeId, signingUrl: view.url };
}

module.exports = {
  startEmbeddedSigning
};