let provider;
let signer;
let userAddress;

// 🔴 CONFIGURATION
const API_URL = "http://127.0.0.1:5000"; 
const CONTRACT_ADDRESS = "0x0cC4DEc7998306038F707e040a8F57e08daa4907"; 

const CONTRACT_ABI = [
  "function getReputation(address) view returns (uint256)",
  "function addReputation(address user, uint8 actionType) external",
  "function organizers(address) view returns (bool)"
];

const connectBtn = document.getElementById("connectWalletBtn");
const walletDisplay = document.getElementById("walletAddress");

// ================== 1. AUTO-DETECT ACCOUNT SWITCHING ==================
// This is the key fix. It listens for MetaMask changes in real-time.
if (window.ethereum) {
    window.ethereum.on('accountsChanged', handleAccountsChanged);
}

async function handleAccountsChanged(accounts) {
    // 1. Wipe the screen immediately
    resetUI();

    if (accounts.length === 0) {
        console.log("Please connect to MetaMask.");
    } else {
        // 2. Re-initialize with the NEW account
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        userAddress = accounts[0]; // Get the new address

        walletDisplay.innerText = userAddress;

        // 3. Check if THIS specific new address is an organizer
        await checkOrganizer();
        
        // Optional: Auto-load reputation for convenience
        loadReputation(); 
    }
}

function resetUI() {
    // Clear Wallet Text
    walletDisplay.innerText = "Not connected";
    
    // Clear Reputation
    document.getElementById("reputation").innerText = "0";
    
    // STRICTLY HIDE Organizer Dashboard
    document.getElementById("organizerSection").style.display = "none";
    document.getElementById("pendingActionsList").innerHTML = "";
    
    // Clear Status Messages
    document.getElementById("statusMessage").innerText = "";
}

// ================== CONNECT WALLET ==================
connectBtn.onclick = async () => {
  if (!window.ethereum) {
    alert("MetaMask is not installed!");
    return;
  }

  provider = new ethers.providers.Web3Provider(window.ethereum);
  // This triggers the popup
  const accounts = await provider.send("eth_requestAccounts", []);
  
  // We manually trigger the handler to set up the initial state
  handleAccountsChanged(accounts);
};

// ================== READ REPUTATION ==================
async function loadReputation() {
  if (!provider || !userAddress) return;

  try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const reputation = await contract.getReputation(userAddress);
      document.getElementById("reputation").innerText = reputation.toString();
  } catch (err) {
      console.error("Error loading reputation:", err);
  }
}

// ================== CHECK ORGANIZER ROLE ==================
async function checkOrganizer() {
  if (!provider || !userAddress) return;

  // Defensive: Ensure it is hidden before checking
  document.getElementById("organizerSection").style.display = "none";

  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  const isOrganizer = await contract.organizers(userAddress);
  
  // Only show if the contract says YES for this specific wallet
  if (isOrganizer) {
    document.getElementById("organizerSection").style.display = "block";
    fetchPendingActions(); // Load data only if authorized
  }
}

// ================== FETCH & RENDER ACTIONS ==================
async function fetchPendingActions() {
    try {
        const res = await fetch(`${API_URL}/actions`);
        const actions = await res.json();
        
        const listContainer = document.getElementById("pendingActionsList");
        listContainer.innerHTML = ""; 

        actions.forEach((act, index) => {
            if(!act.approved) {
                const item = document.createElement("div");
                item.className = "alert alert-secondary d-flex justify-content-between align-items-center";
                item.innerHTML = `
                    <div>
                        <strong>Event:</strong> ${act.eventId} <br>
                        <small>User: ${act.user.substring(0,6)}... | Action: ${act.action}</small>
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

// ================== APPROVE ACTION ==================
async function approveAction(index) {
  const status = document.getElementById("statusMessage");
  if (!signer) return alert("Connect wallet first");

  try {
    status.innerText = "Verifying with Backend...";
    
    const response = await fetch(`${API_URL}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: index, organizerAddress: userAddress })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Verification failed");

    status.innerText = "Backend verified! Requesting Signature...";

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    const tx = await contract.addReputation(data.data.user, data.data.action);
    
    status.innerText = "Waiting for confirmation...";
    await tx.wait();

    status.innerText = "Success! Reputation added.";
    fetchPendingActions(); 

  } catch (err) {
    console.error(err);
    status.innerText = "Error: " + err.message;
  }
}

// Test function
window.simulateSubmit = async () => {
    if(!userAddress) return alert("Connect wallet first!");
    await fetch(`${API_URL}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user: userAddress, 
            action: 0, 
            eventId: "event_1" 
        })
    });
    alert("Action submitted! Switch to Organizer wallet to approve.");
    // If we are currently an organizer, refresh the list immediately
    if(document.getElementById("organizerSection").style.display === "block") {
        fetchPendingActions();
    }
}