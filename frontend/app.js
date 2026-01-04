let provider;
let signer;
let currentUserEmail = null;
let currentWalletAddress = null;
let organizerAddress = null;
let activeSchema = null;

const API_URL = "http://127.0.0.1:5000"; 
// ⚠️ ENSURE THIS MATCHES YOUR DEPLOYED CONTRACT
const CONTRACT_ADDRESS = "0xFF1F21BB9c13a7d265cb7606C3FcA8Ce59776AD5"; 
// ⚠️ ENSURE THIS MATCHES YOUR METAMASK ADDRESS
const HARDCODED_ADMIN = "0xCB7823F557E49fd23C70C27fa7739D8e695561B6".toLowerCase(); 

const CONTRACT_ABI = [
  "function getReputation(address) view returns (uint256)",
  "function addReputation(address user, string communityId, string schemaId, string actionId, uint256 basePoints, uint256 bonusPoints) external",
  "event ReputationAdded(address indexed user, string communityId, string schemaId, string actionId, uint256 basePoints, uint256 bonusPoints, uint256 totalPoints, address indexed organizer, uint256 timestamp)"
];

// ================== INIT ==================
async function handleCredentialResponse(response) {
    try {
        const schemaRes = await fetch(`${API_URL}/schema`);
        activeSchema = await schemaRes.json();
        if(document.getElementById("schemaDisplay")) 
            document.getElementById("schemaDisplay").innerText = `${activeSchema.community_id}`;

        const res = await fetch(`${API_URL}/google_login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: response.credential })
        });
        
        const data = await res.json();
        if (data.status === "success") {
            currentUserEmail = data.email;
            currentWalletAddress = data.address; 
            
            // UI SWITCH
            document.getElementById("loginSection").style.display = "none";
            document.getElementById("userDashboard").style.display = "block";
            
            // ✨ LAYOUT EXPANSION TRIGGER
            toggleLayout(true); 

            document.getElementById("userEmailDisplay").innerText = currentUserEmail;
            document.getElementById("custodialWalletDisplay").innerText = currentWalletAddress.substring(0, 10) + "...";
            loadReputation(currentWalletAddress);
            loadEvents(); 
            refreshSidebar(); 
        }
    } catch (err) { console.error(err); alert("Init Error"); }
}

// ✨ Helper to expand the UI
function toggleLayout(expand) {
    const card = document.querySelector(".app-card");
    const wrapper = document.querySelector(".page-wrapper");
    if(expand) {
        card.classList.add("expanded");
        wrapper.classList.add("expanded-mode");
    } else {
        card.classList.remove("expanded");
        wrapper.classList.remove("expanded-mode");
    }
}

async function loadEvents() {
    const res = await fetch(`${API_URL}/events`);
    const events = await res.json();
    const select = document.getElementById("eventSelect");
    select.innerHTML = "";
    events.forEach(evt => {
        const opt = document.createElement("option");
        opt.value = evt.id;
        opt.innerText = evt.name;
        select.appendChild(opt);
    });
}

async function simulateSubmit() {
    const eventId = document.getElementById("eventSelect").value;
    await fetch(`${API_URL}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: currentUserEmail, eventId: eventId })
    });
    alert("Requested!");
    refreshSidebar();
}

async function refreshSidebar() {
    const container = document.getElementById("sidebarContent");
    container.innerHTML = "<small>Syncing...</small>";

    const apiRes = await fetch(`${API_URL}/notifications?email=${currentUserEmail}`);
    const backendActions = await apiRes.json();

    let blockchainLogs = [];
    if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        try {
            const filter = contract.filters.ReputationAdded(currentWalletAddress);
            const logs = await contract.queryFilter(filter);
            blockchainLogs = logs.map(log => ({
                actionId: log.args.actionId,
                base: log.args.basePoints.toNumber(),
                bonus: log.args.bonusPoints.toNumber(),
                txHash: log.transactionHash
            }));
        } catch(e) {}
    }

    container.innerHTML = "";
    
    // 1. Show Backend Status
    backendActions.reverse().forEach(act => {
        if (act.status === "rejected") {
            container.innerHTML += `<div class="alert alert-danger p-2 mb-2"><strong>${act.eventName}</strong><br><small>REJECTED</small></div>`;
        } else if (act.status === "pending") {
            container.innerHTML += `<div class="alert alert-warning p-2 mb-2"><strong>${act.eventName}</strong><br><small>PENDING</small></div>`;
        } 
        // ✨ REMOVED: "approved" status block to avoid duplicate "Minting..." notification.
        // The green blockchain log below will now serve as the confirmation.
    });

    // 2. Show Blockchain Proof
    blockchainLogs.reverse().forEach(log => {
        container.innerHTML += `
            <div class="alert alert-success p-2 mb-2">
                <strong>Verified Action</strong> (+${log.base + log.bonus})<br>
                <a href="https://sepolia.etherscan.io/tx/${log.txHash}" target="_blank">🔗 Proof</a>
            </div>`;
    });
    
    if (container.innerHTML === "") container.innerHTML = "<small>No activity.</small>";
}

