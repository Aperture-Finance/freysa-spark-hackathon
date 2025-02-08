/* @__PURE__ */ import { ethers } from "ethers"
import { signAndBroadcastSafeTransaction } from "./safe"
import { GrpcEthereumSignerClient } from "./grpcEthereumSignerClient"
import { Wallet } from "ethers"

export enum TransactionMode {
  SAFE_TEE = "safe_tee",
  PRIVATE_KEY = "private_key",
}

export interface SafeSignerConfig {
  rpcUrl?: string
  safeAddress: string
  deployerProxy?: string
}

export interface PrivateKeySignerConfig {
  rpcUrl: string
  privateKey: string
}

export class SAFSigner {
  transactionOrigin: TransactionMode
  privateKey?: string
  rpcUrl?: string
  safeAddress?: string
  deployerProxy?: string
  grpcEthClient?: GrpcEthereumSignerClient

  constructor(config: SafeSignerConfig | PrivateKeySignerConfig) {
    if ("safeAddress" in config) {
      this.transactionOrigin = TransactionMode.SAFE_TEE
      this.rpcUrl = config.rpcUrl
      this.safeAddress = config.safeAddress
      this.deployerProxy = config.deployerProxy
      this.grpcEthClient = new GrpcEthereumSignerClient()
    } else if ("privateKey" in config) {
      this.transactionOrigin = TransactionMode.PRIVATE_KEY
      this.rpcUrl = config.rpcUrl
      this.privateKey = config.privateKey
    } else {
      throw new Error("Invalid configuration for SAFSigner")
    }
  }

  async signMessage(message: string): Promise<string> {
    if (this.transactionOrigin === TransactionMode.PRIVATE_KEY) {
      if (!this.privateKey) {
        throw new Error("Missing PRIVATE_KEY in SAFSigner")
      }
      const wallet = new Wallet(this.privateKey)
      return wallet.signMessage(message)
    } else {
      if (!this.grpcEthClient) {
        throw new Error("GrpcEthereumSignerClient is not initialized")
      }
      return this.grpcEthClient.signMessage(message)
    }
  }

  async getWalletAddress(): Promise<string> {
    if (this.safeAddress) {
      if (!this.grpcEthClient) {
        throw new Error("GrpcEthereumSignerClient is not initialized")
      }
      return await this.grpcEthClient.getAddress()
    } else {
      if (!this.rpcUrl) {
        throw new Error("Missing RPC_URL in SAFSigner")
      }
      if (!this.privateKey) {
        throw new Error("Missing PRIVATE_KEY in SAFSigner")
      }
      const provider = new ethers.JsonRpcProvider(this.rpcUrl)
      const wallet = new ethers.Wallet(this.privateKey, provider)
      return wallet.address
    }
  }

  async signAndBroadcast({
    to,
    data,
    value = "0",
  }: {
    to: string
    data: string
    value?: string
  }): Promise<any> {
    if (this.transactionOrigin === TransactionMode.SAFE_TEE) {
      if (!this.grpcEthClient) {
        throw new Error("GrpcEthereumSignerClient is not initialized")
      }
      if (!this.safeAddress) {
        throw new Error("Safe address is not initialized")
      }
      if (!this.rpcUrl) {
        throw new Error("RPC URL is not initialized")
      }
      return signAndBroadcastSafeTransaction({
        to,
        value,
        data,
        grpcClient: this.grpcEthClient,
        safeAddress: this.safeAddress,
        deployerProxy: this.deployerProxy,
        rpcUrl: this.rpcUrl,
      })
    } else {
      return this.signAndBroadcastPKTransaction(to, data, value)
    }
  }

  private async signAndBroadcastPKTransaction(
    to: string,
    data: string,
    value = "0"
  ): Promise<any> {
    if (!this.rpcUrl) {
      throw new Error("Missing RPC_URL in SAFSigner")
    }

    if (!this.privateKey) {
      throw new Error("Missing PRIVATE_KEY in SAFSigner")
    }

    const provider = new ethers.JsonRpcProvider(this.rpcUrl)
    const wallet = new ethers.Wallet(this.privateKey, provider)

    const tx = await wallet.sendTransaction({
      to,
      data,
      value: value,
    })

    const receipt = await tx.wait()
    return receipt
  }

  private async executePrivateKeySwap(
    to: string,
    data: string,
    value = "0"
  ): Promise<any> {
    if (!this.rpcUrl) {
      throw new Error("Missing RPC_URL in SAFSigner")
    }

    if (!this.privateKey) {
      throw new Error("Missing PRIVATE_KEY in SAFSigner")
    }

    const provider = new ethers.JsonRpcProvider(this.rpcUrl)
    const wallet = new ethers.Wallet(this.privateKey, provider)

    const tx = await wallet.sendTransaction({
      to,
      data,
      value: value,
    })

    const receipt = await tx.wait()
    return receipt
  }
}
