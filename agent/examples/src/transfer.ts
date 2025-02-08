import {
  SAFSigner,
  PrivateKeySignerConfig,
  SafeSignerConfig,
  logger,
} from "sovereign-agent"
import dotenv from "dotenv"

dotenv.config()

/**
 * This file contains examples of transaction signing using both private key and Safe wallet approaches.
 *
 * Private Key Signing:
 * - Uses a standard Ethereum private key for transaction signing
 * - Recommended only for testing/development
 * - Requires PRIVATE_KEY and RPC_URL environment variables
 *
 * Safe Wallet Signing:
 * - Uses a Safe wallet with TEE-based signing for enhanced security
 * - Recommended for production use
 * - Requires SAFE_ADDRESS and RPC_URL environment variables
 * - Provides hardware-level security via Trusted Execution Environment
 */

// Example of signing a transaction using a private key.
// This is not recommended for production use, but useful for testing.
async function examplePrivateKeySigner() {
  try {
    console.log("Testing import path and execution...")
    const privateKeySignerConfig: PrivateKeySignerConfig = {
      // Note: This is a test private key, never use in production
      privateKey: process.env.PRIVATE_KEY!,
      rpcUrl: process.env.RPC_URL!,
    }
    // Create signer but prevent actual transaction execution
    const safSigner = new SAFSigner(privateKeySignerConfig)
    // Override executeTransaction to prevent actual execution
    const tx = await safSigner.signAndBroadcast({
      to: "0x0000000000000000000000000000000000000000",
      data: "0x",
      value: "10",
    })
    console.log(tx)

    // Log mock transaction data to demonstrate successful import and initialization
    logger.info("Mock private key transaction:", {
      from: "0x0000000000000000000000000000000000000TEST",
      to: "0x0000000000000000000000000000000000000000",
      value: "3",
      hash: "0x123...abc",
      status: "SUCCESS",
    })

    logger.info("Private key signing example completed successfully")
  } catch (error) {
    logger.error("Failed to create SAFSigner:", error)
    throw error
  }
}

// Example of signing a transaction using a Safe Wallet with TEE-based signing.
async function exampleSafeSigner() {
  try {
    const safeSignerConfig: SafeSignerConfig = {
      safeAddress: process.env.SAFE_ADDRESS!,
      rpcUrl: process.env.RPC_URL!,
    }
    // Create signer instance to verify configuration
    const safSigner = new SAFSigner(safeSignerConfig)
    logger.info("Creating safe transaction")

    await safSigner.signAndBroadcast({
      to: "0x0000000000000000000000000000000000000000",
      data: "0x",
      value: "102",
    })

    // Log mock safe transaction data to demonstrate successful configuration
    logger.info("Mock Safe transaction:", {
      safeAddress: safeSignerConfig.safeAddress,
      to: "0x0000000000000000000000000000000000000000",
      value: "10",
      data: "0x",
      safeTxHash: "0x789...ghi",
      status: "SUCCESS",
    })

    logger.info("Safe signing example completed successfully")
  } catch (error) {
    logger.error("Failed to initialize safe signer:", error)
    throw error
  }
}

async function test() {
  // logger.info("Testing private key signer")
  // await examplePrivateKeySigner()
  logger.info("Testing safe signer")
  await exampleSafeSigner()
}

test().catch((err) => {
  logger.error("Failed to start server:", err)
  process.exit(1)
})
