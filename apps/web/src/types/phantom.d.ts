import { PublicKey, Transaction } from '@solana/web3.js'

export interface PhantomProvider {
  isPhantom: boolean
  publicKey: PublicKey | null
  isConnected: boolean
  connect: (opts?: { onlyIfTrusted: boolean }) => Promise<{ publicKey: PublicKey }>
  disconnect: () => Promise<void>
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>
  signMessage: (
    message: Uint8Array,
    display?: string
  ) => Promise<{ signature: Uint8Array; publicKey: PublicKey }>
  signAndSendTransaction: (
    transaction: Transaction,
    options?: any
  ) => Promise<{ signature: string }>
  on: (event: string, handler: (args: any) => void) => void
  removeListener: (event: string, handler: (args: any) => void) => void
  request: (method: string, params?: any) => Promise<any>
}

declare global {
  interface Window {
    solana?: PhantomProvider
  }
}

export {}