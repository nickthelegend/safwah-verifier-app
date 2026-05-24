"use client";

import { ConnectButton } from "@mysten/dapp-kit";

export default function WalletConnect() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <ConnectButton 
        connectText="Connect Sui Wallet"
        className="sui-custom-connect-btn"
      />
      
      <style jsx global>{`
        .sui-custom-connect-btn,
        .sui-connect-button {
          background-color: var(--color-cyber-gold-dark) !important;
          color: var(--color-void-black) !important;
          font-family: var(--font-nunito) !important;
          font-weight: 800 !important;
          font-size: 13px !important;
          border-radius: 20px !important;
          padding: 10px 18px !important;
          border: none !important;
          cursor: pointer !important;
          box-shadow: var(--shadow-red) !important;
          transition: transform 0.2s ease, background-color 0.2s ease !important;
        }
        .sui-custom-connect-btn:hover,
        .sui-connect-button:hover {
          background-color: var(--color-cyber-gold) !important;
          transform: translateY(-1px) !important;
        }
        .sui-custom-connect-btn:active,
        .sui-connect-button:active {
          transform: scale(0.96) !important;
        }
      `}</style>
    </div>
  );
}
