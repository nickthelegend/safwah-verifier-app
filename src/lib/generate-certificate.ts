import jsPDF from 'jspdf';
import { uploadToWalrus, WalrusUploadResult } from './walrus';

export interface SettlementData {
  claimId: string;
  touristAddress: string;
  totalRefunded: number;   // USDC base units
  merchantNames: string[];
  receiptCount: number;
  settledAt: Date;
}

export async function generateAndUploadCertificate(
  data: SettlementData
): Promise<WalrusUploadResult> {
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });

  // Header
  doc.setFillColor(23, 30, 25); // Void Black (#171e19)
  doc.rect(0, 0, 210, 50, 'F');
  doc.setTextColor(212, 175, 55);  // Gold
  doc.setFontSize(28);
  doc.text('SAFWAH', 105, 25, { align: 'center' });
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('VAT Refund Settlement Certificate', 105, 38, { align: 'center' });

  // Body
  doc.setTextColor(23, 30, 25);
  doc.setFontSize(12);
  const usdc = (data.totalRefunded / 1_000_000).toFixed(2);
  doc.text(`Claim ID: ${data.claimId}`, 20, 70);
  doc.text(`Tourist Wallet: ${data.touristAddress}`, 20, 82);
  doc.text(`Total VAT Refunded: USDC ${usdc}`, 20, 94);
  doc.text(`Receipts: ${data.receiptCount}`, 20, 106);
  doc.text(`Merchants: ${data.merchantNames.join(', ')}`, 20, 118);
  doc.text(`Settlement Date: ${data.settledAt.toISOString()}`, 20, 130);
  doc.text('Status: FULLY SETTLED', 20, 142);

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Powered by Sui Blockchain & Walrus Decentralized Storage', 105, 280, { align: 'center' });

  const pdfBlob = doc.output('blob');
  return uploadToWalrus(pdfBlob);
}
