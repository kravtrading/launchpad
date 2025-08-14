import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Keypair,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  Program,
  AnchorProvider,
  BN,
  web3,
} from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import {
  LaunchpadSDKConfig,
  CreateLaunchParams,
  InitializePlatformParams,
  LaunchConfig,
  InvestorAccount,
  PlatformConfig,
  TransactionResult,
  LaunchStats,
  InvestorPosition,
  PlatformStats,
  LaunchStatus,
} from "./types";

/**
 * KravTrade Launchpad SDK
 * Provides high-level methods for interacting with the launchpad program
 */
export class LaunchpadSDK {
  private program: Program;
  private connection: Connection;
  private provider: AnchorProvider;

  // PDA seeds
  private static readonly PLATFORM_SEED = "platform";
  private static readonly CONFIG_SEED = "config";
  private static readonly LAUNCH_SEED = "launch";
  private static readonly INVESTOR_SEED = "investor";
  private static readonly TREASURY_SEED = "treasury";

  constructor(
    program: Program,
    provider: AnchorProvider,
    private config: LaunchpadSDKConfig
  ) {
    this.program = program;
    this.provider = provider;
    this.connection = provider.connection;
  }

  /**
   * Create a new LaunchpadSDK instance
   */
  static create(
    connection: Connection,
    wallet: any,
    config: LaunchpadSDKConfig
  ): LaunchpadSDK {
    const provider = new AnchorProvider(connection, wallet, {
      commitment: config.commitment || "confirmed",
    });
    
    // In a real implementation, you would load the IDL and create the program
    // const program = new Program(IDL, config.programId, provider);
    const program = {} as Program; // Placeholder
    
    return new LaunchpadSDK(program, provider, config);
  }

  // ============================================================================
  // PDA Derivation Methods
  // ============================================================================

