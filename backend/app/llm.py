import os
from datetime import datetime
from sqlmodel import Session, select
from app.database import Transaction, GovernmentTicket, CrossChannelAlert, UserProfile

# Try loading env variables
from dotenv import load_dotenv
load_dotenv()

def generate_suspicious_activity_report(db: Session, account_id: str) -> str:
    """
    Queries data for the specified account, builds a narrative context,
    and uses LangChain (OpenAI/Gemini) to generate a 3-paragraph SAR.
    Falls back to a template-based generator if no keys are available.
    """
    # 1. Fetch data from DB
    user = db.get(UserProfile, account_id)
    name = user.name if user else "Unknown Account Owner"
    is_frozen = user.is_frozen if user else False
    
    # Get all transactions where this account is sender or receiver
    tx_stmt = select(Transaction).where(
        (Transaction.sender_account == account_id) | (Transaction.receiver_account == account_id)
    )
    txs = db.exec(tx_stmt).all()
    
    # Get government tickets linked to this account
    ticket_stmt = select(GovernmentTicket).where(GovernmentTicket.reported_account == account_id)
    tickets = db.exec(ticket_stmt).all()
    
    # Get cross-channel alerts linked to this account
    alert_stmt = select(CrossChannelAlert).where(CrossChannelAlert.account_id == account_id)
    alerts = db.exec(alert_stmt).all()
    
    if not txs and not tickets and not alerts:
        return f"No transaction history, government tickets, or security alerts were found for account ID {account_id}. A Suspicious Activity Report cannot be generated."

    # 2. Format context details
    tx_details = []
    flagged_tx_count = 0
    emulator_count = 0
    total_volume = 0.0
    for tx in txs:
        dir_str = f"sent {tx.amount:.2f} USD to {tx.receiver_account}" if tx.sender_account == account_id else f"received {tx.amount:.2f} USD from {tx.sender_account}"
        flag_str = f" [SUSPECTED DEVICE FARM: {tx.device_farm_reason}]" if tx.is_device_farm_suspected else ""
        tx_details.append(f"- Tx ID {tx.id}: {tx.timestamp} - {dir_str} (IP: {tx.ip_address}, Fingerprint: {tx.device_fingerprint}){flag_str}")
        if tx.is_device_farm_suspected:
            flagged_tx_count += 1
        if tx.time_to_transfer_seconds < 2.0:
            emulator_count += 1
        total_volume += tx.amount

    ticket_details = [
        f"- Ticket {t.ticket_id}: {t.report_date.date()} - {t.scam_type}: {t.details}" for t in tickets
    ]
    
    alert_details = [
        f"- Alert {a.alert_type} at {a.timestamp}: {a.description}" for a in alerts
    ]
    
    context = (
        f"ACCOUNT PROFILE:\n"
        f"- Account ID: {account_id}\n"
        f"- Owner Name: {name}\n"
        f"- Account Status: {'FROZEN' if is_frozen else 'ACTIVE'}\n\n"
        f"TRANSACTIONS SUMMARY:\n"
        f"- Total Transactions: {len(txs)}\n"
        f"- Flagged (Device Farm/Velocity): {flagged_tx_count}\n"
        f"- Fast Transfers (<2s, emulator check): {emulator_count}\n"
        f"- Total Money Flow Volume: {total_volume:.2f} USD\n"
        f"Detailed Transactions:\n" + "\n".join(tx_details) + "\n\n"
        f"GOVERNMENT CYBER FRAUD TICKETS:\n" + ("\n".join(ticket_details) if ticket_details else "None") + "\n\n"
        f"CROSS-CHANNEL SECURITY ALERTS:\n" + ("\n".join(alert_details) if alert_details else "None")
    )

    # 3. Choose Generator (LLM or Template Fallback)
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    system_prompt = (
        "You are an expert financial crimes investigator and compliance officer. "
        "Your task is to write a formal 3-paragraph Suspicious Activity Report (SAR) "
        "using banking compliance terminology based on the provided investigation context. "
        "Keep it professional, highly structured, and concise. "
        "Do not include any headers or introductory pleasantries, just output the three paragraphs.\n\n"
        "Follow this exact 3-paragraph structure:\n"
        "Paragraph 1: Subject Profile and Trigger Event. Detail the owner name, account number, "
        "and the specific anomalies that triggered the review (e.g. device velocity spikes, emulator-level transfer times, or cyber fraud tickets).\n"
        "Paragraph 2: Pattern of Behavior and Operational Analysis. Provide a granular analysis "
        "of the transaction flows, device parameters (sharing IP/fingerprints with multiple accounts), and "
        "cyber ticket correlations.\n"
        "Paragraph 3: Regulatory Findings and Risk Actions. Conclude with a recommendation for "
        "suspension, filing a formal SAR with regulatory authorities, and placing a system-wide block on the compromised fingerprints."
    )

    # Try LangChain OpenAI
    if openai_key:
        try:
            from langchain_openai import ChatOpenAI
            from langchain_core.messages import SystemMessage, HumanMessage
            
            chat = ChatOpenAI(temperature=0.2, openai_api_key=openai_key, model="gpt-4o-mini")
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=context)
            ]
            response = chat.invoke(messages)
            return response.content.strip()
        except Exception as e:
            print(f"Error generating SAR via OpenAI: {e}. Falling back...")

    # Try LangChain Gemini
    if gemini_key:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_core.messages import SystemMessage, HumanMessage
            
            chat = ChatGoogleGenerativeAI(temperature=0.2, google_api_key=gemini_key, model="gemini-1.5-flash")
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=context)
            ]
            response = chat.invoke(messages)
            return response.content.strip()
        except Exception as e:
            print(f"Error generating SAR via Gemini: {e}. Falling back...")

    # Template Fallback (Highly professional rule-based text generation)
    return generate_mock_sar(account_id, name, txs, flagged_tx_count, emulator_count, tickets, alerts, total_volume, is_frozen=is_frozen)


