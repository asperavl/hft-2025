# Universal Reputation Protocol (HFT 2025)
### Tokenized Trust Layer for Communities

**TrustTok** is a hybrid Web2/Web3 application designed to bridge the gap between traditional community engagement and blockchain transparency. It allows communities to track, verify, and mint reputation on-chain, creating a permanent and immutable record of member contributions.

---

## 🎯 Vision

To create a **Tokenized Trust** system where:

- Users can build a verifiable reputation history without needing deep crypto knowledge.
- Communities can issue immutable proof of participation (workshops, hackathons, contributions).
- Trust is decentralized and transparent, living on the Ethereum blockchain.

---

## ✨ Key Features

### Zero-Friction Onboarding (Hybrid Auth)
- Users sign in with Google (Web2 standard).
- The system automatically provisions a custodial crypto wallet for them in the background.

### Verified On-Chain History
- Reputation is not just a database number; it is minted to the Ethereum Sepolia blockchain.
- Includes links to Etherscan for cryptographic proof of every action.

### Organizer Governance
- Admins use MetaMask to securely approve or reject claims.
- Only authorized organizers can trigger the smart contract to mint points.

### Modern “Glassmorphism” UI
- A highly polished, responsive interface featuring dynamic layouts, mesh gradients, and real-time status updates.

---

## 🔄 How It Works

1. **Request**  
   A user logs in via Google and requests verification for an action (e.g., *Attended Workshop*).

2. **Review**  
   The request appears in the organizer dashboard as **Pending**.

3. **Mint**  
   The organizer reviews and approves the request.

4. **Finalize**  
   The system triggers a blockchain transaction, minting reputation points to the user’s wallet and updating the global ledger.

---

## 🛠 Technology Stack

- **Frontend:** JavaScript (Vanilla), Glassmorphism CSS, Ethers.js  
- **Backend:** Python (Flask), Eth-Account  
- **Blockchain:** Solidity (Smart Contract on Sepolia Testnet)  
- **Authentication:** Google OAuth 2.0 & MetaMask Wallet Connect
