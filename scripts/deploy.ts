import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KravtradeLaunchpad } from "../target/types/kravtrade_launchpad";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  Connection,
  clusterApiUrl
} from "@solana/web3.js";
import fs from "fs";
import path from "path";

/**
 * Deployment configuration
 */
interface DeploymentConfig {
  cluster: "localnet" | "devnet" | "testnet" | "mainnet-beta";
  programId?: string;
  admin?: string;
  treasury?: string;
  platformFeePercentage: number;
  minLaunchDuration: number; // seconds
  maxLaunchDuration: number; // seconds
  minSoftCap: number; // lamports
}

/**
 * Load deployment configuration
 */
function loadConfig(cluster: string): DeploymentConfig {
  const configPath = path.join(__dirname, `../config/${cluster}.json`);
  
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  }

  // Default configuration
  return {
    cluster: cluster as any,
    platformFeePercentage: 250, // 2.5%
    minLaunchDuration: 24 * 60 * 60, // 24 hours
    maxLaunchDuration: 30 * 24 * 60 * 60, // 30 days
    minSoftCap: LAMPORTS_PER_SOL, // 1 SOL
  };
}

/**
 * Save deployment results
 */
function saveDeploymentResults(
  cluster: string,
  results: {
    programId: string;
    platformConfigPda: string;
    admin: string;
    treasury: string;
    deploymentTime: string;
    transactionSignature: string;
  }
) {
  const resultsPath = path.join(__dirname, `../deployments/${cluster}.json`);
  
  // Ensure directory exists
  const dir = path.dirname(resultsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`Deployment results saved to ${resultsPath}`);
}

/**
 * Deploy the launchpad program
 */
