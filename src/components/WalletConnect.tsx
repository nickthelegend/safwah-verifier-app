"use client";

import { DynamicWidget } from "@dynamic-labs/sdk-react-core";

export default function WalletConnect() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <DynamicWidget />
    </div>
  );
}
