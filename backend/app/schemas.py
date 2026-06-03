from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

class DeviceMetadataSchema(BaseModel):
    ip_address: str
    device_fingerprint: str
    login_time: datetime

class TransactionCreate(BaseModel):
    sender_account: str
    receiver_account: str
    amount: float = Field(gt=0, description="Amount must be greater than zero")
    timestamp: datetime
    device_metadata: DeviceMetadataSchema

class TransactionResponse(BaseModel):
    id: int
    sender_account: str
    receiver_account: str
    amount: float
    timestamp: datetime
    ip_address: str
    device_fingerprint: str
    login_time: datetime
    time_to_transfer_seconds: float
    is_device_farm_suspected: bool
    device_farm_reason: Optional[str]

    class Config:
        from_attributes = True

class AlertCreate(BaseModel):
    account_id: str
    alert_type: str
    timestamp: datetime
    description: str

class UserProfileCreate(BaseModel):
    account_id: str
    name: str
    email: str

class BlocklistEntryCreate(BaseModel):
    value: str
    type: str  # "ip" or "fingerprint"
    reason: str

class BlocklistEntryResponse(BaseModel):
    id: int
    value: str
    type: str
    blocked_at: datetime
    reason: str

    class Config:
        from_attributes = True

class RiskFactor(BaseModel):
    name: str
    description: str
    contribution: float
    status: str

class TimelineEvent(BaseModel):
    timestamp: datetime
    event_type: str  # TRANSACTION_SENT, TRANSACTION_RECEIVED, etc.
    description: str
    severity: str

class AccountRiskProfile(BaseModel):
    account_id: str
    name: str
    is_frozen: bool
    frozen_at: Optional[datetime]
    overall_risk_score: float
    risk_level: str
    factors: list[RiskFactor]
    timeline: list[TimelineEvent]
