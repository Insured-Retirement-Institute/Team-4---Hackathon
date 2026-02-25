#!/usr/bin/env python3
"""Generate realistic annual statement PDFs and upload to S3.

Generates two statement formats:
- **MNL format** (Midland National Innovator Choice 14): gold/brown branding,
  Statement Period Summary, Inception Summary, per-account detail, index performance.
- **Aspida MYGA format** (SynergyChoice MYGA): pink/navy branding, contract details,
  contract values summary, financial activity detail.

Client IDs use Redtail CRM IDs (101-104) so the prefill agent finds them.

Usage:
    cd ai-service
    source venv/Scripts/activate
    python scripts/generate_mock_statements.py
"""

from __future__ import annotations

import io
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import boto3
from botocore.exceptions import ClientError
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.config import settings

BUCKET = settings.s3_statements_bucket

# ── Color schemes ────────────────────────────────────────────────────────────

MNL_NAVY = colors.HexColor("#1a2e4a")
MNL_GOLD = colors.HexColor("#8b7028")
MNL_LIGHT_BG = colors.HexColor("#f5f0e5")
MNL_HEADER_BG = colors.HexColor("#2c4a1e")  # dark green accent

ASPIDA_NAVY = colors.HexColor("#1b2a4a")
ASPIDA_PINK = colors.HexColor("#c41e7a")
ASPIDA_LIGHT_BG = colors.HexColor("#f0e8f0")

# ── Client data (CRM IDs 101-104) ───────────────────────────────────────────

