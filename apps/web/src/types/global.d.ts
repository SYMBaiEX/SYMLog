import { PublicKey } from '@solana/web3.js'

declare global {
  interface Window {
    phantom?: {
      solana?: {
        isPhantom: boolean
        isConnected: boolean
        publicKey: PublicKey | null
        connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>
        disconnect: () => Promise<void>
        signMessage: (message: Uint8Array, display?: string) => Promise<{ signature: Uint8Array }>
        signTransaction: (transaction: any) => Promise<any>
        signAndSendTransaction: (transaction: any) => Promise<{ signature: string }>
        signAllTransactions: (transactions: any[]) => Promise<any[]>
        on: (event: string, callback: (...args: any[]) => void) => void
        off: (event: string, callback: (...args: any[]) => void) => void
      }
    }
  }
}

export {}