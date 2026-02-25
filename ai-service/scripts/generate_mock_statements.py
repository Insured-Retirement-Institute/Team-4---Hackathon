#!/usr/bin/env python3
"""Generate realistic annual statement PDFs and upload to S3.

Usage:
    cd ai-service
    source venv/Scripts/activate
    python scripts/generate_mock_statements.py
"""

from __future__ import annotations

import io
import os
import sys

# Allow running from ai-service/ directory
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

CLIENTS = {
    "client_001": {
        "name": "John Smith",
        "address": "123 Oak Lane, Hartford, CT 06103",
        "contract_number": "MN-2019-78432",
        "product": "Midland National Guarantee Plus Fixed Annuity",
        "issue_date": "April 15, 2019",
        "beginning_balance": "$120,625.00",
        "premiums_received": "$0.00",
        "total_premiums_paid": "$100,000.00",
        "interest_credited": "$4,375.00",
        "withdrawals": "$0.00",
        "ending_balance": "$125,000.00",
        "accumulated_value": "$125,000.00",
        "surrender_value": "$121,250.00",
        "death_benefit": "$125,000.00",
        "guaranteed_minimum": "$108,500.00",
        "current_rate": "3.50%",
        "guaranteed_rate": "1.50%",
        "beneficiary_name": "Sarah Smith",
        "beneficiary_relationship": "Spouse",
        "beneficiary_share": "100%",
    },
    "client_002": {
        "name": "Maria Garcia",
        "address": "456 Maple Drive, Boston, MA 02101",
        "contract_number": "MN-2020-91256",
        "product": "Midland National Guarantee Plus Fixed Annuity",
        "issue_date": "January 10, 2020",
        "beginning_balance": "$240,000.00",
        "premiums_received": "$0.00",
        "total_premiums_paid": "$200,000.00",
        "interest_credited": "$10,000.00",
        "withdrawals": "$0.00",
        "ending_balance": "$250,000.00",
        "accumulated_value": "$250,000.00",
        "surrender_value": "$245,000.00",
        "death_benefit": "$250,000.00",
        "guaranteed_minimum": "$218,000.00",
        "current_rate": "4.00%",
        "guaranteed_rate": "1.75%",
        "beneficiary_name": "Carlos Garcia",
        "beneficiary_relationship": "Spouse",
        "beneficiary_share": "100%",
    },
    "client_003": {
        "name": "Robert Chen",
        "address": "789 Elm Street, New York, NY 10001",
        "contract_number": "MN-2021-34789",
        "product": "Midland National Guarantee Plus Fixed Annuity",
        "issue_date": "June 1, 2021",
        "beginning_balance": "$477,500.00",
        "premiums_received": "$0.00",
        "total_premiums_paid": "$400,000.00",
        "interest_credited": "$22,500.00",
        "withdrawals": "$0.00",
        "ending_balance": "$500,000.00",
        "accumulated_value": "$500,000.00",
        "surrender_value": "$487,500.00",
        "death_benefit": "$500,000.00",
        "guaranteed_minimum": "$424,000.00",
        "current_rate": "4.50%",
        "guaranteed_rate": "2.00%",
        "beneficiary_name": "Linda Chen",
        "beneficiary_relationship": "Spouse",
        "beneficiary_share": "100%",
    },
    "client_004": {
        "name": "Patricia Williams",
        "address": "1010 Pine Avenue, Chicago, IL 60601",
        "contract_number": "MN-2018-56123",
        "product": "Midland National Guarantee Plus Fixed Annuity",
        "issue_date": "September 22, 2018",
        "beginning_balance": "$82,450.00",
        "premiums_received": "$0.00",
        "total_premiums_paid": "$75,000.00",
        "interest_credited": "$2,550.00",
        "withdrawals": "$0.00",
        "ending_balance": "$85,000.00",
        "accumulated_value": "$85,000.00",
        "surrender_value": "$83,300.00",
        "death_benefit": "$85,000.00",
        "guaranteed_minimum": "$81,750.00",
        "current_rate": "3.00%",
        "guaranteed_rate": "1.25%",
        "beneficiary_name": "James Williams",
        "beneficiary_relationship": "Son",
        "beneficiary_share": "100%",
    },
}


