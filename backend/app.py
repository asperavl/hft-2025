import os
import json
import time
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from eth_account import Account
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
if GOOGLE_CLIENT_ID:
    GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID.strip()

USERS_DB_FILE = "users_wallets.json"
APP_DB_FILE = "database.json"

# ✨ HARDCODED ADMIN (Must match your MetaMask)
HARDCODED_ADMIN = "0xCB7823F557E49fd23C70C27fa7739D8e695561B6".lower()

HACKATHON_SCHEMA_V1 = {
    "community_id": "global_hackathon_dao",
    "schema_id": "v1.0",
    "actions": {
        "ATTENDED": { "label": "Attended Workshop", "base": 5, "bonus_cap": 0 },
        "CONTRIB_SMALL": { "label": "Small Contribution", "base": 10, "bonus_cap": 2 },
        "CONTRIB_LARGE": { "label": "Major Contribution", "base": 20, "bonus_cap": 10 }
    }
}

DEFAULT_EVENTS = [
    { "id": "evt_hackathon_2025", "name": "Global Hackathon 2025", "organizer": HARDCODED_ADMIN, "created_at": time.time() },
    { "id": "evt_relief_fund", "name": "Disaster Relief: Zone A", "organizer": HARDCODED_ADMIN, "created_at": time.time() }
]

def load_json(filename, default_data):
    if not os.path.exists(filename):
        with open(filename, "w") as f:
            json.dump(default_data, f, indent=4)
        return default_data
    with open(filename, "r") as f:
        try: return json.load(f)
        except: return default_data

def save_json(filename, data):
    with open(filename, "w") as f:
        json.dump(data, f, indent=4)

def get_db():
    db = load_json(APP_DB_FILE, {"events": [], "actions": []})
    if not db["events"]:
        db["events"] = DEFAULT_EVENTS
        save_db(db)
    return db

def save_db(data):
    save_json(APP_DB_FILE, data)

def get_or_create_wallet(email):
    users = load_json(USERS_DB_FILE, {})
    if email in users: return users[email]["address"]
    acct = Account.create()
    users[email] = {"address": acct.address, "private_key": acct.key.hex()}
    save_json(USERS_DB_FILE, users)
    return acct.address

# ================== ROUTES ==================

@app.route("/google_login", methods=["POST"])
def google_login():
    token = request.json.get("token")
    try:
        id_info = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID, clock_skew_in_seconds=10)
        return jsonify({"status": "success", "email": id_info['email'], "address": get_or_create_wallet(id_info['email'])})
    except ValueError: return jsonify({"error": "Invalid Token"}), 401

@app.route("/schema", methods=["GET"])
def get_schema(): return jsonify(HACKATHON_SCHEMA_V1)

@app.route("/events", methods=["GET"])
def get_events(): return jsonify(get_db()["events"])

@app.route("/submit", methods=["POST"])
def submit_action():
    data = request.json
    db = get_db()
    user_addr = get_or_create_wallet(data.get("user")) if "@" in data.get("user") else data.get("user")
    
    evt_name = "Unknown"
    for e in db["events"]:
        if e["id"] == data.get("eventId"): evt_name = e["name"]

    db["actions"].append({
        "id": str(uuid.uuid4()),
        "user": user_addr,
        "user_email": data.get("user") if "@" in data.get("user") else "Wallet",
        "eventId": data.get("eventId"),
        "eventName": evt_name,
        "status": "pending",
        "timestamp": time.time()
    })
    save_db(db)
    return jsonify({"status": "submitted"})

@app.route("/pending_actions", methods=["GET"])
def list_pending():
    db = get_db()
    return jsonify([a for a in db["actions"] if a["status"] == "pending"])

# ✨ CHANGED: Now only returns payload, DOES NOT save 'approved' to DB yet
@app.route("/approve", methods=["POST"])
def approve_action():
    data = request.json
    if data.get("organizerAddress", "").lower() != HARDCODED_ADMIN:
        return jsonify({"error": "Unauthorized"}), 403

    schema_action = HACKATHON_SCHEMA_V1["actions"].get(data.get("actionKey"))
    if not schema_action: return jsonify({"error": "Invalid Action"}), 400
    if int(data.get("bonusPoints", 0)) > schema_action["bonus_cap"]: return jsonify({"error": "Bonus too high"}), 400

    db = get_db()
    action = next((a for a in db["actions"] if a["id"] == data.get("id")), None)
    if not action: return jsonify({"error": "Not Found"}), 404

    payload = {
        "community_id": HACKATHON_SCHEMA_V1["community_id"],
        "schema_id": HACKATHON_SCHEMA_V1["schema_id"],
        "action_id": data.get("actionKey"),
        "base_points": schema_action["base"],
        "bonus_points": int(data.get("bonusPoints", 0))
    }

    # Return payload for blockchain minting, but keep status as PENDING
    return jsonify({
        "status": "ready_to_mint", 
        "data": {"user": action["user"]}, 
        "blockchain_payload": payload
    })

# ✨ NEW ROUTE: Called AFTER blockchain success
@app.route("/finalize", methods=["POST"])
def finalize_action():
    data = request.json
    if data.get("organizerAddress", "").lower() != HARDCODED_ADMIN:
        return jsonify({"error": "Unauthorized"}), 403

    db = get_db()
    action = next((a for a in db["actions"] if a["id"] == data.get("id")), None)
    
    if not action: return jsonify({"error": "Not Found"}), 404

    action["status"] = "approved"
    action["final_data"] = data.get("final_data")
    save_db(db)
    
    return jsonify({"status": "verified"})

# Note: /reset_pending is no longer strictly needed but kept for safety/manual use
@app.route("/reset_pending", methods=["POST"])
def reset_pending():
    data = request.json
    if data.get("organizerAddress", "").lower() != HARDCODED_ADMIN:
        return jsonify({"error": "Unauthorized"}), 403

    db = get_db()
    action = next((a for a in db["actions"] if a["id"] == data.get("id")), None)
    if action:
        print(f"⚠️ Reverting action {data.get('id')} to PENDING")
        action["status"] = "pending"
        save_db(db)
        return jsonify({"status": "reset"})
    return jsonify({"error": "Not found"}), 404

@app.route("/reject", methods=["POST"])
def reject_action():
    data = request.json
    if data.get("organizerAddress", "").lower() != HARDCODED_ADMIN: return jsonify({"error": "Unauthorized"}), 403
    db = get_db()
    action = next((a for a in db["actions"] if a["id"] == data.get("id")), None)
    if action:
        action["status"] = "rejected"
        save_db(db)
    return jsonify({"status": "rejected"})

@app.route("/notifications", methods=["GET"])
def get_notifications():
    db = get_db()
    return jsonify([a for a in db["actions"] if a["user_email"] == request.args.get("email")])

if __name__ == "__main__":
    app.run(debug=True, port=5000)