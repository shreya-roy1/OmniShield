from datetime import timedelta
from sqlmodel import Session, select
from app.database import Transaction, BlocklistEntry
from app.schemas import TransactionCreate

def evaluate_transaction(db: Session, tx_in: TransactionCreate) -> tuple[bool, float, str]:
    """
    Evaluates a transaction for suspicious device farm or emulator behavior.
    Returns:
        is_device_farm_suspected (bool)
        time_to_transfer_seconds (float)
        device_farm_reason (str or None)
    """
    is_suspected = False
    reasons = []

    # 0. Blocklist check: check if IP or fingerprint is blocked
    blocked_matches = db.exec(
        select(BlocklistEntry).where(
            (BlocklistEntry.value == tx_in.device_metadata.ip_address) |
            (BlocklistEntry.value == tx_in.device_metadata.device_fingerprint)
        )
    ).all()
    if blocked_matches:
        is_suspected = True
        for match in blocked_matches:
            reasons.append(f"Telemetry blocklisted ({match.type}): {match.value} (Reason: {match.reason})")

    # 1. Emulator check: time-to-transfer under 2 seconds
    time_to_transfer = (tx_in.timestamp - tx_in.device_metadata.login_time).total_seconds()
    if time_to_transfer < 0:
        # Handle time sync issues gracefully, set to 0
        time_to_transfer = 0.0
        
    if time_to_transfer < 2.0:
        is_suspected = True
        reasons.append(f"Time-to-transfer is ultra-fast: {time_to_transfer:.2f}s (< 2s)")

    # 2. Velocity check: multiple unique accounts on same IP or device fingerprint in 5 mins
    five_minutes_ago = tx_in.timestamp - timedelta(minutes=5)
    
    # Query database for transactions within the last 5 minutes from same IP or device fingerprint
    stmt = select(Transaction).where(
        (Transaction.timestamp >= five_minutes_ago) &
        (Transaction.timestamp <= tx_in.timestamp) &
        (
            (Transaction.ip_address == tx_in.device_metadata.ip_address) |
            (Transaction.device_fingerprint == tx_in.device_metadata.device_fingerprint)
        )
    )
    matching_txs = db.exec(stmt).all()
    
    # Extract unique sender accounts
    unique_senders = {t.sender_account for t in matching_txs}
    unique_senders.add(tx_in.sender_account)
    
    if len(unique_senders) > 1:
        is_suspected = True
        reasons.append(
            f"Velocity check failed: {len(unique_senders)} unique accounts ({', '.join(unique_senders)}) "
            f"linked to IP {tx_in.device_metadata.ip_address} or fingerprint {tx_in.device_metadata.device_fingerprint} within 5 min"
        )
        
        # Retroactive flagging: Flag previous transactions in the window that weren't flagged
        for matching_tx in matching_txs:
            if not matching_tx.is_device_farm_suspected:
                matching_tx.is_device_farm_suspected = True
                retro_reason = f"Retroactively flagged: Velocity link to new transfer from {tx_in.sender_account}"
                matching_tx.device_farm_reason = (
                    f"{matching_tx.device_farm_reason} | {retro_reason}"
                    if matching_tx.device_farm_reason else retro_reason
                )
                db.add(matching_tx)
        
    reason_str = " | ".join(reasons) if is_suspected else None
    return is_suspected, time_to_transfer, reason_str
