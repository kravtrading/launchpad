import { PublicKey, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

/**
 * Launch status enumeration
 */
export enum LaunchStatus {
  Pending = "pending",
  Active = "active", 
  Successful = "successful",
  Failed = "failed",
  Cancelled = "cancelled",
  Paused = "paused",
}

/**
 * Vesting configuration for token releases
 */
export interface VestingConfig {
  /** Duration of cliff period in seconds */
  cliffDuration: BN;
  /** Total vesting duration in seconds */
  vestingDuration: BN;
  /** Percentage unlocked immediately (in basis points, 10000 = 100%) */
  initialUnlockPercentage: number;
  /** Whether vesting follows linear schedule */
  isLinear: boolean;
}

/**
 * Launch metadata containing project information
 */
export interface LaunchMetadata {
  /** Project description */
  description: string;
  /** Project website URL */
  website: string;
  /** Twitter handle */
  twitter: string;
  /** Telegram link */
  telegram: string;
  /** Discord link */
  discord: string;
  /** Project logo URI */
  logoUri: string;
  /** Whitepaper or documentation link */
  documentation: string;
}

/**
 * Launch configuration parameters
 */
export interface LaunchConfig {
  /** Creator of the launch */
  creator: PublicKey;
  /** Token mint address */
  tokenMint: PublicKey;
  /** Unique launch identifier */
  launchId: BN;
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Token decimals */
  decimals: number;
  /** Total token supply */
  totalSupply: BN;
  /** Price per token in lamports */
  presalePrice: BN;
  /** Minimum contribution amount in lamports */
  minContribution: BN;
  /** Maximum contribution amount in lamports */
  maxContribution: BN;
  /** Soft cap in lamports */
  softCap: BN;
  /** Hard cap in lamports */
  hardCap: BN;
  /** Presale start time (Unix timestamp) */
  startTime: BN;
  /** Presale end time (Unix timestamp) */
  endTime: BN;
  /** Total amount raised in lamports */
  totalRaised: BN;
  /** Number of contributors */
  contributorCount: number;
  /** Current status of the launch */
  status: LaunchStatus;
  /** Vesting configuration */
  vestingConfig: VestingConfig;
  /** Project metadata */
  metadata: LaunchMetadata;
  /** Bump seed for PDA */
  bump: number;
}

/**
 * Investor account data
 */
export interface InvestorAccount {
  /** The investor's public key */
  investor: PublicKey;
  /** Launch ID this investment is for */
  launchId: BN;
  /** Amount contributed in lamports */
  contributionAmount: BN;
  /** Total tokens allocated to this investor */
  tokenAllocation: BN;
  /** Amount of tokens already claimed */
  claimedAmount: BN;
  /** Timestamp of last claim */
  lastClaimTime: BN;
  /** Whether the investor has been refunded */
  isRefunded: boolean;
  /** Bump seed for PDA */
  bump: number;
}

/**
 * Platform configuration
 */
export interface PlatformConfig {
  /** Platform administrator */
  admin: PublicKey;
  /** Treasury account for fee collection */
  treasury: PublicKey;
  /** Platform fee percentage in basis points */
  platformFeePercentage: number;
  /** Minimum launch duration in seconds */
  minLaunchDuration: BN;
  /** Maximum launch duration in seconds */
  maxLaunchDuration: BN;
  /** Minimum soft cap amount in lamports */
  minSoftCap: BN;
  /** Whether the platform is paused */
  isPaused: boolean;
  /** Total number of launches created */
  totalLaunches: BN;
  /** Total amount raised across all launches */
  totalRaised: BN;
  /** Total fees collected by platform */
  totalFeesCollected: BN;
  /** Bump seed for PDA */
  bump: number;
}

/**
 * Parameters for creating a new launch
 */
export interface CreateLaunchParams {
  launchId: BN;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: BN;
  presalePrice: BN;
  minContribution: BN;
  maxContribution: BN;
  softCap: BN;
  hardCap: BN;
  startTime: BN;
  endTime: BN;
  vestingConfig: VestingConfig;
  metadata: LaunchMetadata;
}

/**
 * Parameters for platform initialization
 */
export interface InitializePlatformParams {
  platformFeePercentage: number;
  minLaunchDuration: BN;
  maxLaunchDuration: BN;
  minSoftCap: BN;
  treasury: PublicKey;
}

/**
 * SDK configuration options
 */
export interface LaunchpadSDKConfig {
  /** Program ID of the launchpad program */
  programId: PublicKey;
  /** Cluster endpoint */
  cluster?: string;
  /** Commitment level for transactions */
  commitment?: "processed" | "confirmed" | "finalized";
}

/**
 * Transaction result with signature
 */
export interface TransactionResult {
  /** Transaction signature */
  signature: string;
  /** Whether transaction was successful */
  success: boolean;
  /** Error message if transaction failed */
  error?: string;
}

/**
 * Launch statistics for analytics
 */
export interface LaunchStats {
  /** Launch configuration */
  config: LaunchConfig;
  /** Number of investors */
  investorCount: number;
  /** Percentage of soft cap reached */
  softCapProgress: number;
  /** Percentage of hard cap reached */
  hardCapProgress: number;
  /** Time remaining in seconds (if active) */
  timeRemaining?: number;
  /** Whether launch can be finalized */
  canFinalize: boolean;
}

/**
 * Investor position information
 */
export interface InvestorPosition {
  /** Investor account data */
  account: InvestorAccount;
  /** Claimable token amount */
  claimableAmount: BN;
  /** Vested percentage */
  vestedPercentage: number;
  /** Next vesting date */
  nextVestingDate?: Date;
}

/**
 * Platform statistics
 */
export interface PlatformStats {
  /** Platform configuration */
  config: PlatformConfig;
  /** Total value locked in lamports */
  totalValueLocked: BN;
  /** Number of active launches */
  activeLaunches: number;
  /** Number of successful launches */
  successfulLaunches: number;
  /** Average raise amount */
  averageRaise: BN;
}