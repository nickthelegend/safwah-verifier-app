"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useCurrentAccount } from "@mysten/dapp-kit";
import WalletConnect from "../components/WalletConnect";

// Types
type CategoryId = "verify" | "claims" | "flagged" | "compliance";

interface ClaimRecord {
  id: string;
  touristWallet: string;
  totalVat: string;
  refundAmount: string;
  airport: string;
  date: string;
  status: "Pending Exit Validation" | "Approved (20% Released)" | "Flagged for Inspection";
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("verify");
  
  // Real Sui Wallet connection hooks
  const currentAccount = useCurrentAccount();
  const walletConnected = !!currentAccount;
  const walletAddress = currentAccount?.address || "";

  // Verifier stats state
  const [approvedCount, setApprovedCount] = useState(148);
  const [flaggedCount, setFlaggedCount] = useState(12);
  const [volumeProcessed, setVolumeProcessed] = useState("18,450.00");

  // Airport queue records state
  const [records, setRecords] = useState<ClaimRecord[]>([
    { id: "CLM-8902", touristWallet: "0x8c2a...f9de", totalVat: "148.20 USDC", refundAmount: "118.56 USDC Paid (80%)", airport: "DXB Terminal 3", date: "2026-05-24", status: "Pending Exit Validation" },
    { id: "CLM-8903", touristWallet: "0x3a9f...e42c", totalVat: "622.50 USDC", refundAmount: "498.00 USDC Paid (80%)", airport: "DXB Terminal 1", date: "2026-05-24", status: "Pending Exit Validation" },
    { id: "CLM-8901", touristWallet: "0xf19e...88ab", totalVat: "85.00 USDC", refundAmount: "85.00 USDC (Split 100%)", airport: "AUH Terminal A", date: "2026-05-23", status: "Approved (20% Released)" }
  ]);

  // Scan states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchClaimId, setSearchClaimId] = useState("");
  const [scannedClaim, setScannedClaim] = useState<ClaimRecord | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Real SUI wallet integration replaces mock connectors

