let provider;
let signer;
let userAddress;

// 🔴 CONFIGURATION
const API_URL = "http://127.0.0.1:5000"; // Backend URL
const CONTRACT_ADDRESS = "0x0cC4DEc7998306038F707e040a8F57e08daa4907"; 

const CONTRACT_ABI = [
  "function getReputation(address) view returns (uint256)",
  "function addReputation(address user, uint8 actionType) external", // Note: uint8 for enum
  "function organizers(address) view returns (bool)"
];

const connectBtn = document.getElementById("connectWalletBtn");
const walletDisplay = document.getElementById("walletAddress");
const actionsListDiv = document.getElementById("actionsList"); // We will add this container in HTML

// ================== CONNECT WALLET ==================
connectBtn.onclick = async () => {
  if (!window.ethereum) {
    alert("MetaMask is not installed!");
    return;
  }

  provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);

  signer = provider.getSigner();
  userAddress = await signer.getAddress();

  walletDisplay.innerText = userAddress;
  
  // Load initial data
  checkOrganizer();
  fetchPendingActions(); // Fetch actions from backend
};

// ================== READ REPUTATION ==================
async function loadReputation() {
  if (!provider || !userAddress) {
    alert("Connect wallet first");
    return;
  }
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  const reputation = await contract.getReputation(userAddress);
  document.getElementById("reputation").innerText = reputation.toString();
}

// ================== FETCH & RENDER ACTIONS (BACKEND) ==================
async function fetchPendingActions() {
    try {
        const res = await fetch(`${API_URL}/actions`);
        const actions = await res.json();
        
        const listContainer = document.getElementById("pendingActionsList");
        listContainer.innerHTML = ""; // Clear list

        actions.forEach((act, index) => {
            if(!act.approved) {
                const item = document.createElement("div");
                item.className = "alert alert-secondary d-flex justify-content-between align-items-center";
                item.innerHTML = `
                    <div>
                        <strong>Event:</strong> ${act.eventId} <br>
                        <small>User: ${act.user.substring(0,6)}... | Action Type: ${act.action}</small>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="approveAction(${index})">Approve</button>
                `;
                listContainer.appendChild(item);
            }
        });
    } catch (err) {
        console.error("Error fetching actions:", err);
    }
}

// ================== APPROVE ACTION (INTEGRATION LOGIC) ==================
async function approveAction(index) {
  const status = document.getElementById("statusMessage");
  
  if (!signer) {
    alert("Connect wallet first");
    return;
  }

  try {
    status.innerText = "Verifying with Backend...";

    // STEP 1: Backend Verification
    // We send the index and OUR address. Backend checks if we match the event.
    const response = await fetch(`${API_URL}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            index: index, 
            organizerAddress: userAddress 
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Backend verification failed");
    }

    // STEP 2: Blockchain Transaction
    // If backend didn't throw error, we are authorized!
    status.innerText = "Backend verified! Requesting Signature...";

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    
    // Call the smart contract with data from the verified action
    // data.data contains { user: "...", action: 0, ... }
    const tx = await contract.addReputation(data.data.user, data.data.action);
    
    status.innerText = "Transaction sent. Waiting for confirmation...";
    await tx.wait();

    status.innerText = "Success! Reputation added on-chain.";
    fetchPendingActions(); // Refresh UI

  } catch (err) {
    console.error(err);
    status.innerText = "Error: " + err.message;
    alert(err.message);
  }
}

async function checkOrganizer() {
  if (!provider || !userAddress) return;
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  const isOrganizer = await contract.organizers(userAddress);
  
  if (isOrganizer) {
    document.getElementById("organizerSection").style.display = "block";
  }
}

// Test function to simulate a user submitting an action (for demo purposes)
window.simulateSubmit = async () => {
    await fetch(`${API_URL}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user: userAddress, // Uses connected wallet as the "attendee"
            action: 0, // 0 = ATTENDED
            eventId: "event_1" // Matches the ID in python EVENT_REGISTRY
        })
    });
    alert("Action submitted! Now check the Organizer list.");
    fetchPendingActions();
}