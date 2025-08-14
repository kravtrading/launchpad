import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KravtradeLaunchpad } from "../target/types/kravtrade_launchpad";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram, 
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL 
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from "@solana/spl-token";
import { expect } from "chai";

describe("kravtrade-launchpad", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.KravtradeLaunchpad as Program<KravtradeLaunchpad>;
  const provider = anchor.getProvider();

  // Test accounts
  let admin: Keypair;
  let creator: Keypair;
  let investor1: Keypair;
  let investor2: Keypair;
  let treasury: Keypair;

  // PDAs
  let platformConfigPda: PublicKey;
  let launchConfigPda: PublicKey;
  let treasuryPda: PublicKey;
  let investor1AccountPda: PublicKey;
  let investor2AccountPda: PublicKey;

  // Test data
  const launchId = new anchor.BN(1);
  const tokenName = "Test Token";
  const tokenSymbol = "TEST";
  const tokenDecimals = 9;
  const totalSupply = new anchor.BN(1_000_000 * 10 ** tokenDecimals);
  const presalePrice = new anchor.BN(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL per token
  const minContribution = new anchor.BN(0.01 * LAMPORTS_PER_SOL);
  const maxContribution = new anchor.BN(10 * LAMPORTS_PER_SOL);
  const softCap = new anchor.BN(1 * LAMPORTS_PER_SOL);
  const hardCap = new anchor.BN(10 * LAMPORTS_PER_SOL);

  before(async () => {
    // Initialize test accounts
    admin = Keypair.generate();
    creator = Keypair.generate();
    investor1 = Keypair.generate();
    investor2 = Keypair.generate();
    treasury = Keypair.generate();

    // Airdrop SOL to test accounts
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(admin.publicKey, 10 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(investor1.publicKey, 10 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(investor2.publicKey, 10 * LAMPORTS_PER_SOL)
    );

    // Derive PDAs
    [platformConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("platform"), Buffer.from("config")],
      program.programId
    );

    [launchConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("launch"), launchId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), launchId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    [investor1AccountPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("investor"),
        launchId.toArrayLike(Buffer, "le", 8),
        investor1.publicKey.toBuffer()
      ],
      program.programId
    );

    [investor2AccountPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("investor"),
        launchId.toArrayLike(Buffer, "le", 8),
        investor2.publicKey.toBuffer()
      ],
      program.programId
    );
  });

  describe("Platform Initialization", () => {
    it("Should initialize platform configuration", async () => {
      const platformFeePercentage = 250; // 2.5%
      const minLaunchDuration = 24 * 60 * 60; // 24 hours
      const maxLaunchDuration = 30 * 24 * 60 * 60; // 30 days
      const minSoftCap = new anchor.BN(LAMPORTS_PER_SOL);

      await program.methods
        .initializePlatform(
          platformFeePercentage,
          new anchor.BN(minLaunchDuration),
          new anchor.BN(maxLaunchDuration),
          minSoftCap
        )
        .accounts({
          platformConfig: platformConfigPda,
          admin: admin.publicKey,
          treasury: treasury.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      // Verify platform configuration
      const platformConfig = await program.account.platformConfig.fetch(platformConfigPda);
      expect(platformConfig.admin.toString()).to.equal(admin.publicKey.toString());
      expect(platformConfig.treasury.toString()).to.equal(treasury.publicKey.toString());
      expect(platformConfig.platformFeePercentage).to.equal(platformFeePercentage);
      expect(platformConfig.isPaused).to.be.false;
      expect(platformConfig.totalLaunches.toNumber()).to.equal(0);
    });

    it("Should fail with invalid platform fee", async () => {
      const invalidFee = 6000; // 60% - exceeds maximum
      
      try {
        await program.methods
          .initializePlatform(
            invalidFee,
            new anchor.BN(24 * 60 * 60),
            new anchor.BN(30 * 24 * 60 * 60),
            new anchor.BN(LAMPORTS_PER_SOL)
          )
          .accounts({
            platformConfig: platformConfigPda,
            admin: admin.publicKey,
            treasury: treasury.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        
        expect.fail("Should have failed with invalid platform fee");
      } catch (error) {
        expect(error.message).to.include("InvalidPlatformFee");
      }
    });
  });

  describe("Launch Creation", () => {
    let tokenMint: Keypair;
    let tokenVault: PublicKey;

    beforeEach(() => {
      tokenMint = Keypair.generate();
    });

    it("Should create a new launch", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = new anchor.BN(currentTime + 3600); // 1 hour from now
      const endTime = new anchor.BN(currentTime + 7 * 24 * 3600); // 7 days from now

      tokenVault = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        launchConfigPda,
        true
      );

      const vestingConfig = {
        cliffDuration: new anchor.BN(0),
        vestingDuration: new anchor.BN(30 * 24 * 3600), // 30 days
        initialUnlockPercentage: 1000, // 10%
        isLinear: true,
      };

      const metadata = {
        description: "Test token for launchpad",
        website: "https://test.com",
        twitter: "@test",
        telegram: "https://t.me/test",
        discord: "https://discord.gg/test",
        logoUri: "https://test.com/logo.png",
        documentation: "https://docs.test.com",
      };

      await program.methods
        .createLaunch(
          launchId,
          tokenName,
          tokenSymbol,
          tokenDecimals,
          totalSupply,
          presalePrice,
          minContribution,
          maxContribution,
          softCap,
          hardCap,
          startTime,
          endTime,
          vestingConfig,
          metadata
        )
        .accounts({
          launchConfig: launchConfigPda,
          platformConfig: platformConfigPda,
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

      // Verify launch configuration
      const launchConfig = await program.account.launchConfig.fetch(launchConfigPda);
      expect(launchConfig.creator.toString()).to.equal(creator.publicKey.toString());
      expect(launchConfig.launchId.toNumber()).to.equal(launchId.toNumber());
      expect(launchConfig.name).to.equal(tokenName);
      expect(launchConfig.symbol).to.equal(tokenSymbol);
      expect(launchConfig.status).to.deep.equal({ pending: {} });
      expect(launchConfig.totalRaised.toNumber()).to.equal(0);
    });

    it("Should fail with invalid time parameters", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = new anchor.BN(currentTime - 3600); // 1 hour ago (invalid)
      const endTime = new anchor.BN(currentTime + 7 * 24 * 3600);

      tokenVault = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        launchConfigPda,
        true
      );

      const vestingConfig = {
        cliffDuration: new anchor.BN(0),
        vestingDuration: new anchor.BN(30 * 24 * 3600),
        initialUnlockPercentage: 1000,
        isLinear: true,
      };

      const metadata = {
        description: "Test token",
        website: "",
        twitter: "",
        telegram: "",
        discord: "",
        logoUri: "",
        documentation: "",
      };

      try {
        await program.methods
          .createLaunch(
            launchId,
            tokenName,
            tokenSymbol,
            tokenDecimals,
            totalSupply,
            presalePrice,
            minContribution,
            maxContribution,
            softCap,
            hardCap,
            startTime,
            endTime,
            vestingConfig,
            metadata
          )
          .accounts({
            launchConfig: launchConfigPda,
            platformConfig: platformConfigPda,
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

        expect.fail("Should have failed with invalid time parameters");
      } catch (error) {
        expect(error.message).to.include("InvalidPresaleTime");
      }
    });
  });
});  d
escribe("Launch Approval", () => {
    it("Should approve a launch", async () => {
      await program.methods
        .approveLaunch(launchId)
        .accounts({
          launchConfig: launchConfigPda,
          platformConfig: platformConfigPda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      // Verify launch is approved
      const launchConfig = await program.account.launchConfig.fetch(launchConfigPda);
      expect(launchConfig.status).to.deep.equal({ active: {} });
    });

    it("Should fail approval by non-admin", async () => {
      try {
        await program.methods
          .approveLaunch(launchId)
          .accounts({
            launchConfig: launchConfigPda,
            platformConfig: platformConfigPda,
            admin: creator.publicKey, // Not the admin
          })
          .signers([creator])
          .rpc();

        expect.fail("Should have failed with unauthorized access");
      } catch (error) {
        expect(error.message).to.include("Unauthorized");
      }
    });
  });

  describe("Investor Contributions", () => {
    it("Should allow valid contributions", async () => {
      const contributionAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL);

      await program.methods
        .contribute(contributionAmount)
        .accounts({
          launchConfig: launchConfigPda,
          investorAccount: investor1AccountPda,
          platformConfig: platformConfigPda,
          treasuryAccount: treasuryPda,
          investor: investor1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([investor1])
        .rpc();

      // Verify contribution
      const investorAccount = await program.account.investorAccount.fetch(investor1AccountPda);
      expect(investorAccount.contributionAmount.toNumber()).to.equal(contributionAmount.toNumber());
      expect(investorAccount.investor.toString()).to.equal(investor1.publicKey.toString());

      // Verify launch stats updated
      const launchConfig = await program.account.launchConfig.fetch(launchConfigPda);
      expect(launchConfig.totalRaised.toNumber()).to.equal(contributionAmount.toNumber());
      expect(launchConfig.contributorCount).to.equal(1);
    });

    it("Should allow multiple contributions from same investor", async () => {
      const additionalContribution = new anchor.BN(0.3 * LAMPORTS_PER_SOL);

      await program.methods
        .contribute(additionalContribution)
        .accounts({
          launchConfig: launchConfigPda,
          investorAccount: investor1AccountPda,
          platformConfig: platformConfigPda,
          treasuryAccount: treasuryPda,
          investor: investor1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([investor1])
        .rpc();

      // Verify total contribution
      const investorAccount = await program.account.investorAccount.fetch(investor1AccountPda);
      const expectedTotal = 0.5 * LAMPORTS_PER_SOL + 0.3 * LAMPORTS_PER_SOL;
      expect(investorAccount.contributionAmount.toNumber()).to.equal(expectedTotal);
    });

    it("Should reject contribution below minimum", async () => {
      const tooSmallContribution = new anchor.BN(0.005 * LAMPORTS_PER_SOL); // Below 0.01 SOL minimum

      try {
        await program.methods
          .contribute(tooSmallContribution)
          .accounts({
            launchConfig: launchConfigPda,
            investorAccount: investor2AccountPda,
            platformConfig: platformConfigPda,
            treasuryAccount: treasuryPda,
            investor: investor2.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([investor2])
          .rpc();

        expect.fail("Should have failed with contribution too low");
      } catch (error) {
        expect(error.message).to.include("ContributionTooLow");
      }
    });

    it("Should reject contribution above maximum", async () => {
      const tooLargeContribution = new anchor.BN(15 * LAMPORTS_PER_SOL); // Above 10 SOL maximum

      try {
        await program.methods
          .contribute(tooLargeContribution)
          .accounts({
            launchConfig: launchConfigPda,
            investorAccount: investor2AccountPda,
            platformConfig: platformConfigPda,
            treasuryAccount: treasuryPda,
            investor: investor2.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([investor2])
          .rpc();

        expect.fail("Should have failed with contribution too high");
      } catch (error) {
        expect(error.message).to.include("ContributionTooHigh");
      }
    });
  });

  describe("Launch Finalization", () => {
    it("Should finalize successful launch", async () => {
      // Add more contributions to reach soft cap
      const additionalContribution = new anchor.BN(0.5 * LAMPORTS_PER_SOL);

      await program.methods
        .contribute(additionalContribution)
        .accounts({
          launchConfig: launchConfigPda,
          investorAccount: investor2AccountPda,
          platformConfig: platformConfigPda,
          treasuryAccount: treasuryPda,
          investor: investor2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([investor2])
        .rpc();

      // Wait for presale to end (simulate time passage)
      // In real test, you would manipulate clock or wait

      const tokenMint = Keypair.generate(); // Use the same mint from launch creation
      const tokenVault = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        launchConfigPda,
        true
      );

      await program.methods
        .finalizeLaunch(launchId)
        .accounts({
          launchConfig: launchConfigPda,
          platformConfig: platformConfigPda,
          tokenMint: tokenMint.publicKey,
          tokenVault: tokenVault,
          treasuryAccount: treasuryPda,
          platformTreasury: treasury.publicKey,
          creator: creator.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      // Verify launch is finalized
      const launchConfig = await program.account.launchConfig.fetch(launchConfigPda);
      expect(launchConfig.status).to.deep.equal({ successful: {} });
    });
  });

  describe("Token Claims", () => {
    it("Should allow token claims after successful launch", async () => {
      const tokenMint = Keypair.generate(); // Should be the same from launch
      const tokenVault = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        launchConfigPda,
        true
      );
      const investorTokenAccount = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        investor1.publicKey
      );

      // Create investor token account first
      const createAtaIx = createAssociatedTokenAccountInstruction(
        investor1.publicKey,
        investorTokenAccount,
        investor1.publicKey,
        tokenMint.publicKey
      );

      const tx = new anchor.web3.Transaction().add(createAtaIx);
      await provider.sendAndConfirm(tx, [investor1]);

      await program.methods
        .claimTokens(launchId)
        .accounts({
          launchConfig: launchConfigPda,
          investorAccount: investor1AccountPda,
          tokenVault: tokenVault,
          investorTokenAccount: investorTokenAccount,
          investor: investor1.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([investor1])
        .rpc();

      // Verify tokens were claimed
      const investorAccount = await program.account.investorAccount.fetch(investor1AccountPda);
      expect(investorAccount.claimedAmount.toNumber()).to.be.greaterThan(0);
    });
  });

  describe("Emergency Controls", () => {
    it("Should allow admin to pause launch", async () => {
      await program.methods
        .emergencyPause(launchId)
        .accounts({
          launchConfig: launchConfigPda,
          platformConfig: platformConfigPda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      // Verify launch is paused
      const launchConfig = await program.account.launchConfig.fetch(launchConfigPda);
      expect(launchConfig.status).to.deep.equal({ paused: {} });
    });

    it("Should reject contributions to paused launch", async () => {
      const contribution = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

      try {
        await program.methods
          .contribute(contribution)
          .accounts({
            launchConfig: launchConfigPda,
            investorAccount: investor2AccountPda,
            platformConfig: platformConfigPda,
            treasuryAccount: treasuryPda,
            investor: investor2.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([investor2])
          .rpc();

        expect.fail("Should have failed with presale not active");
      } catch (error) {
        expect(error.message).to.include("PresaleNotActive");
      }
    });
  });

  describe("Platform Configuration Updates", () => {
    it("Should allow admin to update platform config", async () => {
      const newFeePercentage = 300; // 3%

      await program.methods
        .updatePlatformConfig(
          newFeePercentage,
          null,
          null,
          null
        )
        .accounts({
          platformConfig: platformConfigPda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      // Verify config updated
      const platformConfig = await program.account.platformConfig.fetch(platformConfigPda);
      expect(platformConfig.platformFeePercentage).to.equal(newFeePercentage);
    });

    it("Should reject config update by non-admin", async () => {
      try {
        await program.methods
          .updatePlatformConfig(
            400,
            null,
            null,
            null
          )
          .accounts({
            platformConfig: platformConfigPda,
            admin: creator.publicKey, // Not admin
          })
          .signers([creator])
          .rpc();

        expect.fail("Should have failed with unauthorized access");
      } catch (error) {
        expect(error.message).to.include("Unauthorized");
      }
    });
  });
});