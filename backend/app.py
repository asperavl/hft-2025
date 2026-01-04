from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

actions = []

@app.route("/submit",methods=["POST"])
def submit_action():
    data = request.json
    actions.append({
        "user": data["user"],
        "action": data["action"],
        "approved": False
    })
    return jsonify({"status": "submitted"})

@app.route("/approve", methods=["POST"])
def approve_action():
    idx = request.json["index"]
    actions[idx]["approved"] = True
    return jsonify(actions[idx])

@app.route("/actions")
def list_actions():
    return jsonify(actions)

if __name__ == "__main__":
    app.run(debug=True)