  const handleVerifySearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchClaimId) return;

    const found = records.find(r => r.id.toLowerCase() === searchClaimId.trim().toLowerCase());
    if (found) {
      setScannedClaim(found);
    } else {
      alert(`Claim ID ${searchClaimId} not found in airport validation records.`);
    }
  };

  // FAB Scanner Trigger Simulation
  const handleTriggerScanner = () => {
    setIsScanning(true);
    setIsModalOpen(true);
    setTimeout(() => {
      // Pull first pending claim to simulate scanning a real tourist QR
      const pending = records.find(r => r.status === "Pending Exit Validation");
      if (pending) {
        setScannedClaim(pending);
      }
      setIsScanning(false);
    }, 1500);
  };

  // Exit Validation Approval: Triggers remaining 20% refund contract payout
  const handleApproveExit = (claimId: string) => {
    if (!walletConnected) {
      alert("Please connect verifier node wallet!");
      return;
    }

    setRecords(prev => prev.map(rec => 
      rec.id === claimId ? { ...rec, status: "Approved (20% Released)" } : rec
    ));
    setApprovedCount(prev => prev + 1);
    
    // Add volume
    const target = records.find(r => r.id === claimId);
    if (target) {
      const remainingVat = parseFloat(target.totalVat) * 0.2;
      setVolumeProcessed(prev => (parseFloat(prev.replace(/,/g, '')) + remainingVat).toFixed(2));
    }

    setScannedClaim(null);
    setIsModalOpen(false);
    setActiveCategory("claims");
    alert(`Exit validation success for ${claimId}!\n\nSmart contract transaction signed.\nRemaining 20% on-chain payout has been released to tourist wallet.`);
  };

  // Flag claim for physical inspection
  const handleFlagClaim = (claimId: string) => {
    setRecords(prev => prev.map(rec => 
      rec.id === claimId ? { ...rec, status: "Flagged for Inspection" } : rec
    ));
    setFlaggedCount(prev => prev + 1);
    setScannedClaim(null);
    setIsModalOpen(false);
    setActiveCategory("flagged");
    alert(`Claim ${claimId} has been FLAGGED for physical customs inspection.\nTourist has been notified via their app.`);
  };

  return (
    <main className="phone-frame">
      {/* Header section with wallet connection */}
      <header className="header">
        <div className="header-left">
          <span className="header-greeting-lbl">SAFWAH AIRPORT VAL</span>
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
              Scan tourist's Safwah NFT / Claim QR to inspect receipts and approve on-chain split refund payouts upon airport departure.
            </p>
            <form onSubmit={handleVerifySearch} style={{ display: "flex", gap: "10px", position: "relative", zIndex: 10 }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter Claim ID (e.g. CLM-8902)" 
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
                    {records.filter(r => r.status === "Pending Exit Validation").length} Pending
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
                <span className="label-caps">FRAUD prevention</span>
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
                  <span className="bento-value" style={{ color: "#EF4444" }}>⚠️ {flaggedCount} Active Flags</span>
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
            {records.filter(r => r.status === "Pending Exit Validation").map((rec) => (
              <div key={rec.id} className="feed-card" onClick={() => setScannedClaim(rec)} style={{ cursor: "pointer" }}>
                <div className="feed-card-left">
                  <div className="feed-icon-container">⏳</div>
                  <div className="feed-text-area">
                    <span className="feed-title">{rec.id} • Tourist: {rec.touristWallet}</span>
                    <span className="feed-subtitle">{rec.airport} • {rec.totalVat} (VAT)</span>
                  </div>
                </div>
                <span className="label-caps" style={{ color: "var(--color-cyber-gold)" }}>Verify exit →</span>
              </div>
            ))}
          </>
        )}

        {activeCategory === "flagged" && (
          <>
            <div className="feed-header">
              <span className="label-caps">INSPECTION REGISTER</span>
            </div>
            {records.filter(r => r.status === "Flagged for Inspection").map((rec) => (
              <div key={rec.id} className="feed-card" onClick={() => setScannedClaim(rec)} style={{ cursor: "pointer" }}>
                <div className="feed-card-left">
                  <div className="feed-icon-container" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}>⚠️</div>
                  <div className="feed-text-area">
                    <span className="feed-title" style={{ color: "#EF4444" }}>{rec.id} • Inspection Pending</span>
                    <span className="feed-subtitle">{rec.touristWallet} • {rec.totalVat}</span>
                  </div>
                </div>
                <span className="label-caps" style={{ color: "var(--color-cyber-gold)" }}>Inspect goods →</span>
              </div>
            ))}
          </>
        )}

        {activeCategory === "verify" && scannedClaim && (
          <>
            <div className="feed-header">
              <span className="label-caps">INSPECTION PREVIEW</span>
            </div>
            <div className="feed-card" style={{ flexDirection: "column", gap: "16px", alignItems: "flex-start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                <span style={{ fontWeight: "bold", fontSize: "18px" }}>Claim Audit: {scannedClaim.id}</span>
                <span className="label-caps" style={{ color: scannedClaim.status.startsWith("Approved") ? "#10B981" : "var(--color-cyber-gold)" }}>{scannedClaim.status}</span>
              </div>
              <div style={{ fontSize: "14px", display: "flex", flexDirection: "column", gap: "6px", width: "100%", color: "var(--color-sage)" }}>
                <div>Tourist Wallet: <span style={{ color: "#fff" }}>{scannedClaim.touristWallet}</span></div>
                <div>Total VAT Value: <span style={{ color: "#fff" }}>{scannedClaim.totalVat}</span></div>
                <div>80% Payout Status: <span style={{ color: "#10B981" }}>✓ SUI Settle Complete ({scannedClaim.refundAmount})</span></div>
                <div>Gate: <span style={{ color: "#fff" }}>{scannedClaim.airport}</span></div>
              </div>
              {scannedClaim.status === "Pending Exit Validation" && (
                <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                  <button className="btn-secondary" style={{ flex: 1, borderColor: "#EF4444", color: "#EF4444" }} onClick={() => handleFlagClaim(scannedClaim.id)}>
                    Flag Claim
                  </button>
                  <button className="btn-primary" style={{ flex: 2 }} onClick={() => handleApproveExit(scannedClaim.id)}>
                    Approve Exit (USDC Release)
                  </button>
                </div>
              )}
              {scannedClaim.status === "Flagged for Inspection" && (
                <div style={{ width: "100%" }}>
                  <button className="btn-primary" style={{ width: "100%" }} onClick={() => handleApproveExit(scannedClaim.id)}>
                    Clear Goods & Settle Split
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

      {/* Real Sui Connect Button Modal automatically managed by WalletProvider */}

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
                    <span style={{ fontWeight: "bold", fontSize: "18px" }}>Claim ID: {scannedClaim.id}</span>
                    <span style={{ color: "var(--color-cyber-gold)", fontWeight: "bold" }}>{scannedClaim.totalVat}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", color: "var(--color-sage)" }}>
                    <div>Tourist Wallet: <span style={{ color: "#fff" }}>{scannedClaim.touristWallet}</span></div>
                    <div>Receipts Verified: <span style={{ color: "#fff" }}>Walrus Decentralized Hash Check (✓ Passed)</span></div>
                    <div>Airport gate: <span style={{ color: "#fff" }}>{scannedClaim.airport}</span></div>
                    <div>Status: <span style={{ color: "var(--color-cyber-gold)" }}>{scannedClaim.status}</span></div>
                  </div>
                </div>

                <div className="modal-buttons">
                  <button className="btn-secondary" style={{ borderColor: "#EF4444", color: "#EF4444" }} onClick={() => handleFlagClaim(scannedClaim.id)}>
                    Flag Claim
                  </button>
                  <button className="btn-primary" onClick={() => handleApproveExit(scannedClaim.id)}>
                    Approve Exit (Release 20%)
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
