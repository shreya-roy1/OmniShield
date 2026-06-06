import io
import csv
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, select, func

from app.database import init_db, get_session, UserProfile, Transaction, GovernmentTicket, CrossChannelAlert, BlocklistEntry, engine
from app.schemas import (
    TransactionCreate, TransactionResponse, AlertCreate, UserProfileCreate,
    BlocklistEntryCreate, BlocklistEntryResponse, AccountRiskProfile, RiskFactor, TimelineEvent
)
from app.detector import evaluate_transaction
from app.llm import generate_suspicious_activity_report
from app.mule_classifier import load_model, predict_mule_score, get_random_test_sample

app = FastAPI(title="OmniShield Fraud Detection API", version="1.0.0")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()
    load_model()

@app.post("/api/user-profiles", response_model=UserProfile)
def create_user_profile(profile: UserProfileCreate, db: Session = Depends(get_session)):
    db_profile = db.get(UserProfile, profile.account_id)
    if db_profile:
        raise HTTPException(status_code=400, detail="Account already exists")
    new_profile = UserProfile(account_id=profile.account_id, name=profile.name, email=profile.email)
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    return new_profile

@app.get("/api/user-profiles", response_model=List[UserProfile])
def list_user_profiles(db: Session = Depends(get_session)):
    return db.exec(select(UserProfile)).all()

@app.post("/api/transactions", response_model=TransactionResponse)
def ingest_transaction(tx_in: TransactionCreate, db: Session = Depends(get_session)):
    # 1. Ensure user profiles exist, if not create mock ones to make ingestion smooth
    for acc in [tx_in.sender_account, tx_in.receiver_account]:
        if not db.get(UserProfile, acc):
            new_prof = UserProfile(account_id=acc, name=f"Mock User {acc[-4:] if len(acc) > 4 else acc}", email=f"{acc}@bank-mock.com")
            db.add(new_prof)
    
    # 2. Run heuristics
    is_device_farm, time_to_transfer, reason = evaluate_transaction(db, tx_in)
    
    # 3. Create database entry
    db_tx = Transaction(
        sender_account=tx_in.sender_account,
        receiver_account=tx_in.receiver_account,
        amount=tx_in.amount,
        timestamp=tx_in.timestamp,
        ip_address=tx_in.device_metadata.ip_address,
        device_fingerprint=tx_in.device_metadata.device_fingerprint,
        login_time=tx_in.device_metadata.login_time,
        time_to_transfer_seconds=time_to_transfer,
        is_device_farm_suspected=is_device_farm,
        device_farm_reason=reason
    )
    
    db.add(db_tx)
    db.commit()
    db.refresh(db_tx)
    return db_tx

@app.get("/api/transactions", response_model=List[TransactionResponse])
def list_transactions(limit: int = 20, db: Session = Depends(get_session)):
    return db.exec(select(Transaction).order_by(Transaction.timestamp.desc()).limit(limit)).all()