CLIENTS = {
    "101": {
        "format": "mnl",
        "name": "James Whitfield",
        "joint_owner": "Margaret Whitfield",
        "address": "2841 Sedgefield Road, Charlotte, NC 28209",
        "contract_number": "8500000101",
        "product": "Midland National Innovator Choice 14",
        "issue_date": "March 15, 2022",
        "statement_year": "2024",
        "agent_name": "Andrew Barnett",
        "agent_number": "AB-44501",
        # Statement Period Summary
        "beginning_accumulation": "$78,125.00",
        "premiums": "$0.00",
        "premium_bonus": "$0.00",
        "partial_surrenders": "$0.00",
        "interest_index_credits": "$4,225.00",
        "ending_accumulation": "$82,350.00",
        # Statement Inception Summary
        "total_premiums_paid": "$75,000.00",
        "total_premium_bonus": "$6,000.00",
        "total_withdrawals": "$0.00",
        "outstanding_loan": "$0.00",
        "surrender_value": "$68,371.50",
        "death_benefit": "$82,350.00",
        # Account detail
        "fixed_account_balance": "$25,000.00",
        "fixed_rate": "1.10%",
        "index_account_1_name": "S&P 500 Annual PtP w/ Cap",
        "index_account_1_balance": "$35,000.00",
        "index_account_1_cap": "7.00%",
        "index_account_1_credit": "5.20%",
        "index_account_2_name": "S&P 500 Monthly Average",
        "index_account_2_balance": "$22,350.00",
        "index_account_2_cap": "4.50%",
        "index_account_2_credit": "3.10%",
        "s3_year": "2024",
    },
    "102": {
        "format": "aspida",
        "name": "Catherine Morales",
        "joint_owner": None,
        "address": "87 Commonwealth Avenue, Boston, MA 02116",
        "contract_number": "AFMYA0000102",
        "product": "SynergyChoice MYGA 5",
        "plan_type": "Multi-Year Guaranteed Annuity — 5 Year",
        "issue_date": "June 1, 2023",
        "statement_year": "2024",
        "agent_name": "Andrew Barnett",
        "agent_number": "AB-44501",
        # Contract Details
        "death_benefit_type": "Contract Value",
        "guaranteed_rate": "5.00%",
        "guaranteed_until": "May 31, 2028",
        "withdrawal_charge_end": "May 31, 2028",
        "one_year_rate": "5.00%",
        "min_guaranteed_rate": "1.00%",
        "email": "c.morales@outlook.com",
        # Contract Values Summary
        "total_premium_payment": "$200,000.00",
        "beginning_contract_value": "$200,000.00",
        "total_withdrawals": "$0.00",
        "interest_credited": "$10,000.00",
        "ending_contract_value": "$210,000.00",
        "cash_surrender_value": "$193,200.00",
        "death_benefit_value": "$210,000.00",
        # Financial Activity Detail
        "activity": [
            ("06/01/2023", "Premium Receipt", "$200,000.00"),
            ("12/31/2023", "Fixed Interest Credit", "$5,000.00"),
            ("06/30/2024", "Fixed Interest Credit", "$5,000.00"),
            ("12/31/2024", "Ending Contract Value", "$210,000.00"),
        ],
        "s3_year": "2024",
    },
    "103": {
        "format": "mnl",
        "name": "Richard Hargrove",
        "joint_owner": "Diane Hargrove",
        "address": "445 Park Avenue South, New York, NY 10016",
        "contract_number": "8500000103",
        "product": "Midland National Innovator Choice 14",
        "issue_date": "January 10, 2021",
        "statement_year": "2024",
        "agent_name": "Andrew Barnett",
        "agent_number": "AB-22103",
        # Statement Period Summary
        "beginning_accumulation": "$155,625.00",
        "premiums": "$0.00",
        "premium_bonus": "$0.00",
        "partial_surrenders": "$0.00",
        "interest_index_credits": "$7,875.00",
        "ending_accumulation": "$163,500.00",
        # Statement Inception Summary
        "total_premiums_paid": "$150,000.00",
        "total_premium_bonus": "$12,000.00",
        "total_withdrawals": "$0.00",
        "outstanding_loan": "$0.00",
        "surrender_value": "$143,880.00",
        "death_benefit": "$163,500.00",
        # Account detail
        "fixed_account_balance": "$50,000.00",
        "fixed_rate": "1.10%",
        "index_account_1_name": "S&P 500 Annual PtP w/ Cap",
        "index_account_1_balance": "$70,000.00",
        "index_account_1_cap": "7.00%",
        "index_account_1_credit": "5.20%",
        "index_account_2_name": "S&P 500 Monthly Average",
        "index_account_2_balance": "$43,500.00",
        "index_account_2_cap": "4.50%",
        "index_account_2_credit": "3.10%",
        "s3_year": "2024",
    },
    "104": {
        "format": "mnl",
        "name": "Susan Pemberton",
        "joint_owner": None,
        "address": "1820 North Damen Avenue, Chicago, IL 60647",
        "contract_number": "MN-2023-00104",
        "product": "Midland National Guarantee Plus",
        "issue_date": "September 22, 2023",
        "statement_year": "2024",
        "agent_name": "Andrew Barnett",
        "agent_number": "AB-33204",
        # Statement Period Summary (simpler fixed product)
        "beginning_accumulation": "$87,975.00",
        "premiums": "$0.00",
        "premium_bonus": "$0.00",
        "partial_surrenders": "$0.00",
        "interest_index_credits": "$3,400.00",
        "ending_accumulation": "$91,375.00",
        # Statement Inception Summary
        "total_premiums_paid": "$85,000.00",
        "total_premium_bonus": "$0.00",
        "total_withdrawals": "$0.00",
        "outstanding_loan": "$0.00",
        "surrender_value": "$84,461.25",
        "death_benefit": "$91,375.00",
        # Account detail — fixed only
        "fixed_account_balance": "$91,375.00",
        "fixed_rate": "3.50%",
        "index_account_1_name": None,
        "index_account_1_balance": None,
        "index_account_1_cap": None,
        "index_account_1_credit": None,
        "index_account_2_name": None,
        "index_account_2_balance": None,
        "index_account_2_cap": None,
        "index_account_2_credit": None,
        "s3_year": "2024",
    },
}


# ── MNL Format PDF ───────────────────────────────────────────────────────────

