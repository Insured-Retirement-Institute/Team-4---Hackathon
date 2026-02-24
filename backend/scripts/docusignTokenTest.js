require("dotenv").config();
const fs = require("fs");
const docusign = require("docusign-esign");

async function main() {
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

  console.log("JWT success. Token starts with:", token.body.access_token.slice(0, 20) + "...");
}

main().catch((e) => {
  console.error("JWT token error:", e?.response?.body || e);
  process.exit(1);
});