@app.post("/api/upload-government-tickets")
async def upload_government_tickets(file: UploadFile = File(...), db: Session = Depends(get_session)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
        
    contents = await file.read()
    decoded = contents.decode('utf-8')
    csv_reader = csv.DictReader(io.StringIO(decoded))
    
    # Required CSV fields: ticket_id, reported_account, scam_type, report_date, details
    # Sample header: ticket_id,reported_account,scam_type,report_date,details
    tickets_added = 0
    for row in csv_reader:
        try:
            # Check if ticket already exists
            ticket_id = row.get("ticket_id")
            if not ticket_id:
                continue
            
            existing = db.get(GovernmentTicket, ticket_id)
            if existing:
                continue
                
            report_date = datetime.fromisoformat(row.get("report_date", datetime.utcnow().isoformat()))
            
            ticket = GovernmentTicket(
                ticket_id=ticket_id,
                reported_account=row.get("reported_account"),
                scam_type=row.get("scam_type", "General Fraud"),
                report_date=report_date,
                details=row.get("details", "")
            )
            db.add(ticket)
            tickets_added += 1
        except Exception as e:
            # Skip malformed lines
            continue
            
    db.commit()
    return {"message": "CSV uploaded successfully", "records_imported": tickets_added}

@app.post("/api/alerts")
def ingest_alert(alert_in: AlertCreate, db: Session = Depends(get_session)):
    alert = CrossChannelAlert(
        account_id=alert_in.account_id,
        alert_type=alert_in.alert_type,
        timestamp=alert_in.timestamp,
        description=alert_in.description
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert

@app.get("/api/generate-sar/{account_id}")
def generate_sar(account_id: str, db: Session = Depends(get_session)):
    # Validate account existence
    user = db.get(UserProfile, account_id)
    if not user:
        # Check if transactions exists for this account, if yes generate it, otherwise raise
        tx_check = db.exec(select(Transaction).where(
            (Transaction.sender_account == account_id) | (Transaction.receiver_account == account_id)
        )).first()
        if not tx_check:
            raise HTTPException(status_code=404, detail="Account not found and has no transaction history")
            
    report = generate_suspicious_activity_report(db, account_id)
    return {"account_id": account_id, "report": report}

@app.get("/api/network-graph")
def get_network_graph(db: Session = Depends(get_session)):
    """
    Constructs graph payload where nodes represent accounts and edges represent transactions.
    Highlights accounts/nodes in red if they have suspected transactions.
    """
    txs = db.exec(select(Transaction)).all()
    profiles = db.exec(select(UserProfile)).all()
    tickets = db.exec(select(GovernmentTicket)).all()
    alerts = db.exec(select(CrossChannelAlert)).all()
    
    # Store set of suspected accounts
    suspected_accounts = set()
    for tx in txs:
        if tx.is_device_farm_suspected:
            suspected_accounts.add(tx.sender_account)
            
    # Also suspect accounts from tickets/alerts for broader visualization
    ticket_accounts = {t.reported_account for t in tickets}
    alert_accounts = {a.account_id for a in alerts}
    
    # Map accounts present in transactions, profiles, tickets, or alerts
    active_accounts = set()
    for tx in txs:
        active_accounts.add(tx.sender_account)
        active_accounts.add(tx.receiver_account)
    for p in profiles:
        active_accounts.add(p.account_id)
    for t in ticket_accounts:
        active_accounts.add(t)
    for a in alert_accounts:
        active_accounts.add(a)
        
    profile_map = {p.account_id: p for p in profiles}
    
    nodes = []
    for acc in active_accounts:
        p = profile_map.get(acc)
        name = p.name if p else f"Account {acc[-4:] if len(acc) > 4 else acc}"
        is_frozen = p.is_frozen if p else False
        
        # Determine classification
        is_suspected = acc in suspected_accounts
        is_cyber_flagged = acc in ticket_accounts
        is_alert_flagged = acc in alert_accounts
        
        # Simple dynamic risk calculation for node display
        node_score = 0.0
        if is_suspected:
            node_score += 40.0
        if is_cyber_flagged:
            node_score += 10.0
        if is_alert_flagged:
            node_score += 20.0
        if is_frozen:
            node_score = 100.0
            
        nodes.append({
            "id": acc,
            "label": f"{name} ({acc})",
            "name": name,
            "is_device_farm_suspected": is_suspected,
            "is_cyber_flagged": is_cyber_flagged,
            "is_alert_flagged": is_alert_flagged,
            "is_frozen": is_frozen,
            "risk_score": node_score,
            # Size of node increases with risk severity
            "val": 5 if is_frozen else (4 if (is_suspected or is_cyber_flagged or is_alert_flagged) else 2)
        })
        
    links = []
    # Deduplicate transaction flows between same parties for graph lines
    flow_map = {}
    for tx in txs:
        key = (tx.sender_account, tx.receiver_account)
        if key not in flow_map:
            flow_map[key] = {
                "source": tx.sender_account,
                "target": tx.receiver_account,
                "amount": 0.0,
                "count": 0,
                "is_device_farm_suspected": False
            }
        flow_map[key]["amount"] += tx.amount
        flow_map[key]["count"] += 1
        if tx.is_device_farm_suspected:
            flow_map[key]["is_device_farm_suspected"] = True
            
    for link in flow_map.values():
        links.append(link)
        
    return {"nodes": nodes, "links": links}

@app.get("/api/statistics")
def get_statistics(db: Session = Depends(get_session)):
    tx_count = db.exec(select(func.count(Transaction.id))).one()
    suspected_tx_count = db.exec(select(func.count(Transaction.id)).where(Transaction.is_device_farm_suspected == True)).one()
    ticket_count = db.exec(select(func.count(GovernmentTicket.ticket_id))).one()
    alert_count = db.exec(select(func.count(CrossChannelAlert.id))).one()
    
    # Calculate total fraud volume
    total_fraud_volume = db.exec(
        select(func.sum(Transaction.amount)).where(Transaction.is_device_farm_suspected == True)
    ).one() or 0.0
    
    # Active suspected devices (unique fingerprints)
    suspected_devices = db.exec(
        select(func.count(func.distinct(Transaction.device_fingerprint))).where(Transaction.is_device_farm_suspected == True)
    ).one() or 0
    
    return {
        "total_transactions": tx_count,
        "suspected_transactions": suspected_tx_count,
        "government_tickets": ticket_count,
        "cross_channel_alerts": alert_count,
        "total_fraud_volume": total_fraud_volume,
        "suspected_devices": suspected_devices
    }

@app.get("/api/user-profiles/{account_id}/risk-profile", response_model=AccountRiskProfile)
def get_account_risk_profile(account_id: str, db: Session = Depends(get_session)):
    user = db.get(UserProfile, account_id)
    if not user:
        tx_check = db.exec(select(Transaction).where(
            (Transaction.sender_account == account_id) | (Transaction.receiver_account == account_id)
        )).first()
        if not tx_check:
            raise HTTPException(status_code=404, detail="Account not found and has no history")
        user = UserProfile(account_id=account_id, name=f"Mock User {account_id[-4:]}", email=f"{account_id}@bank-mock.com")
        db.add(user)
        db.commit()
        db.refresh(user)

    txs = db.exec(select(Transaction).where(
        (Transaction.sender_account == account_id) | (Transaction.receiver_account == account_id)
    )).all()
    tickets = db.exec(select(GovernmentTicket).where(GovernmentTicket.reported_account == account_id)).all()
    alerts = db.exec(select(CrossChannelAlert).where(CrossChannelAlert.account_id == account_id)).all()
    blocklist = db.exec(select(BlocklistEntry)).all()
    blocked_values = {b.value: b for b in blocklist}

    factors = []

    # 1. Device Velocity Analysis (Max 40)
    velocity_contrib = 0.0
    velocity_msg = "No recent velocity exceptions recorded."
    velocity_status = "CLEAN"
    
    vel_txs = [t for t in txs if t.is_device_farm_suspected and "Velocity" in (t.device_farm_reason or "")]
    if vel_txs:
        velocity_contrib = 40.0
        velocity_status = "CRITICAL"
        velocity_msg = f"Velocity check failed: Multiple accounts linked to same IP/Fingerprint within 5 min window (affects {len(vel_txs)} transactions)."
    
    factors.append(RiskFactor(
        name="Device Velocity Analysis",
        description=velocity_msg,
        contribution=velocity_contrib,
        status=velocity_status
    ))

    # 2. Automation Latency (Max 30)
    emulator_contrib = 0.0
    emulator_msg = "Transaction latencies within human tolerances (> 2.0s)."
    emulator_status = "CLEAN"
    
    fast_txs = [t for t in txs if t.time_to_transfer_seconds < 2.0]
    if fast_txs:
        emulator_contrib = 30.0
        emulator_status = "CRITICAL"
        emulator_msg = f"Emulator activity suspected: {len(fast_txs)} transfer(s) executed in under 2 seconds post-login, indicating automated execution."
    
    factors.append(RiskFactor(
        name="Automation Latency (Emulator Check)",
        description=emulator_msg,
        contribution=emulator_contrib,
        status=emulator_status
    ))

    # 3. Cross-Channel Alerts (Max 20)
    alerts_contrib = 0.0
    alerts_msg = "No external security exceptions or failed logins logged."
    alerts_status = "CLEAN"
    
    if alerts:
        alerts_contrib = min(20.0, len(alerts) * 10.0)
        alerts_status = "WARNING" if len(alerts) == 1 else "CRITICAL"
        alerts_msg = f"Security exceptions detected: {len(alerts)} cross-channel alerts (e.g. failed password attempts, geo-jumps) registered."
        
    factors.append(RiskFactor(
        name="Cross-Channel Alerts",
        description=alerts_msg,
        contribution=alerts_contrib,
        status=alerts_status
    ))

    # 4. Government Intelligence Reports (Max 10)
    tickets_contrib = 0.0
    tickets_msg = "No cyber fraud reports filed by external agencies."
    tickets_status = "CLEAN"
    
    if tickets:
        tickets_contrib = 10.0
        tickets_status = "CRITICAL"
        tickets_msg = f"Government agency alert: Account flagged in {len(tickets)} cyber fraud reports (e.g. phishing, crypto coercion)."

    factors.append(RiskFactor(
        name="Government Intelligence Reports",
        description=tickets_msg,
        contribution=tickets_contrib,
        status=tickets_status
    ))

    # 5. Telemetry Blocklist Matches (Max 50)
    blocklist_contrib = 0.0
    blocklist_msg = "Device telemetry (IP and fingerprint) is currently clean."
    blocklist_status = "CLEAN"
    
    blocked_ips = []
    blocked_fgs = []
    for tx in txs:
        if tx.ip_address in blocked_values:
            blocked_ips.append(tx.ip_address)
        if tx.device_fingerprint in blocked_values:
            blocked_fgs.append(tx.device_fingerprint)
            
    if blocked_ips or blocked_fgs:
        blocklist_contrib = 50.0
        blocklist_status = "CRITICAL"
        matches_desc = []
        if blocked_ips:
            matches_desc.append(f"IPs: {', '.join(set(blocked_ips))}")
        if blocked_fgs:
            matches_desc.append(f"Fingerprints: {', '.join(set(blocked_fgs))}")
        blocklist_msg = f"Blocklisted telemetry matched: Account has transacted using blocked components ({' | '.join(matches_desc)})."

    factors.append(RiskFactor(
        name="Telemetry Blocklist Matches",
        description=blocklist_msg,
        contribution=blocklist_contrib,
        status=blocklist_status
    ))

    total_score = velocity_contrib + emulator_contrib + alerts_contrib + tickets_contrib + blocklist_contrib
    overall_score = min(100.0, total_score)
    
    if user.is_frozen:
        overall_score = 100.0

    if overall_score == 0:
        risk_level = "CLEAN"
    elif overall_score < 40:
        risk_level = "LOW"
    elif overall_score < 70:
        risk_level = "MEDIUM"
    elif overall_score < 90:
        risk_level = "HIGH"
    else:
        risk_level = "CRITICAL"

    timeline = []
    
    for t in txs:
        is_incoming = t.receiver_account == account_id
        direction = "received" if is_incoming else "sent"
        counterparty = t.sender_account if is_incoming else t.receiver_account
        flag_desc = " [SUSPECTED DEVICE FARM]" if t.is_device_farm_suspected else ""
        
        timeline.append(TimelineEvent(
            timestamp=t.timestamp,
            event_type="TRANSACTION_RECEIVED" if is_incoming else "TRANSACTION_SENT",
            description=f"Transaction of {t.amount:.2f} USD {direction} {counterparty} from IP {t.ip_address}{flag_desc}",
            severity="CRITICAL" if t.is_device_farm_suspected else "INFO"
        ))
        
    for tk in tickets:
        timeline.append(TimelineEvent(
            timestamp=tk.report_date,
            event_type="CYBER_TICKET",
            description=f"Flagged in cyber fraud report {tk.ticket_id} ({tk.scam_type}): {tk.details}",
            severity="CRITICAL"
        ))
        
    for al in alerts:
        timeline.append(TimelineEvent(
            timestamp=al.timestamp,
            event_type="SECURITY_ALERT",
            description=f"Cross-channel alert ({al.alert_type}): {al.description}",
            severity="WARNING"
        ))
        
    if user.is_frozen and user.frozen_at:
        timeline.append(TimelineEvent(
            timestamp=user.frozen_at,
            event_type="STATUS_CHANGE",
            description="Compliance Action: Account has been FROZEN by security compliance team.",
            severity="CRITICAL"
        ))
        
    timeline.sort(key=lambda x: x.timestamp, reverse=True)

    return AccountRiskProfile(
        account_id=account_id,
        name=user.name,
        is_frozen=user.is_frozen,
        frozen_at=user.frozen_at,
        overall_risk_score=overall_score,
        risk_level=risk_level,
        factors=factors,
        timeline=timeline
    )

@app.post("/api/ml-classify")
def classify_mule(payload: dict):
    try:
        result = predict_mule_score(payload)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/ml-sample")
def ml_sample():
    try:
        sample = get_random_test_sample()
        return sample
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/user-profiles/{account_id}/freeze")
def freeze_user_profile(account_id: str, db: Session = Depends(get_session)):
    user = db.get(UserProfile, account_id)
    if not user:
        tx_check = db.exec(select(Transaction).where(
            (Transaction.sender_account == account_id) | (Transaction.receiver_account == account_id)
        )).first()
        if not tx_check:
            raise HTTPException(status_code=404, detail="Account not found")
        user = UserProfile(account_id=account_id, name=f"Mock User {account_id[-4:]}", email=f"{account_id}@bank-mock.com")
        db.add(user)

    user.is_frozen = not user.is_frozen
    user.frozen_at = datetime.utcnow() if user.is_frozen else None
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"account_id": account_id, "is_frozen": user.is_frozen, "frozen_at": user.frozen_at}

@app.post("/api/blocklist", response_model=BlocklistEntryResponse)
def add_to_blocklist(entry: BlocklistEntryCreate, db: Session = Depends(get_session)):
    existing = db.exec(select(BlocklistEntry).where(BlocklistEntry.value == entry.value)).first()
    if existing:
        return existing
        
    db_entry = BlocklistEntry(
        value=entry.value,
        type=entry.type,
        reason=entry.reason
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

@app.get("/api/blocklist", response_model=List[BlocklistEntryResponse])
def get_blocklist(db: Session = Depends(get_session)):
    return db.exec(select(BlocklistEntry)).all()

@app.post("/api/seed-mock-data")
def seed_mock_data(db: Session = Depends(get_session)):
    # 1. Clear existing database rows (for clean reseed if desired)
    db.exec(select(Transaction)).all() # triggers loading
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    
    # 2. Seed User Profiles
    profiles = [
        UserProfile(account_id="ACC_001", name="John Doe (Retail)", email="john.doe@gmail.com"),
        UserProfile(account_id="ACC_002", name="Jane Smith (Merchant)", email="jane.smith@store.com"),
        UserProfile(account_id="ACC_003", name="Alice Johnson (High-Net-Worth)", email="alice.j@corp.com"),
        UserProfile(account_id="ACC_004", name="Device Farm Acct A", email="df_acct_a@fraud.net"),
        UserProfile(account_id="ACC_005", name="Device Farm Acct B", email="df_acct_b@fraud.net"),
        UserProfile(account_id="ACC_006", name="Device Farm Acct C", email="df_acct_c@fraud.net"),
        UserProfile(account_id="ACC_007", name="Fast Emulator Acct", email="fast_emu@botnet.net", is_frozen=True, frozen_at=datetime.utcnow() - timedelta(hours=1)),
        UserProfile(account_id="ACC_008", name="Gov Flagged Acct", email="reported_gov@scammer.net"),
    ]
    for p in profiles:
        db.add(p)
        
    # Seed Initial Blocklist Entries
    blocklist_entries = [
        BlocklistEntry(value="198.51.100.99", type="ip", reason="Identified in automated credit card trials"),
        BlocklistEntry(value="banned_fingerprint_botnet", type="fingerprint", reason="Associated with programmatic multi-accounting"),
    ]
    for b in blocklist_entries:
        db.add(b)
        
    db.commit()
    
    now = datetime.utcnow()
    
    # 3. Seed Transactions
    # Normal transaction flow
    db.add(Transaction(
        sender_account="ACC_001", receiver_account="ACC_002", amount=150.00,
        timestamp=now - timedelta(hours=10), ip_address="192.168.1.50",
        device_fingerprint="device_iphone_12_normal", login_time=now - timedelta(hours=10, minutes=5),
        time_to_transfer_seconds=300.0, is_device_farm_suspected=False
    ))
    
    db.add(Transaction(
        sender_account="ACC_003", receiver_account="ACC_002", amount=5000.00,
        timestamp=now - timedelta(hours=5), ip_address="203.0.113.12",
        device_fingerprint="device_macbook_pro_normal", login_time=now - timedelta(hours=5, minutes=10),
        time_to_transfer_seconds=600.0, is_device_farm_suspected=False
    ))
    
    # Emulator Check Trigger: login to transfer < 2s
    db.add(Transaction(
        sender_account="ACC_007", receiver_account="ACC_002", amount=850.00,
        timestamp=now - timedelta(hours=2), ip_address="198.51.100.8",
        device_fingerprint="device_emulator_android_x86", login_time=now - timedelta(hours=2) - timedelta(milliseconds=750),
        time_to_transfer_seconds=0.75, is_device_farm_suspected=True,
        device_farm_reason="Time-to-transfer is ultra-fast: 0.75s (< 2s)"
    ))
    
    # Device Farm Trigger (Velocity check: multiple unique accounts on same IP within 5 mins)
    # Target details: same IP "198.51.100.22", same fingerprint "df_fingerprint_xyz"
    db.add(Transaction(
        sender_account="ACC_004", receiver_account="ACC_002", amount=1200.00,
        timestamp=now - timedelta(minutes=4), ip_address="198.51.100.22",
        device_fingerprint="df_fingerprint_xyz", login_time=now - timedelta(minutes=4, seconds=45),
        time_to_transfer_seconds=45.0, is_device_farm_suspected=False
    ))
    # This one will trigger the velocity check because ACC_005 is different from ACC_004 on same telemetry
    is_df_2, ttt_2, reason_2 = evaluate_transaction(db, TransactionCreate(
        sender_account="ACC_005", receiver_account="ACC_002", amount=950.00,
        timestamp=now - timedelta(minutes=3), device_metadata={
            "ip_address": "198.51.100.22",
            "device_fingerprint": "df_fingerprint_xyz",
            "login_time": (now - timedelta(minutes=3, seconds=30))
        }
    ))
    db.add(Transaction(
        sender_account="ACC_005", receiver_account="ACC_002", amount=950.00,
        timestamp=now - timedelta(minutes=3), ip_address="198.51.100.22",
        device_fingerprint="df_fingerprint_xyz", login_time=now - timedelta(minutes=3, seconds=30),
        time_to_transfer_seconds=30.0, is_device_farm_suspected=is_df_2,
        device_farm_reason=reason_2
    ))
    
    # This one also triggers
    is_df_3, ttt_3, reason_3 = evaluate_transaction(db, TransactionCreate(
        sender_account="ACC_006", receiver_account="ACC_002", amount=1100.00,
        timestamp=now - timedelta(minutes=2), device_metadata={
            "ip_address": "198.51.100.22",
            "device_fingerprint": "df_fingerprint_xyz",
            "login_time": (now - timedelta(minutes=2, seconds=15))
        }
    ))
    db.add(Transaction(
        sender_account="ACC_006", receiver_account="ACC_002", amount=1100.00,
        timestamp=now - timedelta(minutes=2), ip_address="198.51.100.22",
        device_fingerprint="df_fingerprint_xyz", login_time=now - timedelta(minutes=2, seconds=15),
        time_to_transfer_seconds=15.0, is_device_farm_suspected=is_df_3,
        device_farm_reason=reason_3
    ))
    
    # 4. Seed Government Cyber Fraud Tickets
    db.add(GovernmentTicket(
        ticket_id="TKT-88492", reported_account="ACC_008",
        scam_type="Crypto Investment Phishing",
        report_date=now - timedelta(days=3),
        details="Subject reported that they were coerced into sending savings to ACC_008, advertised as a zero-risk high yield crypto fund."
    ))
    
    # 5. Seed Cross-Channel Security Alerts
    db.add(CrossChannelAlert(
        account_id="ACC_007", alert_type="Multiple Failed Logins",
        timestamp=now - timedelta(hours=2, minutes=10),
        description="5 consecutive password failures followed by rapid password reset and successful device registration."
    ))
    
    db.add(CrossChannelAlert(
        account_id="ACC_005", alert_type="Out-of-Country Geolocation Jump",
        timestamp=now - timedelta(minutes=15),
        description="Login occurred from USA IP address immediately following session activity from UK IP address."
    ))
    
    db.commit()
    return {"message": "Mock data seeded successfully with normal, velocity-flagged, and emulator-flagged transfers"}

