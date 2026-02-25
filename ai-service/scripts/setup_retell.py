"""One-time Retell AI setup: create LLM config, agent, and buy phone number.

Usage:
    cd ai-service
    source venv/Scripts/activate
    RETELL_API_KEY=key_... python scripts/setup_retell.py

After running, store the output values in SSM or .env:
    RETELL_AGENT_ID=<agent_id>
    RETELL_PHONE_NUMBER=<phone_number>
"""
from __future__ import annotations

import json
import os
import sys

import httpx

RETELL_API_KEY = os.environ.get("RETELL_API_KEY", "")
if not RETELL_API_KEY:
    print("ERROR: Set RETELL_API_KEY environment variable before running.")
    sys.exit(1)

BASE_URL = "https://api.retellai.com"
HEADERS = {
    "Authorization": f"Bearer {RETELL_API_KEY}",
    "Content-Type": "application/json",
}

SYSTEM_PROMPT = """\
You are a friendly and professional assistant calling on behalf of {{advisor_name}}, \
a financial advisor. You are calling {{client_name}} to collect some missing information \
needed to complete their annuity application.

Be warm, conversational, and respectful of the client's time. Explain that their \
advisor is working on their application and just needs a few more details.

Here are the specific fields you need to collect:
{{missing_fields_prompt}}

For each field:
1. Ask clearly and naturally (e.g., "Could you confirm your annual income for me?")
2. Confirm the value back to the client
3. Move to the next field

Once you have collected all the information, thank the client and let them know \
their advisor will be in touch.

Important guidelines:
- Never use emojis
- Be concise but warm
- If the client is unsure about a field, note that and move on
- Do not discuss specific product recommendations or give financial advice
- If asked about the product, say their advisor will explain the details
"""


def main():
    client = httpx.Client(timeout=30)

    # 1. Create Retell LLM config
    print("Creating Retell LLM config...")
    llm_resp = client.post(
        f"{BASE_URL}/create-retell-llm",
        headers=HEADERS,
        json={
            "general_prompt": SYSTEM_PROMPT,
            "general_tools": [
                {
                    "type": "end_call",
                    "name": "end_call",
                    "description": "End the call after collecting all fields or if the client wants to stop.",
                },
            ],
        },
    )
    llm_resp.raise_for_status()
    llm_data = llm_resp.json()
    llm_id = llm_data["llm_id"]
    print(f"  LLM ID: {llm_id}")

    # 2. Create Agent
    print("Creating Retell agent...")
    agent_resp = client.post(
        f"{BASE_URL}/create-agent",
        headers=HEADERS,
        json={
            "response_engine": {"type": "retell-llm", "llm_id": llm_id},
            "agent_name": "IRI Annuity Data Collection Agent",
            "voice_id": "11labs-Adrian",
            "language": "en-US",
            "enable_backchannel": True,
            "post_call_analysis_data": [
                {
                    "name": "collected_fields",
                    "type": "string",
                    "description": 'A JSON string mapping field IDs to the values collected during the call. '
                    'Use the field IDs from missing_fields_prompt. Format: {"field_id": "value", ...}',
                },
            ],
        },
    )
    agent_resp.raise_for_status()
    agent_data = agent_resp.json()
    agent_id = agent_data["agent_id"]
    print(f"  Agent ID: {agent_id}")

    # 3. Buy phone number
    print("Buying phone number (area code 704)...")
    phone_resp = client.post(
        f"{BASE_URL}/create-phone-number",
        headers=HEADERS,
        json={
            "agent_id": agent_id,
            "area_code": 704,
        },
    )
    phone_resp.raise_for_status()
    phone_data = phone_resp.json()
    phone_number = phone_data["phone_number"]
    print(f"  Phone Number: {phone_number}")

    # Summary
    print("\n" + "=" * 60)
    print("Setup complete! Add these to your .env or SSM Parameter Store:")
    print(f"  RETELL_AGENT_ID={agent_id}")
    print(f"  RETELL_PHONE_NUMBER={phone_number}")
    print("=" * 60)

    # Also store as SSM commands
    print("\nSSM commands:")
    print(f'  aws ssm put-parameter --name RETELL_AGENT_ID --value "{agent_id}" --type String --overwrite')
    print(f'  aws ssm put-parameter --name RETELL_PHONE_NUMBER --value "{phone_number}" --type String --overwrite')


if __name__ == "__main__":
    main()
