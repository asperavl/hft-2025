let provider;
let signer;
let currentUserEmail = null;
let currentWalletAddress = null;

// 🔴 CONFIGURATION
const API_URL = "http://127.0.0.1:5000"; 
// ⚠️ IMPORTANT: REPLACE THIS WITH YOUR NEW DEPLOYED ADDRESS AFTER REDEPLOYING!
const CONTRACT_ADDRESS = "0x0cC4DEc7998306038F707e040a8F57e08daa4907"; 

// ✨ UPDATED ABI: Includes the event with timestamp
const CONTRACT_ABI = [
  "function getReputation(address) view returns (uint256)",
  "function addReputation(address user, uint8 actionType) external",
  "function organizers(address) view returns (bool)",
  "event ReputationAdded(address indexed user, uint8 action, uint256 points, address indexed organizer, uint256 timestamp)"
];

const ACTION_LABELS = {
    0: "Attended Event",
    1: "Volunteered",
    2: "Delivered Aid"
};

// ================== GOOGLE LOGIN LOGIC ==================
async function handleCredentialResponse(response) {
    console.log("Encoded JWT ID token: " + response.credential);

    try {
        const res = await fetch(`${API_URL}/google_login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: response.credential })
        });
        
        const data = await res.json();
        
        if (data.status === "success") {
            currentUserEmail = data.email;
            currentWalletAddress = data.address; 
            
            document.getElementById("loginSection").style.display = "none";
            document.getElementById("userDashboard").style.display = "block";
            
            document.getElementById("userEmailDisplay").innerText = currentUserEmail;
            document.getElementById("custodialWalletDisplay").innerText = currentWalletAddress.substring(0, 10) + "...";
            
            // Load Score AND History
            loadReputation(currentWalletAddress);
            fetchHistory(currentWalletAddress); // ✨ NEW CALL
        } else {
            alert("Login Failed: " + data.error);
        }

    } catch (err) {
        console.error(err);
        alert("Server Error during login");
    }
}

// ================== USER ACTION ==================
async function simulateSubmit() {
    if (!currentUserEmail) return alert("Please sign in first!");

    const status = document.getElementById("statusMessage");
    status.innerText = "Submitting action...";

    await fetch(`${API_URL}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user: currentUserEmail, 
            action: 0, 
            eventId: "event_1" 
        })
    });
    
    status.innerText = "Action submitted! Organizer will see it.";
    alert("Submitted! Ask the Organizer to approve.");
}

// ================== READ REPUTATION & HISTORY ==================
async function loadReputation(address) {
    let readProvider = getReadProvider();
    if (!readProvider) return;

    try {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
        const reputation = await contract.getReputation(address);
        document.getElementById("reputation").innerText = reputation.toString();
    } catch (err) {
        console.error("Error reading reputation", err);
    }
}

// ✨ NEW: FETCH HISTORY FROM BLOCKCHAIN
async function fetchHistory(userAddress) {
    let readProvider = getReadProvider();
    if (!readProvider) return;

    const historyList = document.getElementById("historyList");
    historyList.innerHTML = "<div class='text-center text-muted'>Scanning blockchain...</div>";

    try {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
        
        // Filter: Get events only for THIS user
        const filter = contract.filters.ReputationAdded(userAddress);
        
        // Fetch logs (from block 0 to now)
        const logs = await contract.queryFilter(filter);
        
        historyList.innerHTML = ""; // Clear loading text

        if (logs.length === 0) {
            historyList.innerHTML = "<div class='text-center text-muted'>No history found.</div>";
            return;
        }

        // Show newest first
        const sortedLogs = logs.reverse();

        sortedLogs.forEach(log => {
            const { action, points, organizer, timestamp } = log.args;
            
            // Convert timestamp to readable date
            const date = new Date(timestamp * 1000).toLocaleDateString();
            const actionName = ACTION_LABELS[action] || "Unknown Action";
            
            const item = document.createElement("div");
            item.className = "list-group-item list-group-item-action flex-column align-items-start";
            item.innerHTML = `
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1 text-primary">${actionName}</h6>
                    <small class="text-success">+${points} pts</small>
                </div>
                <p class="mb-1 small text-muted">Verified by: ${organizer.substring(0,6)}...</p>
                <div class="d-flex w-100 justify-content-between">
                     <small>${date}</small>
                     <a href="https://sepolia.etherscan.io/tx/${log.transactionHash}" target="_blank" class="badge badge-light text-primary">🔗 Receipt</a>
                </div>
            `;
            historyList.appendChild(item);
        });

    } catch (err) {
        console.error("Error fetching history:", err);
        historyList.innerHTML = "<small class='text-danger'>Error loading history.</small>";
    }
}

function getReadProvider() {
    if (window.ethereum) {
        return new ethers.providers.Web3Provider(window.ethereum);
    } else {
        console.log("No Web3 provider found.");
        return null;
    }
}

// ================== ORGANIZER LOGIC ==================
document.getElementById("organizerLoginBtn").onclick = async () => {
    if (!window.ethereum) return alert("Organizers need MetaMask!");
    
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    const organizerAddress = accounts[0];

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    const isOrganizer = await contract.organizers(organizerAddress);

    if (isOrganizer) {
        document.getElementById("loginSection").style.display = "none";
        document.getElementById("organizerSection").style.display = "block";
        document.getElementById("organizerWalletDisplay").innerText = organizerAddress.substring(0,6) + "...";
        
        signer = provider.getSigner();
        userAddress = organizerAddress; 
        fetchPendingActions();
    } else {
        alert("Access Denied: You are not an organizer.");
    }
};

async function fetchPendingActions() {
    const res = await fetch(`${API_URL}/actions`);
    const actions = await res.json();
    const listContainer = document.getElementById("pendingActionsList");
    listContainer.innerHTML = ""; 

    actions.forEach((act, index) => {
        if(!act.approved) {
            const item = document.createElement("div");
            item.className = "alert alert-warning d-flex justify-content-between align-items-center";
            item.innerHTML = `
                <div>
                    <strong>${act.user_email}</strong> <br>
                    <small class="text-muted">${act.user}</small>
                </div>
                <button class="btn btn-sm btn-dark" onclick="approveAction(${index})">Approve</button>
            `;
            listContainer.appendChild(item);
        }
    });
}

async function approveAction(index) {
    const status = document.getElementById("statusMessage");
    
    // 1. Backend Verify
    const response = await fetch(`${API_URL}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: index, organizerAddress: userAddress })
    });
    
    const data = await response.json();
    if (!response.ok) return alert(data.error);

    // 2. Blockchain Write
    status.innerText = "Signing Transaction...";
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    
    const tx = await contract.addReputation(data.data.user, data.data.action);
    await tx.wait();
    
    status.innerText = "Confirmed! Logged on Ledger.";
    fetchPendingActions();
}

function logout() {
    location.reload();
}