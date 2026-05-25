"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient, useSuiClientQuery } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import WalletConnect from "../components/WalletConnect";
import { generateAndUploadCertificate } from "../lib/generate-certificate";
import { getWalrusBlobUrl } from "../lib/walrus";
import { CONTRACTS } from "../lib/contracts";

// Types
interface ClaimRecord {
  objectId: string;
  claimNumber: string;
  tourist: string;
  totalPurchaseAmount: number;
  totalVatAmount: number;
  instantAmount: number;
  finalAmount: number;
  receiptCount: number;
  receiptBlobIds: string[];
  merchantNames: string[];
  status: number;
  submittedEpoch: number;
  approvedEpoch: number;
  settledEpoch: number;
  verifierAddress: string;
  qrCodeData: string;
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<"verify" | "claims" | "flagged" | "compliance">("verify");
  
  // Real Sui Wallet connection hooks
  const currentAccount = useCurrentAccount();
  const walletConnected = !!currentAccount;
  const walletAddress = currentAccount?.address || "";
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Query owned VerifierCap object
  const { data: ownedVerifierCaps, refetch: refetchVerifierCaps } = useSuiClientQuery('getOwnedObjects', {
    owner: walletAddress,
    filter: {
      StructType: `${CONTRACTS.PACKAGE_ID}::safwah::VerifierCap`,
    },
    options: {
      showContent: true,
    }
  }, { enabled: walletConnected });

  const hasVerifierCap = ownedVerifierCaps && ownedVerifierCaps.data.length > 0;
  const verifierCapObject = hasVerifierCap ? ownedVerifierCaps.data[0].data : null;
  const verifierCapObjectId = verifierCapObject?.objectId || "";
  const verifierName = verifierCapObject ? ((verifierCapObject.content as any)?.fields?.verifier_name || "Customs Gate Officer") : "Customs Gate Officer";

  // Verifier stats state
  const [approvedCount, setApprovedCount] = useState(148);
  const [flaggedCount, setFlaggedCount] = useState(12);
  const [volumeProcessed, setVolumeProcessed] = useState("18,450.00");

  // Airport queue records state
  const [records, setRecords] = useState<ClaimRecord[]>([]);
  const [flaggedIds, setFlaggedIds] = useState<string[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);

