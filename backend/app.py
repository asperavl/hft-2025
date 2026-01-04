import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from eth_account import Account
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
USERS_DB_FILE = "users_wallets.json"

# 1. ORGANIZER REGISTRY (Mapping Event -> Organizer Address)
EVENT_REGISTRY = {
    "event_1": "0xCB7823F557E49fd23C70C27fa7739D8e695561B6", 
    "event_2": "0xANOTHER_ORGANIZER_ADDRESS"
}

# In-memory storage for actions
actions = []

# ================== HELPER: DATABASE MANAGEMENT ==================
def load_users():
    if not os.path.exists(USERS_DB_FILE):
        return {}
    with open(USERS_DB_FILE, "r") as f:
        return json.load(f)

def save_user(email, wallet_data):
    users = load_users()
    users[email] = wallet_data
    with open(USERS_DB_FILE, "w") as f:
        json.dump(users, f, indent=4)

def get_or_create_wallet(email):
    """
    Checks if a user has a wallet. If not, creates one.
    Returns the public address.
    """
    users = load_users()
    
    if email in users:
        return users[email]["address"]
    
    # Create new wallet for this user
    # NOTE: In production, use a Key Management Service (KMS) or encrypt the private key!
    acct = Account.create()
    wallet_data = {
        "address": acct.address,
        "private_key": acct.key.hex() # stored for future export if needed
    }
    save_user(email, wallet_data)
    return acct.address

# ================== ROUTES ==================

@app.route("/google_login", methods=["POST"])
def google_login():
    token = request.json.get("token")
    
    try:
        # 1. SECURITY: Verify the token with Google
        id_info = id_token.verify_oauth2_token(
            token, 
            google_requests.Request(), 
            GOOGLE_CLIENT_ID
        )

        # 2. Extract User Info
        email = id_info['email']
        
        # 3. Get (or create) their Crypto Wallet
        user_address = get_or_create_wallet(email)

        return jsonify({
            "status": "success",
            "email": email,
            "address": user_address,
            "msg": "Login successful. Wallet loaded."
        })

    except ValueError:
        return jsonify({"error": "Invalid Google Token"}), 401

@app.route("/submit", methods=["POST"])
def submit_action():
    data = request.json
    # Now we accept an email (or address) and verify it
    user_identifier = data.get("user") # This might be an email now
    
    # If it looks like an email, lookup the address
    if "@" in user_identifier:
        user_address = get_or_create_wallet(user_identifier)
    else:
        user_address = user_identifier # Fallback for direct wallet usage

    actions.append({
        "user": user_address,
        "user_email": user_identifier if "@" in user_identifier else "Direct Wallet",
        "action": data.get("action"), 
        "eventId": data.get("eventId"),
        "approved": False
    })
    return jsonify({"status": "submitted", "msg": "Action pending approval"})

@app.route("/approve", methods=["POST"])
def approve_action():
    data = request.json
    idx = data.get("index")
    requesting_organizer = data.get("organizerAddress")

    if idx >= len(actions):
        return jsonify({"error": "Invalid index"}), 404

    action = actions[idx]
    event_id = action["eventId"]
    
    # VERIFICATION
    assigned_organizer = EVENT_REGISTRY.get(event_id)
    if not assigned_organizer:
        return jsonify({"error": "Event not found"}), 400
    
    if assigned_organizer.lower() != requesting_organizer.lower():
        return jsonify({"error": "Unauthorized"}), 403

    action["approved"] = True
    return jsonify({"status": "verified", "data": action})

@app.route("/actions", methods=["GET"])
def list_actions():
    return jsonify(actions)

if __name__ == "__main__":
    app.run(debug=True, port=5000)