def _build_mnl_pdf(client_id: str, data: dict) -> bytes:
    """Generate an MNL Innovator Choice / Guarantee Plus annual statement."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "MNLTitle", parent=styles["Title"],
        fontSize=15, textColor=MNL_NAVY, spaceAfter=2,
    )
    subtitle_style = ParagraphStyle(
        "MNLSubtitle", parent=styles["Normal"],
        fontSize=11, textColor=MNL_GOLD, spaceAfter=2,
    )
    section_style = ParagraphStyle(
        "MNLSection", parent=styles["Heading2"],
        fontSize=11, textColor=MNL_NAVY, spaceBefore=12, spaceAfter=4,
    )
    fine_print = ParagraphStyle(
        "MNLFine", parent=styles["Normal"],
        fontSize=7, textColor=colors.grey, leading=9,
    )

    tbl_style_base = [
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 8),
        ("FONT", (0, 1), (-1, -1), "Helvetica", 8),
        ("BACKGROUND", (0, 0), (-1, 0), MNL_LIGHT_BG),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]

    elements: list = []

    # Header
    elements.append(Paragraph("MIDLAND NATIONAL LIFE INSURANCE COMPANY", title_style))
    elements.append(Paragraph(
        f"Annual Statement &mdash; Year Ending December 31, {data['statement_year']}", subtitle_style
    ))
    elements.append(HRFlowable(width="100%", thickness=2, color=MNL_GOLD))
    elements.append(Spacer(1, 8))

    # Contract info
    joint_line = f"  |  Joint Owner: {data['joint_owner']}" if data.get("joint_owner") else ""
    info_rows = [
        ["Contract Owner:", f"{data['name']}{joint_line}"],
        ["Mailing Address:", data["address"]],
        ["Contract Number:", data["contract_number"]],
        ["Product:", data["product"]],
        ["Issue Date:", data["issue_date"]],
        ["Agent:", f"{data['agent_name']} ({data['agent_number']})"],
    ]
    info_table = Table(info_rows, colWidths=[1.6 * inch, 4.7 * inch])
    info_table.setStyle(TableStyle([
        ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 8),
        ("FONT", (1, 0), (1, -1), "Helvetica", 8),
        ("TEXTCOLOR", (0, 0), (-1, -1), MNL_NAVY),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(info_table)

    # Statement Period Summary
    elements.append(Paragraph("Statement Period Summary", section_style))
    period_rows = [
        ["", "Amount"],
        [f"Beginning Accumulation Value (01/01/{data['statement_year']})", data["beginning_accumulation"]],
        ["Premiums", data["premiums"]],
        ["Premium Bonus", data["premium_bonus"]],
        ["Partial Surrenders", data["partial_surrenders"]],
        ["Interest & Index Credits", data["interest_index_credits"]],
        [f"Ending Accumulation Value (12/31/{data['statement_year']})", data["ending_accumulation"]],
    ]
    period_table = Table(period_rows, colWidths=[4.2 * inch, 2 * inch])
    period_table.setStyle(TableStyle(tbl_style_base + [
        ("FONT", (0, -1), (-1, -1), "Helvetica-Bold", 8),
        ("BACKGROUND", (0, -1), (-1, -1), MNL_LIGHT_BG),
    ]))
    elements.append(period_table)

    # Statement Inception Summary
    elements.append(Paragraph("Statement Inception Summary (Lifetime)", section_style))
    inception_rows = [
        ["", "Amount"],
        ["Total Premiums Paid", data["total_premiums_paid"]],
        ["Total Premium Bonus", data["total_premium_bonus"]],
        ["Total Withdrawals", data["total_withdrawals"]],
        ["Outstanding Loan", data["outstanding_loan"]],
        ["Surrender Value", data["surrender_value"]],
        ["Death Benefit", data["death_benefit"]],
    ]
    inception_table = Table(inception_rows, colWidths=[4.2 * inch, 2 * inch])
    inception_table.setStyle(TableStyle(tbl_style_base))
    elements.append(inception_table)

    # Statement Period Information (per-account detail)
    elements.append(Paragraph("Statement Period Information by Account", section_style))

    acct_header = ["Account", "Beginning", "Premiums", "Interest/Credits", "Ending"]
    acct_rows = [acct_header]
    acct_rows.append([
        "Fixed Account",
        data["fixed_account_balance"],
        "$0.00",
        f"@ {data['fixed_rate']}",
        data["fixed_account_balance"],
    ])
    if data.get("index_account_1_name"):
        acct_rows.append([
            data["index_account_1_name"],
            "—",
            "$0.00",
            f"{data['index_account_1_credit']} credited",
            data["index_account_1_balance"],
        ])
    if data.get("index_account_2_name"):
        acct_rows.append([
            data["index_account_2_name"],
            "—",
            "$0.00",
            f"{data['index_account_2_credit']} credited",
            data["index_account_2_balance"],
        ])

    acct_table = Table(acct_rows, colWidths=[2 * inch, 1.1 * inch, 0.9 * inch, 1.2 * inch, 1.1 * inch])
    acct_table.setStyle(TableStyle(tbl_style_base))
    elements.append(acct_table)

    # Index Performance (if applicable)
    if data.get("index_account_1_name"):
        elements.append(Paragraph("Interest &amp; Index Performance", section_style))
        perf_header = ["Account", "Cap Rate", "Credit %"]
        perf_rows = [perf_header]
        perf_rows.append([
            data["index_account_1_name"],
            data["index_account_1_cap"],
            data["index_account_1_credit"],
        ])
        if data.get("index_account_2_name"):
            perf_rows.append([
                data["index_account_2_name"],
                data["index_account_2_cap"],
                data["index_account_2_credit"],
            ])
        perf_table = Table(perf_rows, colWidths=[2.5 * inch, 1.5 * inch, 1.5 * inch])
        perf_table.setStyle(TableStyle(tbl_style_base))
        elements.append(perf_table)

    # Footer
    elements.append(Spacer(1, 16))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "This statement is provided for informational purposes only and does not constitute "
        "a contract or amendment to your existing contract. Please refer to your contract for "
        "guaranteed values and benefits. Midland National Life Insurance Company is a subsidiary "
        "of Sammons Financial Group. Products and features may not be available in all states.",
        fine_print,
    ))
    elements.append(Spacer(1, 3))
    elements.append(Paragraph(
        "Midland National Life Insurance Company &bull; Administrative Office: "
        "One Sammons Plaza, Sioux Falls, SD 57193 &bull; (800) 733-1110 &bull; "
        "www.midlandnational.com",
        fine_print,
    ))

    doc.build(elements)
    return buf.getvalue()


# ── Aspida MYGA Format PDF ──────────────────────────────────────────────────

def _build_aspida_pdf(client_id: str, data: dict) -> bytes:
    """Generate an Aspida SynergyChoice MYGA annual statement."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "AspidaTitle", parent=styles["Title"],
        fontSize=15, textColor=ASPIDA_NAVY, spaceAfter=2,
    )
    subtitle_style = ParagraphStyle(
        "AspidaSubtitle", parent=styles["Normal"],
        fontSize=11, textColor=ASPIDA_PINK, spaceAfter=2,
    )
    section_style = ParagraphStyle(
        "AspidaSection", parent=styles["Heading2"],
        fontSize=11, textColor=ASPIDA_NAVY, spaceBefore=12, spaceAfter=4,
    )
    fine_print = ParagraphStyle(
        "AspidaFine", parent=styles["Normal"],
        fontSize=7, textColor=colors.grey, leading=9,
    )

    tbl_style_base = [
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 8),
        ("FONT", (0, 1), (-1, -1), "Helvetica", 8),
        ("BACKGROUND", (0, 0), (-1, 0), ASPIDA_LIGHT_BG),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]

    elements: list = []

    # Header
    elements.append(Paragraph("ASPIDA LIFE INSURANCE COMPANY", title_style))
    elements.append(Paragraph(
        f"Annual Contract Statement &mdash; Year Ending December 31, {data['statement_year']}",
        subtitle_style,
    ))
    elements.append(HRFlowable(width="100%", thickness=2, color=ASPIDA_PINK))
    elements.append(Spacer(1, 8))

    # Contract Details
    elements.append(Paragraph("Contract Details", section_style))
    joint_line = data.get("joint_owner") or "N/A"
    detail_rows = [
        ["Product:", data["product"]],
        ["Plan Type:", data.get("plan_type", data["product"])],
        ["Contract Number:", data["contract_number"]],
        ["Owner:", data["name"]],
        ["Joint Owner:", joint_line],
        ["Annuitant:", data["name"]],
        ["Death Benefit:", data.get("death_benefit_type", "Contract Value")],
        ["Issue Date:", data["issue_date"]],
        ["Guaranteed Interest Rate:", f"{data['guaranteed_rate']} until {data['guaranteed_until']}"],
        ["Withdrawal Charge End Date:", data["withdrawal_charge_end"]],
        ["1-Year Guaranteed Interest Rate:", data["one_year_rate"]],
        ["Minimum Guaranteed Rate:", data["min_guaranteed_rate"]],
        ["Email:", data.get("email", "")],
    ]
    detail_table = Table(detail_rows, colWidths=[2.5 * inch, 3.8 * inch])
    detail_table.setStyle(TableStyle([
        ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 8),
        ("FONT", (1, 0), (1, -1), "Helvetica", 8),
        ("TEXTCOLOR", (0, 0), (-1, -1), ASPIDA_NAVY),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#dddddd")),
    ]))
    elements.append(detail_table)

    # Contract Values Summary
    elements.append(Paragraph("Contract Values Summary", section_style))
    values_rows = [
        ["", "Amount"],
        ["Total Premium Payment", data["total_premium_payment"]],
        [f"Beginning Contract Value (01/01/{data['statement_year']})", data["beginning_contract_value"]],
        ["Total Withdrawals", data["total_withdrawals"]],
        ["Interest Credited", data["interest_credited"]],
        [f"Ending Contract Value (12/31/{data['statement_year']})", data["ending_contract_value"]],
        ["Cash Surrender Value", data["cash_surrender_value"]],
        ["Death Benefit Value", data["death_benefit_value"]],
    ]
    values_table = Table(values_rows, colWidths=[4.2 * inch, 2 * inch])
    values_table.setStyle(TableStyle(tbl_style_base + [
        ("FONT", (0, -3), (-1, -1), "Helvetica-Bold", 8),
    ]))
    elements.append(values_table)

    # Financial Activity Detail
    elements.append(Paragraph("Financial Activity Detail", section_style))
    activity_header = ["Date", "Transaction", "Amount"]
    activity_rows = [activity_header] + [list(row) for row in data.get("activity", [])]
    activity_table = Table(activity_rows, colWidths=[1.5 * inch, 3 * inch, 1.8 * inch])
    activity_table.setStyle(TableStyle(tbl_style_base))
    elements.append(activity_table)

    # Agent info
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(
        f"<b>Servicing Agent:</b> {data['agent_name']} ({data['agent_number']})",
        ParagraphStyle("AgentInfo", parent=styles["Normal"], fontSize=9, textColor=ASPIDA_NAVY),
    ))

    # Footer
    elements.append(Spacer(1, 16))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "This statement is provided for informational purposes only and does not constitute "
        "a contract or amendment to your existing contract. Please refer to your contract for "
        "guaranteed values and benefits. Aspida Life Insurance Company is a subsidiary of "
        "Global Atlantic Financial Group. Products and features may not be available in all states.",
        fine_print,
    ))
    elements.append(Spacer(1, 3))
    elements.append(Paragraph(
        "Aspida Life Insurance Company &bull; Administrative Office: "
        "200 Park Avenue, Suite 1700, New York, NY 10166 &bull; (844) 427-7432 &bull; "
        "www.aspida.com",
        fine_print,
    ))

    doc.build(elements)
    return buf.getvalue()