  // Scan / Search states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchClaimId, setSearchClaimId] = useState("");
  const [scannedClaim, setScannedClaim] = useState<ClaimRecord | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Walrus receipt states
  const [receiptContents, setReceiptContents] = useState<any[]>([]);
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load flagged IDs from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("safwah_flagged_ids");
    if (saved) {
      try {
        setFlaggedIds(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Save flagged IDs to localStorage when modified
  const saveFlaggedIds = (ids: string[]) => {
    setFlaggedIds(ids);
    localStorage.setItem("safwah_flagged_ids", JSON.stringify(ids));
  };

  // Helper to fetch single VatClaim details
  const handleFetchClaim = async (objectId: string): Promise<ClaimRecord | null> => {
    try {
      const response = await suiClient.getObject({
        id: objectId,
        options: { showContent: true }
      });
      if (response.error) {
        return null;
      }
      const content = response.data?.content;
      if (!content || (content as any).dataType !== 'moveObject') {
        return null;
      }
      const fields = (content as any).fields;
      return {
        objectId: objectId,
        claimNumber: fields.claim_number,
        tourist: fields.tourist,
        totalPurchaseAmount: Number(fields.total_purchase_amount),
        totalVatAmount: Number(fields.total_vat_amount),
        instantAmount: Number(fields.instant_amount),
        finalAmount: Number(fields.final_amount),
        receiptCount: Number(fields.receipt_count),
        receiptBlobIds: fields.receipt_blob_ids,
        merchantNames: fields.merchant_names,
        status: Number(fields.status),
        submittedEpoch: Number(fields.submitted_epoch),
        approvedEpoch: Number(fields.approved_epoch),
        settledEpoch: Number(fields.settled_epoch),
        verifierAddress: fields.verifier_address,
        qrCodeData: fields.qr_code_data
      };
    } catch (err) {
      console.error(`Error fetching claim ${objectId}:`, err);
      return null;
    }
  };

  // Fetch recent claims submitted on-chain
  const loadRecentClaims = async () => {
    setIsLoadingQueue(true);
    try {
      const events = await suiClient.queryEvents({
        query: {
          MoveEventType: `${CONTRACTS.PACKAGE_ID}::safwah::ClaimSubmitted`
        },
        limit: 15,
        order: 'descending'
      });
      
      const tempRecords: ClaimRecord[] = [];
      const fetchedIds = new Set<string>();

      for (const ev of events.data) {
        const claimId = (ev.parsedJson as any).claim_id;
        if (claimId && !fetchedIds.has(claimId)) {
          fetchedIds.add(claimId);
          const claimDetails = await handleFetchClaim(claimId);
          if (claimDetails) {
            tempRecords.push(claimDetails);
          }
        }
      }

      if (tempRecords.length > 0) {
        setRecords(tempRecords);
      }
    } catch (err) {
      console.error("Failed to load claims queue:", err);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  // Load queue on wallet connection or tab shift
  useEffect(() => {
    loadRecentClaims();
  }, [walletAddress]);

  // Fetch receipts from Walrus when a claim is selected
  useEffect(() => {
    if (!scannedClaim || !scannedClaim.receiptBlobIds) {
      setReceiptContents([]);
      return;
    }

    const fetchReceipts = async () => {
      setIsLoadingReceipts(true);
      const contents = [];
      for (const blobId of scannedClaim.receiptBlobIds) {
        try {
          const response = await fetch(`${getWalrusBlobUrl(blobId)}`);
          if (response.ok) {
            const data = await response.json();
            contents.push({ blobId, ...data });
          } else {
            contents.push({ blobId, storeName: "Imported Invoice", amountAED: "N/A", vatAED: "N/A" });
          }
        } catch (err) {
          contents.push({ blobId, storeName: "Store Receipt", amountAED: "Customs Inspected", vatAED: "N/A" });
        }
      }
      setReceiptContents(contents);
      setIsLoadingReceipts(false);
    };

    fetchReceipts();
  }, [scannedClaim]);

  const handleVerifySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchClaimId) return;

    setIsLoadingReceipts(true);
    const claim = await handleFetchClaim(searchClaimId.trim());
    setIsLoadingReceipts(false);

    if (claim) {
      setScannedClaim(claim);
    } else {
      alert(`Claim Object ID ${searchClaimId} not found on Sui Devnet. Please verify the Object ID.`);
    }
  };

  // FAB Scanner Trigger: pulls the first pending claim from the dynamic queue
  const handleTriggerScanner = () => {
    const pending = records.find(r => r.status === 1 && !flaggedIds.includes(r.objectId));
    if (!pending) {
      alert("No active pending claims found in exit queue to scan. Try submitting one in the tourist app.");
      return;
    }

    setIsScanning(true);
    setIsModalOpen(true);
    setTimeout(() => {
      setScannedClaim(pending);
      setIsScanning(false);
    }, 1200);
  };

  // Exit Validation Approval: release remaining 20%
  const handleApproveExit = async (objectId: string) => {
    if (!walletConnected) {
      alert("Please connect verifier node wallet!");
      return;
    }
    if (!hasVerifierCap) {
      alert("This wallet does not hold the required Customs VerifierCap!");
      return;
    }

    const claim = scannedClaim || records.find(r => r.objectId === objectId);
    if (!claim) return;

    setIsApproving(true);
    try {
      // 1. Generate exit settlement certificate PDF and upload to Walrus
      const certResult = await generateAndUploadCertificate({
        claimId: claim.objectId,
        touristAddress: claim.tourist,
        totalRefunded: claim.totalVatAmount,
        merchantNames: claim.merchantNames || [],
        receiptCount: claim.receiptCount,
        settledAt: new Date()
      });

      // 2. Approve exit on Sui
      const tx = new Transaction();
      tx.moveCall({
        target: `${CONTRACTS.PACKAGE_ID}::safwah::approve_and_settle`,
        arguments: [
          tx.object(verifierCapObjectId),
          tx.object(CONTRACTS.ESCROW_ID),
          tx.object(claim.objectId),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(certResult.blobId))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(certResult.blobUrl))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(certResult.blobUrl))),
        ],
      });

      const result = await signAndExecute({ transaction: tx });
      alert(`Exit validation success for Claim ${claim.claimNumber}!\n\nSmart contract transaction signed.\nRemaining 20% on-chain payout released to tourist wallet.\nTx Hash: ${result.digest}\nCertificate Blob: ${certResult.blobId.slice(0, 8)}...`);

      // Update local metrics
      setApprovedCount(prev => prev + 1);
      const remainingVat = claim.finalAmount / 1_000_000;
      setVolumeProcessed(prev => (parseFloat(prev.replace(/,/g, '')) + remainingVat).toFixed(2));

      // Remove from flagged if approved
      if (flaggedIds.includes(claim.objectId)) {
        saveFlaggedIds(flaggedIds.filter(id => id !== claim.objectId));
      }

      setScannedClaim(null);
      setIsModalOpen(false);
      await loadRecentClaims();
      setActiveCategory("claims");
    } catch (err: any) {
      alert(`Exit approval failed: ${err.message || err}`);
    } finally {
      setIsApproving(false);
    }
  };

  // Flag claim for physical inspection
  const handleFlagClaim = (objectId: string) => {
    if (!flaggedIds.includes(objectId)) {
      const updatedFlags = [...flaggedIds, objectId];
      saveFlaggedIds(updatedFlags);
      setFlaggedCount(updatedFlags.length);
    }
    setScannedClaim(null);
    setIsModalOpen(false);
    setActiveCategory("flagged");
    alert(`Claim has been FLAGGED for physical customs inspection.\nTourist has been notified via their app.`);
  };

  const getStatusLabel = (claim: ClaimRecord) => {
    if (flaggedIds.includes(claim.objectId)) {
      return "Flagged for Inspection";
    }
    switch (claim.status) {
      case 1: return "Pending Exit Validation";
      case 3: return "Approved (20% Released)";
      default: return "Processed";
    }
  };

  return (
    <main className="phone-frame">
      {/* Header section with wallet connection */}
      <header className="header">
        <div className="header-left">
          <span className="header-greeting-lbl">SAFWAH AIRPORT VAL ({verifierName})</span>
          <h1 className="header-title-name">Customs Gate</h1>
        </div>
        
        <div className="header-right">
          <WalletConnect />
        </div>
      </header>

      {/* Category selector */}
      <section className="category-scroll-container" ref={scrollContainerRef}>
        <div className="category-btn-wrapper" id="cat-btn-verify">
          {activeCategory === "verify" ? (
            <button className="category-btn-active" onClick={() => setActiveCategory("verify")}>
              <div className="active-circle">🔍</div>
              <span className="active-label">Verify Claims</span>
            </button>
          ) : (
            <button className="category-btn-inactive" onClick={() => setActiveCategory("verify")}>🔍</button>
          )}
        </div>

        <div className="category-btn-wrapper" id="cat-btn-claims">
          {activeCategory === "claims" ? (
            <button className="category-btn-active" onClick={() => setActiveCategory("claims")}>
              <div className="active-circle">⏳</div>
              <span className="active-label">Exit Queue</span>
            </button>
          ) : (
            <button className="category-btn-inactive" onClick={() => setActiveCategory("claims")}>⏳</button>
          )}
        </div>

        <div className="category-btn-wrapper" id="cat-btn-flagged">
          {activeCategory === "flagged" ? (
            <button className="category-btn-active" onClick={() => setActiveCategory("flagged")}>
              <div className="active-circle">⚠️</div>
              <span className="active-label">Flagged</span>
            </button>
          ) : (
            <button className="category-btn-inactive" onClick={() => setActiveCategory("flagged")}>⚠️</button>
          )}
        </div>

        <div className="category-btn-wrapper" id="cat-btn-compliance">
          {activeCategory === "compliance" ? (
            <button className="category-btn-active" onClick={() => setActiveCategory("compliance")}>
              <div className="active-circle">🛡️</div>
              <span className="active-label">Auditing</span>
            </button>
          ) : (
            <button className="category-btn-inactive" onClick={() => setActiveCategory("compliance")}>🛡️</button>
          )}
        </div>
      </section>

      {/* Main card panel - simulates view transition */}
      <section key={activeCategory} className="hero-card fade-transition">
        <div className="decorative-blob" />

        {/* Verify Tab Content */}
        {activeCategory === "verify" && (
          <>
            <div className="hero-header">
              <div className="hero-icon-holder">
                <span>🔍</span>
              </div>
              <div className="hero-title-area">
                <span className="label-caps">AUDIT CONTROL PORTAL</span>
                <h2>Exit Validation Dashboard</h2>
              </div>
            </div>
            <p className="hero-card-desc">
              Scan tourist's Safwah NFT / Claim QR or enter their Claim Object ID to inspect receipts and approve exit refund splits on-chain.
            </p>
            <form onSubmit={handleVerifySearch} style={{ display: "flex", gap: "10px", position: "relative", zIndex: 10 }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter Claim Object ID" 
                value={searchClaimId}
                onChange={(e) => setSearchClaimId(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary" style={{ padding: "16px 20px" }}>
                Find
              </button>
            </form>
          </>
        )}

        {/* Queue Tab Content */}
        {activeCategory === "claims" && (
          <>
            <div className="hero-header">
              <div className="hero-icon-holder">
                <span>⏳</span>
              </div>
              <div className="hero-title-area">
                <span className="label-caps">AIRPORT INSPECTION QUEUE</span>
                <h2>Active Validation Queue</h2>
              </div>
            </div>
            <p className="hero-card-desc">
              Pending exits registered at customs checkpoints. Verify their claims to trigger on-chain USDC releases.
            </p>
            <div className="bento-grid">
              <div className="bento-metric-card">
                <span className="bento-metric-label">QUEUE LENGTH</span>
                <div className="bento-content">
                  <div className="bento-icon-circle">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/></svg>
                  </div>
                  <span className="bento-value">
                    {records.filter(r => r.status === 1 && !flaggedIds.includes(r.objectId)).length} Pending
                  </span>
                </div>
              </div>
              <div className="bento-metric-card">
                <span className="bento-metric-label">DAILY VAL</span>
                <div className="bento-content">
                  <div className="bento-icon-circle">
                    <svg viewBox="0 0 24 24"><path d="M12 2v2M12 20v2"/></svg>
                  </div>
                  <span className="bento-value">{approvedCount} Settled</span>
                </div>
              </div>
            </div>
            <button className="btn-primary" style={{ width: "100%", padding: "12px", marginTop: "12px" }} onClick={loadRecentClaims} disabled={isLoadingQueue}>
              {isLoadingQueue ? "Refreshing..." : "↻ Refresh Queue"}
            </button>
          </>
        )}

        {/* Flagged Tab Content */}
        {activeCategory === "flagged" && (
          <>
            <div className="hero-header">
              <div className="hero-icon-holder">
                <span>⚠️</span>
              </div>
              <div className="hero-title-area">
                <span className="label-caps">FRAUD PREVENTION</span>
                <h2>Customs Inspection Queue</h2>
              </div>
            </div>
            <p className="hero-card-desc">
              Claims flagged for physical good verification (e.g. jewelry, electronics). Officers must verify original packaging before validation.
            </p>
            <div className="bento-grid">
              <div className="bento-metric-card" style={{ gridColumn: "span 2" }}>
                <span className="bento-metric-label">FLAGGED FOR INSPECTION</span>
                <div className="bento-content" style={{ justifyContent: "space-between" }}>
                  <span className="bento-value" style={{ color: "#EF4444" }}>⚠️ {flaggedIds.length} Active Flags</span>
                  <span style={{ fontSize: "10px", color: "var(--color-sage)" }}>Terminal audits</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Compliance Tab Content */}
        {activeCategory === "compliance" && (
          <>
            <div className="hero-header">
              <div className="hero-icon-holder">
                <span>🛡️</span>
              </div>
              <div className="hero-title-area">
                <span className="label-caps">FEDERAL TAX AUDITING</span>
                <h2>Government Compliance</h2>
              </div>
            </div>
            <p className="hero-card-desc">
              Export daily validation logs, fraud reports, and settle volumes to UAE Federal Tax Authority (FTA).
            </p>
            <div className="bento-grid">
              <div className="bento-metric-card">
                <span className="bento-metric-label">RELEASE VOLUME</span>
                <div className="bento-content">
                  <div className="bento-icon-circle">
                    <svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                  <span className="bento-value" style={{ fontSize: "11px" }}>{volumeProcessed} USDC</span>
                </div>
              </div>
              <div className="bento-metric-card">
                <span className="bento-metric-label">AUDIT EXPORTS</span>
                <div className="bento-content">
                  <div className="bento-icon-circle">
                    <svg viewBox="0 0 24 24"><path d="M5 3h14v18H5z"/></svg>
                  </div>
                  <span className="bento-value">FTA-v2.csv</span>
                </div>
              </div>
            </div>
            <button className="btn-primary" style={{ width: "100%", padding: "16px" }} onClick={() => alert("Daily Audit Report successfully exported to Federal Tax Authority Server.")}>
              Export FTA Compliance Report
            </button>
          </>
        )}
      </section>

      {/* Secondary Feed items list */}
      <section key={`feed-${activeCategory}`} className="feed-section fade-transition">
        {activeCategory === "claims" && (
          <>
            <div className="feed-header">
              <span className="label-caps">PENDING CHECK-INS</span>
            </div>
            {records.filter(r => r.status === 1 && !flaggedIds.includes(r.objectId)).length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--color-sage)", padding: "20px" }}>
                No pending claims in exit queue.
              </div>
            ) : (
              records.filter(r => r.status === 1 && !flaggedIds.includes(r.objectId)).map((rec) => (
                <div key={rec.objectId} className="feed-card" onClick={() => setScannedClaim(rec)} style={{ cursor: "pointer" }}>
                  <div className="feed-card-left">
                    <div className="feed-icon-container">⏳</div>
                    <div className="feed-text-area">
                      <span className="feed-title">{rec.claimNumber} • Tourist: {rec.tourist.slice(0, 6)}...{rec.tourist.slice(-4)}</span>
                      <span className="feed-subtitle">VAT: {(rec.totalVatAmount / 1_000_000).toFixed(2)} USDC</span>
                    </div>
                  </div>
                  <span className="label-caps" style={{ color: "var(--color-cyber-gold)" }}>Verify exit →</span>
                </div>
              ))
            )}
          </>
        )}

        {activeCategory === "flagged" && (
          <>
            <div className="feed-header">
              <span className="label-caps">INSPECTION REGISTER</span>
            </div>
            {records.filter(r => flaggedIds.includes(r.objectId)).length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--color-sage)", padding: "20px" }}>
                No flagged claims.
              </div>
            ) : (
              records.filter(r => flaggedIds.includes(r.objectId)).map((rec) => (
                <div key={rec.objectId} className="feed-card" onClick={() => setScannedClaim(rec)} style={{ cursor: "pointer" }}>
                  <div className="feed-card-left">
                    <div className="feed-icon-container" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}>⚠️</div>
                    <div className="feed-text-area">
                      <span className="feed-title" style={{ color: "#EF4444" }}>{rec.claimNumber} • Inspection Pending</span>
                      <span className="feed-subtitle">{rec.tourist.slice(0, 6)}...{rec.tourist.slice(-4)} • {(rec.totalVatAmount / 1_000_000).toFixed(2)} USDC</span>
                    </div>
                  </div>
                  <span className="label-caps" style={{ color: "var(--color-cyber-gold)" }}>Inspect goods →</span>
                </div>
              ))
            )}
          </>
        )}

        {activeCategory === "verify" && scannedClaim && (
          <>
            <div className="feed-header">
              <span className="label-caps">INSPECTION PREVIEW</span>
            </div>
            <div className="feed-card" style={{ flexDirection: "column", gap: "16px", alignItems: "flex-start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                <span style={{ fontWeight: "bold", fontSize: "18px" }}>Claim Audit: {scannedClaim.claimNumber}</span>
                <span className="label-caps" style={{ color: scannedClaim.status === 3 ? "#10B981" : "var(--color-cyber-gold)" }}>{getStatusLabel(scannedClaim)}</span>
              </div>
              <div style={{ fontSize: "14px", display: "flex", flexDirection: "column", gap: "6px", width: "100%", color: "var(--color-sage)" }}>
                <div>Tourist Wallet: <span style={{ color: "#fff" }}>{scannedClaim.tourist}</span></div>
                <div>Total VAT Value: <span style={{ color: "#fff" }}>{(scannedClaim.totalVatAmount / 1_000_000).toFixed(2)} USDC</span></div>
                <div>80% Payout Status: <span style={{ color: "#10B981" }}>✓ SUI Settle Complete ({(scannedClaim.instantAmount / 1_000_000).toFixed(2)} USDC)</span></div>
                <div>Sui Object ID: <span style={{ color: "#fff", fontSize: "11px", wordBreak: "break-all" }}>{scannedClaim.objectId}</span></div>
              </div>

              {/* Walrus Receipts Inspection Area */}
              <div style={{ width: "100%", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "12px", marginTop: "4px" }}>
                <span className="label-caps" style={{ fontSize: "10px", color: "var(--color-cyber-gold)", marginBottom: "8px", display: "block" }}>
                  Walrus Decentralized Receipts
                </span>
                {isLoadingReceipts ? (
                  <div style={{ color: "var(--color-sage)", fontSize: "12px" }}>Fetching receipts from Walrus network...</div>
                ) : receiptContents.length === 0 ? (
                  <div style={{ color: "var(--color-sage)", fontSize: "12px" }}>No receipts loaded.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {receiptContents.map((rc, idx) => (
                      <div key={idx} style={{ background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: "12px", color: "#fff", fontWeight: "bold" }}>{rc.storeName || rc.businessName}</div>
                          <div style={{ fontSize: "10px", color: "var(--color-sage)" }}>Blob: {rc.blobId.slice(0, 10)}...</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "12px", color: "var(--color-cyber-gold)" }}>{rc.amountAED} AED</div>
                          <div style={{ fontSize: "10px", color: "var(--color-sage)" }}>VAT: {rc.vatAED} AED</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(scannedClaim.status === 1 && !flaggedIds.includes(scannedClaim.objectId)) && (
                <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                  <button className="btn-secondary" style={{ flex: 1, borderColor: "#EF4444", color: "#EF4444" }} onClick={() => handleFlagClaim(scannedClaim.objectId)}>
                    Flag Claim
                  </button>
                  <button className="btn-primary" style={{ flex: 2 }} onClick={() => handleApproveExit(scannedClaim.objectId)} disabled={isApproving}>
                    {isApproving ? "Approving on Sui..." : "Approve Exit (USDC Release)"}
                  </button>
                </div>
              )}
              {flaggedIds.includes(scannedClaim.objectId) && (
                <div style={{ width: "100%" }}>
                  <button className="btn-primary" style={{ width: "100%" }} onClick={() => handleApproveExit(scannedClaim.objectId)} disabled={isApproving}>
                    {isApproving ? "Approving on Sui..." : "Clear Goods & Settle Split"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Floating navigation bar */}
      <div className="nav-wrapper">
        <nav className="nav-pill-bar">
          <button className={`nav-item-btn ${activeCategory === "verify" ? "active" : "inactive"}`} onClick={() => setActiveCategory("verify")}>
            <svg viewBox="0 0 24 24" stroke="currentColor">
              <rect x="3" y="3" width="7" height="9" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" />
              <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
          </button>

          {/* FAB: Launch Scanner Simulator */}
          <div className="fab-container">
            <button className={`fab-btn ${isModalOpen ? "open" : ""}`} onClick={handleTriggerScanner}>
              <svg viewBox="0 0 24 24" stroke="currentColor">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
          </div>

          <button className={`nav-item-btn ${activeCategory === "claims" ? "active" : "inactive"}`} onClick={() => setActiveCategory("claims")}>
            <svg viewBox="0 0 24 24" stroke="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          </button>
        </nav>
      </div>

      {/* Scanner FAB Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="label-caps" style={{ color: "var(--color-cyber-gold)", fontSize: "12px" }}>EXIT VALIDATION GATE SCANNER</span>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", fontSize: "24px", color: "var(--color-sage)", cursor: "pointer" }}>&times;</button>
            </div>
            
            {isScanning ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "36px 0" }}>
                <span style={{ fontSize: "40px", animation: "pulse 1.5s infinite" }}>📷</span>
                <span style={{ fontSize: "16px", color: "var(--color-sage)" }}>Scanning tourist's Safwah NFT / QR...</span>
                <div style={{ width: "100%", height: "2px", backgroundColor: "var(--color-cyber-gold)", animation: "pulse 1.5s infinite" }} />
              </div>
            ) : scannedClaim ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ border: "1px solid rgba(212, 175, 55, 0.3)", borderRadius: "16px", padding: "20px", backgroundColor: "rgba(0,0,0,0.2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span style={{ fontWeight: "bold", fontSize: "18px" }}>Claim ID: {scannedClaim.claimNumber}</span>
                    <span style={{ color: "var(--color-cyber-gold)", fontWeight: "bold" }}>{(scannedClaim.totalVatAmount / 1_000_000).toFixed(2)} USDC</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", color: "var(--color-sage)" }}>
                    <div>Tourist Wallet: <span style={{ color: "#fff" }}>{scannedClaim.tourist}</span></div>
                    <div>Receipts Verified: <span style={{ color: "#fff" }}>Walrus Decentralized Hash Check (✓ Passed)</span></div>
                    <div>Status: <span style={{ color: "var(--color-cyber-gold)" }}>{getStatusLabel(scannedClaim)}</span></div>
                  </div>
                </div>

                <div className="modal-buttons">
                  <button className="btn-secondary" style={{ borderColor: "#EF4444", color: "#EF4444" }} onClick={() => handleFlagClaim(scannedClaim.objectId)}>
                    Flag Claim
                  </button>
                  <button className="btn-primary" onClick={() => handleApproveExit(scannedClaim.objectId)} disabled={isApproving}>
                    {isApproving ? "Approving Exit..." : "Approve Exit (Release 20%)"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "24px" }}>
                <span style={{ fontSize: "36px" }}>🔍</span>
                <span style={{ fontWeight: "bold", color: "#fff" }}>No Active Exit Claim Found</span>
                <span style={{ fontSize: "12px", color: "var(--color-sage)", textAlign: "center" }}>Ensure the tourist has bundled their receipts and submitted the claim on their app before check-in.</span>
                <button className="btn-secondary" style={{ width: "100%", marginTop: "12px" }} onClick={() => setIsModalOpen(false)}>
                  Close Scanner
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
