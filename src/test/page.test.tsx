import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import Home from '../app/page';
import { generateAndUploadCertificate } from '../lib/generate-certificate';
import { toast } from 'sonner';

// Mock dapp-kit hooks
const mockSignAndExecute = vi.fn();
const mockSuiClient = {
  getObject: vi.fn(),
  queryEvents: vi.fn(),
};
let mockHasVerifierCap = true;
let mockAccount: any = { address: '0x73954305f663e08711eec149e0c29af30fb514dd9a3c2f39b3cd5507478783f8' };

vi.mock('../hooks/useDynamicWallet', () => ({
  useDynamicWallet: () => ({
    currentAccount: mockAccount,
    mutateAsync: mockSignAndExecute,
  }),
}));

vi.mock('@mysten/dapp-kit', () => ({
  useSuiClient: () => mockSuiClient,
  useSuiClientQuery: (queryName: string, params: any) => {
    if (queryName === 'getOwnedObjects') {
      return {
        data: mockHasVerifierCap
          ? {
              data: [
                {
                  data: {
                    objectId: '0xverifiercapobjectid',
                    content: {
                      fields: {
                        verifier_name: 'Customs Officer John',
                      },
                    },
                  },
                },
              ],
            }
          : { data: [] },
        refetch: vi.fn(),
      };
    }
    if (queryName === 'getObject') {
      return {
        data: {
          data: {
            content: {
              fields: {
                total_settled: 5,
                total_usdc_refunded: 50000000,
              },
            },
          },
        },
        refetch: vi.fn(),
      };
    }
    return { data: null, refetch: vi.fn() };
  },
  ConnectButton: () => <button>Mock ConnectButton</button>,
}));

vi.mock('@yudiel/react-qr-scanner', () => ({
  Scanner: () => <div>Mock QR Scanner</div>,
}));

vi.mock('../components/WalletConnect', () => ({
  default: () => <div>Mock WalletConnect</div>,
}));

vi.mock('../lib/generate-certificate', () => ({
  generateAndUploadCertificate: vi.fn().mockResolvedValue({
    blobId: 'mockcertificateblobid',
    blobUrl: 'https://walrus-aggregator.space/mockcertificateblobid',
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Verifier App Home Page', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockHasVerifierCap = true;
    mockAccount = { address: '0x73954305f663e08711eec149e0c29af30fb514dd9a3c2f39b3cd5507478783f8' };
    
    // Mock global fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        storeName: 'IKEA Dubai',
        amountAED: '1050',
        vatAED: '50'
      })
    });

    // Mock queryEvents to return a claim record
    mockSuiClient.queryEvents.mockResolvedValue({
      data: [
        {
          parsedJson: {
            claim_id: '0xclaimobjectid123',
          },
        },
      ],
    });

    // Mock getObject to return claim details
    mockSuiClient.getObject.mockResolvedValue({
      data: {
        content: {
          dataType: 'moveObject',
          fields: {
            claim_number: 'CLM-999',
            tourist: '0xtouristwalletaddress',
            total_purchase_amount: '1000000000',
            total_vat_amount: '50000000',
            instant_amount: '40000000',
            final_amount: '10000000',
            receipt_count: '1',
            receipt_blob_ids: ['mockblobid123'],
            merchant_names: ['IKEA Dubai'],
            status: 1, // PENDING_EXIT_VALIDATION
            submitted_epoch: '100',
            approved_epoch: '0',
            settled_epoch: '0',
            verifier_address: '',
            qr_code_data: 'claim_999_data',
          },
        },
      },
    });
  });

  test('renders Customs Gate header and stats', async () => {
    render(<Home />);
    
    expect(screen.getByText('Customs Gate')).toBeInTheDocument();
    expect(screen.getByText('SAFWAH AIRPORT VAL (Customs Officer John)')).toBeInTheDocument();
  });

  test('can switch between categories / tabs', async () => {
    render(<Home />);

    // Switch to Exit Queue tab
    const exitQueueBtn = screen.getByTitle('Exit Queue');
    expect(exitQueueBtn).toBeInTheDocument();
    fireEvent.click(exitQueueBtn);

    expect(screen.getByText('Active Validation Queue')).toBeInTheDocument();

    // Switch to Flagged tab
    const flaggedBtn = screen.getByTitle('Flagged Claims');
    expect(flaggedBtn).toBeInTheDocument();
    fireEvent.click(flaggedBtn);

    expect(screen.getByText('Customs Inspection Queue')).toBeInTheDocument();

    // Switch to Auditing tab
    const auditingBtn = screen.getByTitle('Compliance Auditing');
    expect(auditingBtn).toBeInTheDocument();
    fireEvent.click(auditingBtn);

    expect(screen.getByText('Government Compliance')).toBeInTheDocument();
  });

  test('submitting Search retrieves claim and renders inspection preview', async () => {
    render(<Home />);

    const searchInput = screen.getByPlaceholderText('Enter Claim Object ID');
    fireEvent.change(searchInput, { target: { value: '0xclaimobjectid123' } });

    const findBtn = screen.getByText('Find');
    await act(async () => {
      fireEvent.click(findBtn);
    });

    // Verify it loads claim details in preview
    expect(screen.getByText('Claim Audit: CLM-999')).toBeInTheDocument();
    expect(screen.getByText('0xtouristwalletaddress')).toBeInTheDocument();
  });

  test('can flag claim for physical inspection', async () => {
    render(<Home />);

    const searchInput = screen.getByPlaceholderText('Enter Claim Object ID');
    fireEvent.change(searchInput, { target: { value: '0xclaimobjectid123' } });
    const findBtn = screen.getByText('Find');
    await act(async () => {
      fireEvent.click(findBtn);
    });

    const flagBtn = screen.getByText('Flag Claim');
    fireEvent.click(flagBtn);

    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining('Claim has been FLAGGED for physical customs inspection')
    );
  });

  test('can approve exit and release 20% USDC payout', async () => {
    mockSignAndExecute.mockResolvedValue({ digest: 'mocktxhash123' });

    render(<Home />);

    const searchInput = screen.getByPlaceholderText('Enter Claim Object ID');
    fireEvent.change(searchInput, { target: { value: '0xclaimobjectid123' } });
    const findBtn = screen.getByText('Find');
    await act(async () => {
      fireEvent.click(findBtn);
    });

    const approveBtn = screen.getByText('Approve Exit (USDC Release)');
    await act(async () => {
      fireEvent.click(approveBtn);
    });

    expect(generateAndUploadCertificate).toHaveBeenCalled();
    expect(mockSignAndExecute).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  test('compliance export report triggers toast', async () => {
    render(<Home />);

    const auditingBtn = screen.getByTitle('Compliance Auditing');
    fireEvent.click(auditingBtn);

    const exportBtn = screen.getByText('Export FTA Compliance Report');
    fireEvent.click(exportBtn);

    expect(toast.success).toHaveBeenCalledWith(
      'Daily Audit Report successfully exported to Federal Tax Authority Server.'
    );
  });
});