# ── Upload helpers ───────────────────────────────────────────────────────────

def _ensure_bucket(s3_client) -> None:
    """Create the S3 bucket if it doesn't already exist."""
    try:
        s3_client.head_bucket(Bucket=BUCKET)
        print(f"Bucket '{BUCKET}' already exists.")
    except ClientError:
        print(f"Creating bucket '{BUCKET}'...")
        s3_client.create_bucket(Bucket=BUCKET)
        print(f"Bucket '{BUCKET}' created.")


def _upload_real_pdfs(s3_client) -> None:
    """Upload real carrier PDFs as additional reference statements if they exist."""
    real_dir = os.path.join(os.path.dirname(__file__), "..", "data", "real-statements")
    uploads = [
        ("Sullivan_MYGA7_AnnualStatement_2027.pdf", "statements/102/2027-annual-statement.pdf"),
        ("MNLDummyStatement.pdf", "statements/101/2025-annual-statement.pdf"),
    ]
    for filename, s3_key in uploads:
        filepath = os.path.join(real_dir, filename)
        if os.path.exists(filepath):
            with open(filepath, "rb") as f:
                pdf_bytes = f.read()
            s3_client.put_object(Bucket=BUCKET, Key=s3_key, Body=pdf_bytes, ContentType="application/pdf")
            print(f"Uploaded real PDF: {s3_key} ({len(pdf_bytes):,} bytes)")
        else:
            print(f"Skipping {filename} (not found at {filepath})")


def main() -> None:
    kwargs = {"region_name": settings.aws_region}
    if settings.aws_access_key_id:
        kwargs["aws_access_key_id"] = settings.aws_access_key_id
    if settings.aws_secret_access_key:
        kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
    if settings.aws_session_token:
        kwargs["aws_session_token"] = settings.aws_session_token

    s3 = boto3.client("s3", **kwargs)

    _ensure_bucket(s3)

    for client_id, data in CLIENTS.items():
        if data["format"] == "aspida":
            pdf_bytes = _build_aspida_pdf(client_id, data)
        else:
            pdf_bytes = _build_mnl_pdf(client_id, data)

        key = f"statements/{client_id}/{data['s3_year']}-annual-statement.pdf"
        s3.put_object(Bucket=BUCKET, Key=key, Body=pdf_bytes, ContentType="application/pdf")
        print(f"Uploaded {key} ({len(pdf_bytes):,} bytes) [{data['format'].upper()} format]")

    # Upload real PDFs if available
    _upload_real_pdfs(s3)

    print(f"\nDone! {len(CLIENTS)} statements uploaded to s3://{BUCKET}/statements/")


if __name__ == "__main__":
    main()
