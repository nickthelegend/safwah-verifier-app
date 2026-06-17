import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isSuiWallet } from '@dynamic-labs/sui';
import { SuiJsonRpcClient as SuiClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';

export function useDynamicWallet() {
  const { primaryWallet } = useDynamicContext();

  async function signAndExecute(tx: Transaction): Promise<string> {
    if (!primaryWallet || !isSuiWallet(primaryWallet)) {
      throw new Error('No Sui wallet connected via Dynamic');
    }

    const account = await primaryWallet.getWalletAccount();

    if (account) {
      const result = await primaryWallet.signAndExecuteTransaction({ transaction: tx as any });
      return (result as { digest: string }).digest;
    }

    const { bytes, signature } = await primaryWallet.signTransaction(tx as any);
    const client = new SuiClient({ url: getJsonRpcFullnodeUrl('testnet'), network: 'testnet' });
    const result = await client.executeTransactionBlock({
      transactionBlock: bytes,
      signature,
      options: { showEffects: true },
    });
    if (result.effects?.status?.status !== 'success') {
      throw new Error(`Transaction failed: ${result.effects?.status?.error ?? 'unknown'}`);
    }
    return result.digest;
  }

  const currentAccount = primaryWallet ? { address: primaryWallet.address } : null;

  const mutateAsync = async ({ transaction }: { transaction: Transaction }) => {
    const digest = await signAndExecute(transaction);
    return { digest };
  };

  return { currentAccount, mutateAsync, signAndExecute };
}
