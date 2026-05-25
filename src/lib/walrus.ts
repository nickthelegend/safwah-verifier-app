const WALRUS_PUBLISHER = process.env.VITE_WALRUS_PUBLISHER_URL || 'https://publisher.walrus-testnet.walrus.space';
const WALRUS_AGGREGATOR = process.env.VITE_WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space';


export interface WalrusUploadResult {
  blobId: string;
  blobUrl: string;
  size: number;
  contentType: string;
}

/**
 * Upload a file to Walrus decentralized storage
 * Returns the blob ID and aggregator URL
 */
export async function uploadToWalrus(
  file: File | Blob,
  epochs: number = 5  // store for 5 epochs
): Promise<WalrusUploadResult> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const response = await fetch(
    `${WALRUS_PUBLISHER}/v1/store?epochs=${epochs}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': file instanceof File ? file.type : 'application/octet-stream',
      },
      body: uint8Array,
    }
  );

  if (!response.ok) {
    throw new Error(`Walrus upload failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Walrus returns either newlyCreated or alreadyCertified
  const blobInfo = data.newlyCreated?.blobObject || data.alreadyCertified?.blobObject;
  if (!blobInfo) {
    throw new Error('Walrus upload response missing blob info');
  }

  const blobId: string = blobInfo.blobId;
  const blobUrl = `${WALRUS_AGGREGATOR}/v1/${blobId}`;

  return {
    blobId,
    blobUrl,
    size: uint8Array.length,
    contentType: file instanceof File ? file.type : 'application/octet-stream',
  };
}

/**
 * Fetch a blob from Walrus by blob ID
 */
export async function fetchFromWalrus(blobId: string): Promise<Blob> {
  const response = await fetch(`${WALRUS_AGGREGATOR}/v1/${blobId}`);
  if (!response.ok) {
    throw new Error(`Walrus fetch failed: ${response.status}`);
  }
  return response.blob();
}

/**
 * Get display URL for a Walrus blob
 */
export function getWalrusBlobUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR}/v1/${blobId}`;
}