def _build_pdf(client_id: str, data: dict) -> bytes:
    """Generate a single annual statement PDF and return as bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "StatementTitle",
        parent=styles["Title"],
        fontSize=16,
        textColor=colors.HexColor("#1a3c6e"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "StatementSubtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#333333"),
        spaceAfter=2,
    )
    section_style = ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=colors.HexColor("#1a3c6e"),
        spaceBefore=14,
        spaceAfter=6,
        borderWidth=0,
    )
    body = ParagraphStyle(
        "BodyText2",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
    )
    fine_print = ParagraphStyle(
        "FinePrint",
        parent=styles["Normal"],
        fontSize=7,
        textColor=colors.grey,
        leading=9,
    )

    elements: list = []

    # Header
    elements.append(Paragraph("Midland National Life Insurance Company", title_style))
    elements.append(Paragraph("Annual Statement &mdash; Year Ending December 31, 2024", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#1a3c6e")))
    elements.append(Spacer(1, 12))

    # Policy holder info
    elements.append(Paragraph("Policy Holder Information", section_style))
    info_data = [
        ["Contract Owner:", data["name"]],
        ["Mailing Address:", data["address"]],
        ["Contract Number:", data["contract_number"]],
        ["Product:", data["product"]],
        ["Issue Date:", data["issue_date"]],
    ]
    info_table = Table(info_data, colWidths=[1.8 * inch, 4.5 * inch])
    info_table.setStyle(TableStyle([
        ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 9),
        ("FONT", (1, 0), (1, -1), "Helvetica", 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#333333")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(info_table)

    # Account summary
    elements.append(Paragraph("Account Activity Summary", section_style))
    activity_data = [
        ["", "Amount"],
        ["Beginning Balance (01/01/2024)", data["beginning_balance"]],
        ["Premiums Received", data["premiums_received"]],
        ["Interest Credited", data["interest_credited"]],
        ["Withdrawals", data["withdrawals"]],
        ["Ending Balance (12/31/2024)", data["ending_balance"]],
    ]
    activity_table = Table(activity_data, colWidths=[4 * inch, 2 * inch])
    activity_table.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 9),
        ("FONT", (0, 1), (-1, -1), "Helvetica", 9),
        ("FONT", (0, -1), (-1, -1), "Helvetica-Bold", 9),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef5")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e8eef5")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(activity_table)

    # Contract values
    elements.append(Paragraph("Contract Values as of December 31, 2024", section_style))
    values_data = [
        ["Accumulated Value", data["accumulated_value"]],
        ["Surrender Value", data["surrender_value"]],
        ["Death Benefit", data["death_benefit"]],
        ["Guaranteed Minimum Value", data["guaranteed_minimum"]],
    ]
    values_table = Table(values_data, colWidths=[4 * inch, 2 * inch])
    values_table.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(values_table)

    # Interest rates
    elements.append(Paragraph("Interest Rate Information", section_style))
    rate_data = [
        ["Current Credited Rate", data["current_rate"]],
        ["Guaranteed Minimum Rate", data["guaranteed_rate"]],
    ]
    rate_table = Table(rate_data, colWidths=[4 * inch, 2 * inch])
    rate_table.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(rate_table)

    # Beneficiary
    elements.append(Paragraph("Beneficiary Designation", section_style))
    ben_data = [
        ["Type", "Name", "Relationship", "Share"],
        ["Primary", data["beneficiary_name"], data["beneficiary_relationship"], data["beneficiary_share"]],
    ]
    ben_table = Table(ben_data, colWidths=[1 * inch, 2.5 * inch, 1.5 * inch, 1 * inch])
    ben_table.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 9),
        ("FONT", (0, 1), (-1, -1), "Helvetica", 9),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef5")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(ben_table)

    # Total premiums paid
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(
        f"<b>Total Premiums Paid to Date:</b> {data['total_premiums_paid']}",
        body,
    ))

    # Footer
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(
        "This statement is provided for informational purposes only and does not constitute "
        "a contract or amendment to your existing contract. Please refer to your contract for "
        "guaranteed values and benefits. Midland National Life Insurance Company is a subsidiary "
        "of Sammons Financial Group. Products and features may not be available in all states. "
        "Contract Form Series: MN-FA-2018.",
        fine_print,
    ))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "Midland National Life Insurance Company &bull; Administrative Office: "
        "One Sammons Plaza, Sioux Falls, SD 57193 &bull; (800) 733-1110 &bull; "
        "www.midlandnational.com",
        fine_print,
    ))

    doc.build(elements)
    return buf.getvalue()


def _ensure_bucket(s3_client) -> None:
    """Create the S3 bucket if it doesn't already exist."""
    try:
        s3_client.head_bucket(Bucket=BUCKET)
        print(f"Bucket '{BUCKET}' already exists.")
    except ClientError:
        print(f"Creating bucket '{BUCKET}'...")
        s3_client.create_bucket(Bucket=BUCKET)
        print(f"Bucket '{BUCKET}' created.")


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
        pdf_bytes = _build_pdf(client_id, data)
        key = f"statements/{client_id}/2024-annual-statement.pdf"
        s3.put_object(Bucket=BUCKET, Key=key, Body=pdf_bytes, ContentType="application/pdf")
        print(f"Uploaded {key} ({len(pdf_bytes):,} bytes)")

    print(f"\nDone! {len(CLIENTS)} statements uploaded to s3://{BUCKET}/statements/")


if __name__ == "__main__":
    main()