// ================== ORGANIZER ==================
document.getElementById("organizerLoginBtn").onclick = async () => {
    if (!window.ethereum) return alert("MetaMask required!");
    provider = new ethers.providers.Web3Provider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    organizerAddress = accounts[0];

    if(organizerAddress.toLowerCase() !== HARDCODED_ADMIN) 
        return alert("Access Denied: Wrong Wallet");

    if(!activeSchema) {
        const r = await fetch(`${API_URL}/schema`);
        activeSchema = await r.json();
    }

    document.getElementById("loginSection").style.display = "none";
    document.getElementById("organizerSection").style.display = "block";
    
    // ✨ LAYOUT EXPANSION TRIGGER
    toggleLayout(true);

    document.getElementById("organizerWalletDisplay").innerText = organizerAddress.substring(0,6) + "...";
    signer = provider.getSigner();
    fetchPendingActions();
};

async function fetchPendingActions() {
    const res = await fetch(`${API_URL}/pending_actions`);
    const actions = await res.json();
    const list = document.getElementById("pendingActionsList");
    list.innerHTML = ""; 

    let optionsHtml = Object.keys(activeSchema.actions).map(key => 
        `<option value="${key}" data-cap="${activeSchema.actions[key].bonus_cap}">
            ${activeSchema.actions[key].label}
        </option>`
    ).join("");

    actions.forEach(act => {
        const item = document.createElement("div");
        item.className = "card mb-2 shadow-sm";
        item.innerHTML = `
            <div class="card-body p-2">
                <div><strong>${act.eventName}</strong><br><small>${act.user_email}</small></div>
                <div class="mt-2">
                    <select id="actKey_${act.id}" class="form-control form-control-sm mb-1">${optionsHtml}</select>
                    <input type="number" id="bonus_${act.id}" class="form-control form-control-sm mb-2" placeholder="Bonus">
                    
                    <span class="btn btn-sm btn-success" style="cursor:pointer" onclick="approveAction(this, '${act.id}')">Verify</span>
                    <span class="btn btn-sm btn-danger" style="cursor:pointer" onclick="rejectAction('${act.id}')">✖</span>
                </div>
            </div>`;
        list.appendChild(item);
    });
}

// ✨ FIX: CORRECTED FLOW -> CHECK BACKEND -> MINT -> FINALIZE BACKEND
async function approveAction(el, id) {
    const originalText = el.innerText;
    el.innerText = "Minting..."; 
    el.style.pointerEvents = "none";

    const actionKey = document.getElementById(`actKey_${id}`).value;
    const bonusVal = document.getElementById(`bonus_${id}`).value || 0;

    try {
        // 1. Get Payload from Backend (DB remains PENDING)
        const res = await fetch(`${API_URL}/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, organizerAddress, actionKey, bonusPoints: bonusVal })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // 2. Mint on Blockchain
        const p = data.blockchain_payload;
        if (!signer) throw new Error("Wallet disconnected");

        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        
        console.log("Minting:", p);
        const tx = await contract.addReputation(
            data.data.user, p.community_id, p.schema_id, p.action_id, p.base_points, p.bonus_points
        );
        
        el.innerText = "Confirming...";
        await tx.wait(); // Wait for 1 block confirmation
        
        // 3. Finalize in Database (Only after blockchain success)
        await fetch(`${API_URL}/finalize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                id, 
                organizerAddress,
                final_data: p 
            })
        });

        alert("✅ Verified on Blockchain & Recorded!");
        fetchPendingActions();

    } catch (err) {
        console.error(err);
        alert("❌ Failed: " + err.message);
        
        // Reset button state (Database is still pending, so we just let them try again)
        el.innerText = originalText;
        el.style.pointerEvents = "auto";
    }
}

async function rejectAction(id) {
    if(!confirm("Reject?")) return;
    await fetch(`${API_URL}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, organizerAddress })
    });
    fetchPendingActions();
}

async function loadReputation(address) {
    if (!window.ethereum) return;
    const p = new ethers.providers.Web3Provider(window.ethereum);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, p);
    try {
        const score = await contract.getReputation(address);
        document.getElementById("reputation").innerText = score.toString();
    } catch(e) {}
}

function logout() { location.reload(); }