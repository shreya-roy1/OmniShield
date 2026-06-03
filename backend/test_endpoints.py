import time
import requests
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def run_tests():
    print("=== OMNISHIELD BACKEND INTEGRATION TESTS ===")
    
    # 1. Ping / API status
    try:
        requests.get(BASE_URL)
    except requests.exceptions.ConnectionError:
        print(f"Error: Backend is not running at {BASE_URL}. Start it first!")
        return

    # 2. Seed Mock Data
    print("\n[Test 1] Seeding mock database...")
    res = requests.post(f"{BASE_URL}/api/seed-mock-data")
    assert res.status_code == 200, f"Seed failed: {res.text}"
    print("[OK] Mock data seeded successfully.")
    
    # 3. Check Statistics
    print("\n[Test 2] Verifying initial statistics...")
    res = requests.get(f"{BASE_URL}/api/statistics")
    assert res.status_code == 200
    stats = res.json()
    print(f"Stats returned: {stats}")
    assert stats["total_transactions"] >= 5, "Total transactions count mismatch"
    assert stats["suspected_transactions"] >= 3, "Suspected transactions count mismatch"
    assert stats["government_tickets"] >= 1, "Government tickets count mismatch"
    assert stats["cross_channel_alerts"] >= 2, "Cross-channel alerts count mismatch"
    print("[OK] Statistics validated.")

    # 4. Check Network Graph data structure
    print("\n[Test 3] Verifying network graph endpoint...")
    res = requests.get(f"{BASE_URL}/api/network-graph")
    assert res.status_code == 200
    graph = res.json()
    print(f"Nodes in graph: {len(graph['nodes'])}, Links: {len(graph['links'])}")
    assert len(graph["nodes"]) > 0, "No nodes returned"
    assert len(graph["links"]) > 0, "No links returned"
    
    # Validate suspected flag propagation in graph nodes
    suspected_node_ids = [node["id"] for node in graph["nodes"] if node["is_device_farm_suspected"]]
    print(f"Suspected nodes in graph: {suspected_node_ids}")
    assert "ACC_007" in suspected_node_ids or "ACC_005" in suspected_node_ids, "Suspected nodes missing in graph"
    print("[OK] Graph data structure validated.")

    # 5. Ingest normal transaction
    print("\n[Test 4] Simulating standard user transaction...")
    now = datetime.utcnow()
    tx_normal = {
        "sender_account": "ACC_TEST_NORMAL_1",
        "receiver_account": "ACC_002",
        "amount": 200.00,
        "timestamp": now.isoformat(),
        "device_metadata": {
          "ip_address": "192.168.1.150",
          "device_fingerprint": "clean_fingerprint_iphone",
          "login_time": (now - timedelta(minutes=5)).isoformat()
        }
    }
    res = requests.post(f"{BASE_URL}/api/transactions", json=tx_normal)
    assert res.status_code == 200
    tx_res = res.json()
    print(f"Transaction response: is_device_farm_suspected = {tx_res['is_device_farm_suspected']}")
    assert not tx_res["is_device_farm_suspected"], "Normal transaction flagged incorrectly"
    print("[OK] Normal transaction verified.")

    # 6. Ingest Emulator transaction (login time to transfer < 2s)
    print("\n[Test 5] Simulating emulator bot transaction (latency = 0.5s)...")
    tx_emu = {
        "sender_account": "ACC_TEST_EMU",
        "receiver_account": "ACC_002",
        "amount": 400.00,
        "timestamp": now.isoformat(),
        "device_metadata": {
          "ip_address": "192.168.1.160",
          "device_fingerprint": "emu_fingerprint",
          "login_time": (now - timedelta(milliseconds=500)).isoformat()
        }
    }
    res = requests.post(f"{BASE_URL}/api/transactions", json=tx_emu)
    assert res.status_code == 200
    tx_res = res.json()
    print(f"Transaction response: is_device_farm_suspected = {tx_res['is_device_farm_suspected']}, reason = {tx_res['device_farm_reason']}")
    assert tx_res["is_device_farm_suspected"], "Emulator transaction not flagged"
    assert "Time-to-transfer is ultra-fast" in tx_res["device_farm_reason"], "Incorrect emulator flag reason"
    print("[OK] Emulator heuristic check verified.")

    # 7. Ingest Velocity transaction (multiple accounts same IP in 5 min)
    print("\n[Test 6] Simulating device farm velocity check (2 unique accounts on same telemetry within 5m)...")
    telemetry = {
        "ip_address": "203.0.113.99",
        "device_fingerprint": "shared_fingerprint_velocity_test",
        "login_time": (now - timedelta(minutes=2)).isoformat()
      }
    
    # Tx 1: User A
    tx_vel_1 = {
        "sender_account": "ACC_VEL_USER_A",
        "receiver_account": "ACC_002",
        "amount": 100.00,
        "timestamp": (now - timedelta(minutes=1)).isoformat(),
        "device_metadata": telemetry
    }
    res1 = requests.post(f"{BASE_URL}/api/transactions", json=tx_vel_1)
    assert res1.status_code == 200
    tx_res1 = res1.json()
    print(f"Tx 1 (ACC_VEL_USER_A) initial flag: {tx_res1['is_device_farm_suspected']}")
    # This might not be flagged yet if it's the first account on that IP
    
    # Tx 2: User B (Same IP/Fingerprint 1 minute later)
    tx_vel_2 = {
        "sender_account": "ACC_VEL_USER_B",
        "receiver_account": "ACC_002",
        "amount": 150.00,
        "timestamp": now.isoformat(),
        "device_metadata": telemetry
    }
    res2 = requests.post(f"{BASE_URL}/api/transactions", json=tx_vel_2)
    assert res2.status_code == 200
    tx_res2 = res2.json()
    print(f"Tx 2 (ACC_VEL_USER_B) flag: {tx_res2['is_device_farm_suspected']}, reason = {tx_res2['device_farm_reason']}")
    assert tx_res2["is_device_farm_suspected"], "Velocity transaction not flagged"
    assert "Velocity check failed" in tx_res2["device_farm_reason"], "Incorrect velocity flag reason"
    
    # Check if Tx 1 was retroactively flagged
    res_graph = requests.get(f"{BASE_URL}/api/network-graph")
    graph_data = res_graph.json()
    suspected_node_ids = [node["id"] for node in graph_data["nodes"] if node["is_device_farm_suspected"]]
    print(f"Verify retroactive flagging: ACC_VEL_USER_A is_device_farm_suspected = {'ACC_VEL_USER_A' in suspected_node_ids}")
    assert "ACC_VEL_USER_A" in suspected_node_ids, "Retroactive velocity flagging failed"
    print("[OK] Velocity heuristic check & retroactive flagging verified.")

    # 8. Generate SAR Report
    print("\n[Test 7] Verifying Suspicious Activity Report (SAR) compiler...")
    res = requests.get(f"{BASE_URL}/api/generate-sar/ACC_005")
    assert res.status_code == 200
    sar = res.json()
    print(f"Generated SAR character count: {len(sar['report'])}")
    paragraphs = [p for p in sar["report"].split("\n\n") if p.strip()]
    print(f"Report has {len(paragraphs)} paragraphs (Target: 3)")
    assert len(paragraphs) == 3, f"SAR report is not exactly 3 paragraphs! Found {len(paragraphs)}"
    print("[OK] SAR report format verified.")

    # 9. Test Freezing Profile
    print("\n[Test 8] Testing account freezing mechanism...")
    res = requests.post(f"{BASE_URL}/api/user-profiles/ACC_001/freeze")
    assert res.status_code == 200
    freeze_data = res.json()
    assert freeze_data["is_frozen"] == True
    print("Account ACC_001 frozen.")

    # Check risk profile of frozen account
    res = requests.get(f"{BASE_URL}/api/user-profiles/ACC_001/risk-profile")
    assert res.status_code == 200
    risk_prof = res.json()
    assert risk_prof["is_frozen"] == True
    assert risk_prof["overall_risk_score"] == 100.0
    print("Risk profile of frozen account verified (100% score).")

    # Unfreeze
    res = requests.post(f"{BASE_URL}/api/user-profiles/ACC_001/freeze")
    assert res.status_code == 200
    unfreeze_data = res.json()
    assert unfreeze_data["is_frozen"] == False
    print("Account ACC_001 unfrozen.")

    # 10. Test Blocklisting Telemetry
    print("\n[Test 9] Testing telemetry blocklist...")
    # Add IP to blocklist
    block_payload = {
        "value": "198.51.100.222",
        "type": "ip",
        "reason": "Test blocklist deployment"
    }
    res = requests.post(f"{BASE_URL}/api/blocklist", json=block_payload)
    assert res.status_code == 200
    block_entry = res.json()
    assert block_entry["value"] == "198.51.100.222"

    # Get blocklist
    res = requests.get(f"{BASE_URL}/api/blocklist")
    assert res.status_code == 200
    blocklist = res.json()
    blocked_values = [b["value"] for b in blocklist]
    assert "198.51.100.222" in blocked_values
    print("Telemetry blocked successfully.")

    # Ingest transaction with blocked IP
    now = datetime.utcnow()
    tx_blocked = {
        "sender_account": "ACC_TEST_BLOCKED",
        "receiver_account": "ACC_002",
        "amount": 330.00,
        "timestamp": now.isoformat(),
        "device_metadata": {
          "ip_address": "198.51.100.222",
          "device_fingerprint": "some_fingerprint",
          "login_time": (now - timedelta(minutes=5)).isoformat()
        }
    }
    res = requests.post(f"{BASE_URL}/api/transactions", json=tx_blocked)
    assert res.status_code == 200
    tx_res = res.json()
    assert tx_res["is_device_farm_suspected"] == True
    assert "Telemetry blocklisted" in tx_res["device_farm_reason"]
    print("Transaction with blocklisted telemetry correctly caught.")

    # 11. Test dynamic risk profiling factors & timeline
    print("\n[Test 10] Verifying dynamic risk profile structure & timeline...")
    res = requests.get(f"{BASE_URL}/api/user-profiles/ACC_TEST_BLOCKED/risk-profile")
    assert res.status_code == 200
    profile = res.json()
    assert profile["overall_risk_score"] >= 50.0  # blocklist matching gives +50
    assert len(profile["timeline"]) >= 1
    assert profile["factors"][-1]["name"] == "Telemetry Blocklist Matches"
    assert profile["factors"][-1]["status"] == "CRITICAL"
    print("Dynamic risk profile structure and timeline events validated.")

    print("\nALL BACKEND INTEGRATION TESTS PASSED SUCCESSFULLY! [OK]")

if __name__ == "__main__":
    run_tests()