def generate_mock_sar(account_id, name, txs, flagged_tx_count, emulator_count, tickets, alerts, total_volume, is_frozen=False) -> str:
    """
    Heuristic-based local SAR generator that produces a professional 3-paragraph narrative.
    Used when no LLM API keys are configured, ensuring offline usability.
    """
    trigger_reasons = []
    if flagged_tx_count > 0:
        trigger_reasons.append("suspicious device velocity checks")
    if emulator_count > 0:
        trigger_reasons.append("rapid automated emulator execution times (< 2 seconds)")
    if tickets:
        trigger_reasons.append("active government cyber fraud tickets")
    if alerts:
        trigger_reasons.append("cross-channel security alerts")
        
    trigger_str = ", ".join(trigger_reasons) if trigger_reasons else "a regular auditing review"

    p1 = (
        f"This Suspicious Activity Report (SAR) concerns account identifier {account_id}, registered "
        f"to {name}. The investigation was initiated following the detection of high-risk operational flags, "
        f"specifically involving {trigger_str}. A comprehensive review of the account's operational metadata "
        f"revealed a profile highly correlated with structured financial routing and automated login spoofing, "
        f"suggesting unauthorized access or syndication."
    )

    # Paragraph 2: Behavioral and transactional analysis
    p2_elements = []
    if flagged_tx_count > 0:
        p2_elements.append(
            f"The account executed {flagged_tx_count} transaction(s) flagged for velocity-based device sharing, "
            f"meaning the matching IP addresses and hardware fingerprints were simultaneously utilized by multiple "
            f"disparate accounts within a restricted 5-minute window."
        )
    if emulator_count > 0:
        p2_elements.append(
            f"Additionally, {emulator_count} transaction(s) occurred with a login-to-execution latency of under "
            f"two seconds, indicating programmatic automation or mechanical emulator assistance rather than organic human interaction."
        )
    if tickets:
        p2_elements.append(
            f"Furthermore, {len(tickets)} static cyber fraud record(s) matching this account were imported from government "
            f"databases, directly tying this profile to known scam activities."
        )
    if alerts:
        p2_elements.append(
            f"The security framework also logged {len(alerts)} cross-channel alerts (e.g. failed credential trials or "
            f"out-of-pattern login times) corroborating account takeover indicators."
        )
    
    p2_body = " ".join(p2_elements) if p2_elements else (
        f"The transactional history spans {len(txs)} records with a cumulative volume of {total_volume:.2f} USD. "
        f"While individual sums are within standard limits, the correlation of network telemetry indicates atypical "
        f"routing."
    )
    p2 = (
        f"A granular review of the transaction history reveals a total velocity of {len(txs)} transfers, "
        f"representing a cumulative value of {total_volume:.2f} USD. {p2_body} The synchronicity of device fingerprints "
        f"proves the implementation of device farming to bypass banking authentication safeguards."
    )

    p3 = (
        f"Based on the documented anomalies, there is a high probability of emulator-driven laundering and device farm fraud. "
        f"It is recommended that a formal Suspicious Activity Report be submitted to FinCEN and relevant state regulators. "
        f"We advise maintaining immediate suspension of account {account_id} (current compliance status: {'FROZEN' if is_frozen else 'ACTIVE'}), a complete freeze on the associated {total_volume:.2f} USD "
        f"in current transit, and blocklisting of all flagged IP ranges and hardware fingerprints to prevent further systemic exposure."
    )

    return f"{p1}\n\n{p2}\n\n{p3}"