async function deploy() {
  const cluster = process.env.CLUSTER || "localnet";
  const config = loadConfig(cluster);
  
  console.log(`Deploying to ${cluster}...`);
  console.log("Configuration:", config);

  // Set up connection and provider
  let connection: Connection;
  if (cluster === "localnet") {
    connection = new Connection("http://127.0.0.1:8899", "confirmed");
  } else {
    connection = new Connection(clusterApiUrl(cluster as any), "confirmed");
  }

  // Load or generate admin keypair
  let admin: Keypair;
  if (config.admin) {
    const adminKeyPath = path.resolve(config.admin);
    if (fs.existsSync(adminKeyPath)) {
      const adminKeyData = JSON.parse(fs.readFileSync(adminKeyPath, "utf8"));
      admin = Keypair.fromSecretKey(new Uint8Array(adminKeyData));
    } else {
      throw new Error(`Admin keypair not found at ${adminKeyPath}`);
    }
  } else {
    admin = Keypair.generate();
    console.log("Generated new admin keypair:", admin.publicKey.toString());
  }

  // Load or generate treasury keypair
  let treasury: Keypair;
  if (config.treasury) {
    const treasuryKeyPath = path.resolve(config.treasury);
    if (fs.existsSync(treasuryKeyPath)) {
      const treasuryKeyData = JSON.parse(fs.readFileSync(treasuryKeyPath, "utf8"));
      treasury = Keypair.fromSecretKey(new Uint8Array(treasuryKeyData));
    } else {
      throw new Error(`Treasury keypair not found at ${treasuryKeyPath}`);
    }
  } else {
    treasury = Keypair.generate();
    console.log("Generated new treasury keypair:", treasury.publicKey.toString());
  }

  // Ensure admin has sufficient balance
  const adminBalance = await connection.getBalance(admin.publicKey);
  console.log(`Admin balance: ${adminBalance / LAMPORTS_PER_SOL} SOL`);
  
  if (adminBalance < 0.1 * LAMPORTS_PER_SOL) {
    if (cluster === "localnet" || cluster === "devnet") {
      console.log("Requesting airdrop for admin...");
      const airdropSignature = await connection.requestAirdrop(
        admin.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(airdropSignature);
      console.log("Airdrop completed");
    } else {
      throw new Error("Insufficient balance for deployment");
    }
  }

  // Set up Anchor provider and program
  const wallet = new anchor.Wallet(admin);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = anchor.workspace.KravtradeLaunchpad as Program<KravtradeLaunchpad>;
  
  // Derive platform config PDA
  const [platformConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("platform"), Buffer.from("config")],
    program.programId
  );

  console.log("Program ID:", program.programId.toString());
  console.log("Platform Config PDA:", platformConfigPda.toString());
  console.log("Admin:", admin.publicKey.toString());
  console.log("Treasury:", treasury.publicKey.toString());

  try {
    // Check if platform is already initialized
    try {
      const existingConfig = await program.account.platformConfig.fetch(platformConfigPda);
      console.log("Platform already initialized!");
      console.log("Existing admin:", existingConfig.admin.toString());
      return;
    } catch (error) {
      // Platform not initialized, proceed with initialization
    }

    // Initialize platform
    console.log("Initializing platform...");
    const tx = await program.methods
      .initializePlatform(
        config.platformFeePercentage,
        new anchor.BN(config.minLaunchDuration),
        new anchor.BN(config.maxLaunchDuration),
        new anchor.BN(config.minSoftCap)
      )
      .accounts({
        platformConfig: platformConfigPda,
        admin: admin.publicKey,
        treasury: treasury.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    console.log("Platform initialized successfully!");
    console.log("Transaction signature:", tx);

    // Verify initialization
    const platformConfig = await program.account.platformConfig.fetch(platformConfigPda);
    console.log("Platform configuration:");
    console.log("- Admin:", platformConfig.admin.toString());
    console.log("- Treasury:", platformConfig.treasury.toString());
    console.log("- Fee percentage:", platformConfig.platformFeePercentage / 100, "%");
    console.log("- Min launch duration:", platformConfig.minLaunchDuration.toNumber() / 3600, "hours");
    console.log("- Max launch duration:", platformConfig.maxLaunchDuration.toNumber() / (24 * 3600), "days");
    console.log("- Min soft cap:", platformConfig.minSoftCap.toNumber() / LAMPORTS_PER_SOL, "SOL");

    // Save deployment results
    saveDeploymentResults(cluster, {
      programId: program.programId.toString(),
      platformConfigPda: platformConfigPda.toString(),
      admin: admin.publicKey.toString(),
      treasury: treasury.publicKey.toString(),
      deploymentTime: new Date().toISOString(),
      transactionSignature: tx,
    });

    console.log("Deployment completed successfully!");

  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

/**
 * Verify deployment
 */
async function verify() {
  const cluster = process.env.CLUSTER || "localnet";
  const deploymentPath = path.join(__dirname, `../deployments/${cluster}.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    console.error(`No deployment found for ${cluster}`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log("Verifying deployment...");
  console.log("Deployment info:", deployment);

  // Set up connection
  let connection: Connection;
  if (cluster === "localnet") {
    connection = new Connection("http://127.0.0.1:8899", "confirmed");
  } else {
    connection = new Connection(clusterApiUrl(cluster as any), "confirmed");
  }

  try {
    // Verify program exists
    const programInfo = await connection.getAccountInfo(new PublicKey(deployment.programId));
    if (!programInfo) {
      throw new Error("Program account not found");
    }
    console.log("✓ Program account exists");

    // Verify platform config
    const platformConfigInfo = await connection.getAccountInfo(new PublicKey(deployment.platformConfigPda));
    if (!platformConfigInfo) {
      throw new Error("Platform config account not found");
    }
    console.log("✓ Platform config account exists");

    console.log("Deployment verification successful!");

  } catch (error) {
    console.error("Verification failed:", error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case "deploy":
      await deploy();
      break;
    case "verify":
      await verify();
      break;
    default:
      console.log("Usage:");
      console.log("  npm run deploy:script deploy   - Deploy the program");
      console.log("  npm run deploy:script verify   - Verify deployment");
      console.log("");
      console.log("Environment variables:");
      console.log("  CLUSTER - Target cluster (localnet, devnet, testnet, mainnet-beta)");
      break;
  }
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});