  /**
   * Get platform configuration PDA
   */
  getPlatformConfigPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(LaunchpadSDK.PLATFORM_SEED),
        Buffer.from(LaunchpadSDK.CONFIG_SEED),
      ],
      this.config.programId
    );
  }

  /**
   * Get launch configuration PDA
   */
  getLaunchConfigPDA(launchId: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(LaunchpadSDK.LAUNCH_SEED),
        launchId.toArrayLike(Buffer, "le", 8),
      ],
      this.config.programId
    );
  }

  /**
   * Get investor account PDA
   */
  getInvestorAccountPDA(launchId: BN, investor: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(LaunchpadSDK.INVESTOR_SEED),
        launchId.toArrayLike(Buffer, "le", 8),
        investor.toBuffer(),
      ],
      this.config.programId
    );
  }

  /**
   * Get treasury account PDA
   */
  getTreasuryPDA(launchId: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(LaunchpadSDK.TREASURY_SEED),
        launchId.toArrayLike(Buffer, "le", 8),
      ],
      this.config.programId
    );
  }

  // ============================================================================
  // Platform Management Methods
  // ============================================================================

  /**
   * Initialize the platform configuration
   */
  async initializePlatform(
    params: InitializePlatformParams,
    admin: Keypair
  ): Promise<TransactionResult> {
    try {
      const [platformConfigPDA] = this.getPlatformConfigPDA();

      const tx = await this.program.methods
        .initializePlatform(
          params.platformFeePercentage,
          params.minLaunchDuration,
          params.maxLaunchDuration,
          params.minSoftCap
        )
        .accounts({
          platformConfig: platformConfigPDA,
          admin: admin.publicKey,
          treasury: params.treasury,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      return { signature: tx, success: true };
    } catch (error) {
      return {
        signature: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Update platform configuration
   */
  async updatePlatformConfig(
    platformFeePercentage?: number,
    minLaunchDuration?: BN,
    maxLaunchDuration?: BN,
    minSoftCap?: BN,
    admin: Keypair
  ): Promise<TransactionResult> {
    try {
      const [platformConfigPDA] = this.getPlatformConfigPDA();

      const tx = await this.program.methods
        .updatePlatformConfig(
          platformFeePercentage || null,
          minLaunchDuration || null,
          maxLaunchDuration || null,
          minSoftCap || null
        )
        .accounts({
          platformConfig: platformConfigPDA,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      return { signature: tx, success: true };
    } catch (error) {
      return {
        signature: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================================================
  // Launch Management Methods
  // ============================================================================

  /**
   * Create a new token launch
   */
  async createLaunch(
    params: CreateLaunchParams,
    creator: Keypair,
    tokenMint: Keypair
  ): Promise<TransactionResult> {
    try {
      const [platformConfigPDA] = this.getPlatformConfigPDA();
      const [launchConfigPDA] = this.getLaunchConfigPDA(params.launchId);
      
      const tokenVault = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        launchConfigPDA,
        true
      );

      const tx = await this.program.methods
        .createLaunch(
          params.launchId,
          params.name,
          params.symbol,
          params.decimals,
          params.totalSupply,
          params.presalePrice,
          params.minContribution,
          params.maxContribution,
          params.softCap,
          params.hardCap,
          params.startTime,
          params.endTime,
          params.vestingConfig,
          params.metadata
        )
        .accounts({
          launchConfig: launchConfigPDA,
          platformConfig: platformConfigPDA,
          tokenMint: tokenMint.publicKey,
          tokenVault: tokenVault,
          creator: creator.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([creator, tokenMint])
        .rpc();

      return { signature: tx, success: true };
    } catch (error) {
      return {
        signature: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Approve a launch (admin only)
   */
  async approveLaunch(
    launchId: BN,
    admin: Keypair
  ): Promise<TransactionResult> {
    try {
      const [launchConfigPDA] = this.getLaunchConfigPDA(launchId);
      const [platformConfigPDA] = this.getPlatformConfigPDA();

      const tx = await this.program.methods
        .approveLaunch(launchId)
        .accounts({
          launchConfig: launchConfigPDA,
          platformConfig: platformConfigPDA,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      return { signature: tx, success: true };
    } catch (error) {
      return {
        signature: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Reject a launch (admin only)
   */
  async rejectLaunch(
    launchId: BN,
    admin: Keypair
  ): Promise<TransactionResult> {
    try {
      const [launchConfigPDA] = this.getLaunchConfigPDA(launchId);
      const [platformConfigPDA] = this.getPlatformConfigPDA();

      const tx = await this.program.methods
        .rejectLaunch(launchId)
        .accounts({
          launchConfig: launchConfigPDA,
          platformConfig: platformConfigPDA,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      return { signature: tx, success: true };
    } catch (error) {
      return {
        signature: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================================================
  // Investor Methods
  // ============================================================================

  /**
   * Contribute to a launch
   */
  async contribute(
    launchId: BN,
    amount: BN,
    investor: Keypair
  ): Promise<TransactionResult> {
    try {
      const [launchConfigPDA] = this.getLaunchConfigPDA(launchId);
      const [investorAccountPDA] = this.getInvestorAccountPDA(launchId, investor.publicKey);
      const [platformConfigPDA] = this.getPlatformConfigPDA();
      const [treasuryPDA] = this.getTreasuryPDA(launchId);

      const tx = await this.program.methods
        .contribute(amount)
        .accounts({
          launchConfig: launchConfigPDA,
          investorAccount: investorAccountPDA,
          platformConfig: platformConfigPDA,
          treasuryAccount: treasuryPDA,
          investor: investor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([investor])
        .rpc();

      return { signature: tx, success: true };
    } catch (error) {
      return {
        signature: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Claim vested tokens
   */
  async claimTokens(
    launchId: BN,
    investor: Keypair
  ): Promise<TransactionResult> {
    try {
      const [launchConfigPDA] = this.getLaunchConfigPDA(launchId);
      const [investorAccountPDA] = this.getInvestorAccountPDA(launchId, investor.publicKey);
      
      // Get launch config to find token mint
      const launchConfig = await this.getLaunchConfig(launchId);
      if (!launchConfig) {
        throw new Error("Launch not found");
      }

      const tokenVault = await getAssociatedTokenAddress(
        launchConfig.tokenMint,
        launchConfigPDA,
        true
      );

      const investorTokenAccount = await getAssociatedTokenAddress(
        launchConfig.tokenMint,
        investor.publicKey
      );

      // Create associated token account if it doesn't exist
      const accountInfo = await this.connection.getAccountInfo(investorTokenAccount);
      const instructions = [];
      
      if (!accountInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            investor.publicKey,
            investorTokenAccount,
            investor.publicKey,
            launchConfig.tokenMint
          )
        );
      }

      const tx = await this.program.methods
        .claimTokens(launchId)
        .accounts({
          launchConfig: launchConfigPDA,
          investorAccount: investorAccountPDA,
          tokenVault: tokenVault,
          investorTokenAccount: investorTokenAccount,
          investor: investor.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions(instructions)
        .signers([investor])
        .rpc();

      return { signature: tx, success: true };
    } catch (error) {
      return {
        signature: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================================================
  // Data Fetching Methods
  // ============================================================================

  /**
   * Get platform configuration
   */
  async getPlatformConfig(): Promise<PlatformConfig | null> {
    try {
      const [platformConfigPDA] = this.getPlatformConfigPDA();
      return await this.program.account.platformConfig.fetch(platformConfigPDA);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get launch configuration
   */
  async getLaunchConfig(launchId: BN): Promise<LaunchConfig | null> {
    try {
      const [launchConfigPDA] = this.getLaunchConfigPDA(launchId);
      return await this.program.account.launchConfig.fetch(launchConfigPDA);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get investor account
   */
  async getInvestorAccount(
    launchId: BN,
    investor: PublicKey
  ): Promise<InvestorAccount | null> {
    try {
      const [investorAccountPDA] = this.getInvestorAccountPDA(launchId, investor);
      return await this.program.account.investorAccount.fetch(investorAccountPDA);
    } catch (error) {
      return null;
    }
  }

  // ============================================================================
  // Analytics and Statistics Methods
  // ============================================================================

  /**
   * Get launch statistics
   */
  async getLaunchStats(launchId: BN): Promise<LaunchStats | null> {
    const launchConfig = await this.getLaunchConfig(launchId);
    if (!launchConfig) return null;

    const softCapProgress = launchConfig.totalRaised.toNumber() / launchConfig.softCap.toNumber() * 100;
    const hardCapProgress = launchConfig.totalRaised.toNumber() / launchConfig.hardCap.toNumber() * 100;
    
    const currentTime = Math.floor(Date.now() / 1000);
    const timeRemaining = launchConfig.status === LaunchStatus.Active 
      ? Math.max(0, launchConfig.endTime.toNumber() - currentTime)
      : undefined;

    const canFinalize = launchConfig.status === LaunchStatus.Active &&
      (currentTime > launchConfig.endTime.toNumber() || 
       launchConfig.totalRaised.gte(launchConfig.hardCap));

    return {
      config: launchConfig,
      investorCount: launchConfig.contributorCount,
      softCapProgress,
      hardCapProgress,
      timeRemaining,
      canFinalize,
    };
  }

  /**
   * Get investor position
   */
  async getInvestorPosition(
    launchId: BN,
    investor: PublicKey
  ): Promise<InvestorPosition | null> {
    const investorAccount = await this.getInvestorAccount(launchId, investor);
    const launchConfig = await this.getLaunchConfig(launchId);
    
    if (!investorAccount || !launchConfig) return null;

    // Calculate claimable amount (simplified - would need full vesting logic)
    const currentTime = Math.floor(Date.now() / 1000);
    const claimableAmount = new BN(0); // Placeholder - implement vesting calculation
    
    const vestedPercentage = investorAccount.tokenAllocation.gt(new BN(0))
      ? investorAccount.claimedAmount.toNumber() / investorAccount.tokenAllocation.toNumber() * 100
      : 0;

    return {
      account: investorAccount,
      claimableAmount,
      vestedPercentage,
      nextVestingDate: undefined, // Calculate based on vesting schedule
    };
  }

  /**
   * Get platform statistics
   */
  async getPlatformStats(): Promise<PlatformStats | null> {
    const platformConfig = await this.getPlatformConfig();
    if (!platformConfig) return null;

    // These would require additional queries to get accurate data
    const totalValueLocked = new BN(0); // Sum of all active launch treasuries
    const activeLaunches = 0; // Count of launches with status Active
    const successfulLaunches = 0; // Count of launches with status Successful
    const averageRaise = new BN(0); // Average of successful launches

    return {
      config: platformConfig,
      totalValueLocked,
      activeLaunches,
      successfulLaunches,
      averageRaise,
    };
  }
}