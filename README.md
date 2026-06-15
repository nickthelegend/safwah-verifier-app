# 🛂 Safwah Customs Gate Verifier Frontend

This Next.js application serves as the gate operator interface for UAE Airport Customs officers. It validates tourist departures and triggers final VAT escrow payouts on-chain.

## 🌟 Features

* **Verifier Access Control**: Detects the cryptographically issued `VerifierCap` in the officer's SUI wallet to grant access.
* **Walrus Receipts Auditor**: Fetches and parses purchase receipts from decentralized Walrus blob storage matching the Claim ID.
* **Release Payouts**: Signs the departure check-in, releasing the remaining 20% VAT split to the tourist.
* **Physical Goods Flagging**: Suspends claims for jewelry or luxury inspections and files flags stored in MongoDB.
* **MongoDB Integration**: Connects to the sponsor backend to query exit queues and sync physical verification statuses.

## ⚙️ Configuration (`.env`)

Configure the following variables in a `.env` file:
```env
VITE_SUI_PACKAGE_ID=0x96604c290f1467bf041b080bf945518d56f597cb6a07d0d698466c44ed0eabfb
VITE_SAFWAH_ESCROW_ID=0x36da6295fa6bf907034fa65a84f5f921aa46997b7c492d3c7b2dc0c184115990
VITE_BACKEND_URL=http://localhost:3001
```

## 🚀 Execution & Testing

### Install dependencies:
```bash
npm install
```

### Run in development mode:
```bash
npm run dev
```

### Run tests:
```bash
npm run test
```
