const CARRIER_API_BASE_URL =
  process.env.CARRIER_API_BASE_URL ||
  'https://iz2b4jzga7.us-east-1.awsapprunner.com';

const TIMEOUT_MS = 30_000;

/**
 * Submit the full ApplicationSubmission payload to the carrier API.
 * Returns { submissionId, applicationId, policyNumber, received }.
 */
async function submitToCarrier(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${CARRIER_API_BASE_URL}/applications/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const err = new Error(`Carrier API responded with ${response.status}`);
      err.status = response.status;
      err.body = body;
      throw err;
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { submitToCarrier };
