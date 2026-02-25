const SUITABILITY_ENGINE_URL =
  process.env.SUITABILITY_ENGINE_URL ||
  'https://ebjgvvpaty.us-east-1.awsapprunner.com/evaluate';

async function evaluateSuitability(applicationPayload, productParameters) {
  const response = await fetch(SUITABILITY_ENGINE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ applicationPayload, productParameters }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Suitability engine returned ${response.status}: ${text}`
    );
  }

  return response.json();
}

module.exports = { evaluateSuitability };
