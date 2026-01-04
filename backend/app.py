from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# 1. MOCK DATABASE (In a real app, this would be SQL/Mongo)
# Define which organizer address owns which event ID
EVENT_REGISTRY = {
    "event_1": "0xCB7823F557E49fd23C70C27fa7739D8e695561B6", # <--- REPLACE THIS with your specific organizer wallet address
    "event_2": "0xANOTHER_ORGANIZER_ADDRESS"
}

# Store actions in memory
actions = []

@app.route("/submit", methods=["POST"])
def submit_action():
    data = request.json
    # Data requires: user address, action type (0=Attended, etc), and eventId
    actions.append({
        "user": data.get("user"),
        "action": data.get("action"), # 0, 1, or 2 (matches Enum in Solidity)
        "eventId": data.get("eventId"),
        "approved": False
    })
    return jsonify({"status": "submitted", "msg": "Action pending approval"})

@app.route("/approve", methods=["POST"])
def approve_action():
    data = request.json
    idx = data.get("index")
    requesting_organizer = data.get("organizerAddress") # The wallet trying to approve

    if idx >= len(actions):
        return jsonify({"error": "Invalid index"}), 404

    action = actions[idx]
    event_id = action["eventId"]
    
    # 2. VERIFICATION LOGIC
    # Check if the event exists and if the requester is the assigned organizer
    assigned_organizer = EVENT_REGISTRY.get(event_id)

    if not assigned_organizer:
        return jsonify({"error": "Event not found"}), 400
    
    # Case-insensitive comparison for Ethereum addresses
    if assigned_organizer.lower() != requesting_organizer.lower():
        return jsonify({"error": "Unauthorized: You are not the organizer for this event"}), 403

    # If verification passes, mark internal state as approved
    action["approved"] = True
    
    # Return success so frontend knows it can proceed to Blockchain
    return jsonify({"status": "verified", "data": action})

@app.route("/actions", methods=["GET"])
def list_actions():
    return jsonify(actions)

if __name__ == "__main__":
    app.run(debug=True, port=5000)