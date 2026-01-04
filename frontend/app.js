let provider;
let signer;
let userAddress;

const connectBtn = document.getElementById("connectWalletBtn");
const walletDisplay = document.getElementById("walletAddress");

// 🔴 Replace this with real deployed contract address
const CONTRACT_ADDRESS = "PASTE_YOUR_CONTRACT_ADDRESS";

// ✅ ABI must include ALL functions you call
const CONTRACT_ABI = [
  "function getReputation(address) view returns (uint256)",
  "function addReputation(address,uint8)",
  "function organizers(address) view returns (bool)"
];

// ================== CONNECT WALLET ==================
connectBtn.onclick = async () => {
  console.log("Connect button clicked");

  if (!window.ethereum) {
    alert("MetaMask is not installed!");
    return;
  }

  provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);

  signer = provider.getSigner();
  userAddress = await signer.getAddress();

  walletDisplay.innerText = userAddress;
  checkOrganizer();

};

// ================== READ REPUTATION ==================
async function loadReputation() {
  if (!provider || !userAddress) {
    alert("Connect wallet first");
    return;
  }

  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    CONTRACT_ABI,
    provider
  );

  const reputation = await contract.getReputation(userAddress);
  document.getElementById("reputation").innerText =
    reputation.toString();
}

// ================== WRITE REPUTATION (ORGANIZER) ==================
async function addReputation() {
  const status = document.getElementById("statusMessage");

  if (!signer) {
    alert("Connect wallet first");
    return;
  }

  try {
    status.innerText = "Waiting for transaction approval...";

    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      signer
    );

    const tx = await contract.addReputation(userAddress, 0);
    status.innerText = "Transaction sent. Waiting for confirmation...";

    await tx.wait();

    status.innerText = "Reputation added successfully!";
    loadReputation();
  } catch (err) {
    status.innerText = "Transaction failed or rejected.";
  }
}

async function checkOrganizer() {
  if (!provider || !userAddress) return;

  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    CONTRACT_ABI,
    provider
  );

  const isOrganizer = await contract.organizers(userAddress);

  const organizerBtn = document.getElementById("organizerBtn");

  if (isOrganizer) {
    organizerBtn.style.display = "block";
  } else {
    organizerBtn.style.display = "none";
  }
}

