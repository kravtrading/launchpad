# KravTrade Launchpad API Documentation

## Overview

The KravTrade Launchpad is a comprehensive Solana smart contract system that enables secure token launches, presale management, and investor participation with built-in vesting mechanisms.

## Program Instructions

### Platform Management

#### `initialize_platform`

Initialize the platform configuration with admin settings.

**Parameters:**
- `platform_fee_percentage: u16` - Platform fee in basis points (max 5000 = 50%)
- `min_launch_duration: i64` - Minimum launch duration in seconds
- `max_launch_duration: i64` - Maximum launch duration in seconds
- `min_soft_cap: u64` - Minimum soft cap in lamports

**Accounts:**
- `platform_config` - Platform configuration PDA (init)
- `admin` - Platform administrator (signer, mut)
- `treasury` - Platform treasury account
- `system_program` - System program

**Example:**
```typescript
await program.methods
  .initializePlatform(
    250, // 2.5% fee
    new BN(24 * 60 * 60), // 24 hours min
    new BN(30 * 24 * 60 * 60), // 30 days max
    new BN(LAMPORTS_PER_SOL) // 1 SOL min soft cap
  )
  .accounts({
    platformConfig: platformConfigPda,
    admin: admin.publicKey,
    treasury: treasury.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([admin])
  .rpc();
```

#### `update_platform_config`

Update platform configuration (admin only).

**Parameters:**
- `platform_fee_percentage: Option<u16>` - New platform fee percentage
- `min_launch_duration: Option<i64>` - New minimum launch duration
- `max_launch_duration: Option<i64>` - New maximum launch duration
- `min_soft_cap: Option<u64>` - New minimum soft cap

**Accounts:**
- `platform_config` - Platform configuration PDA (mut)
- `admin` - Platform administrator (signer)

### Launch Management

#### `create_launch`

Create a new token launch.

**Parameters:**
- `launch_id: u64` - Unique launch identifier
- `name: String` - Token name (max 50 chars)
- `symbol: String` - Token symbol (max 10 chars)
- `decimals: u8` - Token decimals (0-18)
- `total_supply: u64` - Total token supply
- `presale_price: u64` - Price per token in lamports
- `min_contribution: u64` - Minimum contribution in lamports
- `max_contribution: u64` - Maximum contribution in lamports
- `soft_cap: u64` - Soft cap in lamports
- `hard_cap: u64` - Hard cap in lamports
- `start_time: i64` - Presale start time (Unix timestamp)
- `end_time: i64` - Presale end time (Unix timestamp)
- `vesting_config: VestingConfig` - Vesting configuration
- `metadata: LaunchMetadata` - Project metadata

**Accounts:**
- `launch_config` - Launch configuration PDA (init)
- `platform_config` - Platform configuration PDA
- `token_mint` - Token mint account (init)
- `token_vault` - Token vault ATA (init)
- `creator` - Launch creator (signer, mut)
- `token_program` - SPL Token program
- `associated_token_program` - Associated Token program
- `system_program` - System program
- `rent` - Rent sysvar

**Example:**
```typescript
const vestingConfig = {
  cliffDuration: new BN(0),
  vestingDuration: new BN(30 * 24 * 3600), // 30 days
  initialUnlockPercentage: 1000, // 10%
  isLinear: true,
};

const metadata = {
  description: "Revolutionary DeFi token",
  website: "https://example.com",
  twitter: "@example",
  telegram: "https://t.me/example",
  discord: "https://discord.gg/example",
  logoUri: "https://example.com/logo.png",
  documentation: "https://docs.example.com",
};

await program.methods
  .createLaunch(
    launchId,
    "Example Token",
    "EXAMPLE",
    9,
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
```

#### `approve_launch`

Approve a launch for activation (admin only).

**Parameters:**
- `launch_id: u64` - Launch identifier

**Accounts:**
- `launch_config` - Launch configuration PDA (mut)
- `platform_config` - Platform configuration PDA
- `admin` - Platform administrator (signer)

#### `reject_launch`

Reject a launch application (admin only).

**Parameters:**
- `launch_id: u64` - Launch identifier

**Accounts:**
- `launch_config` - Launch configuration PDA (mut)
- `platform_config` - Platform configuration PDA
- `admin` - Platform administrator (signer)

#### `finalize_launch`

Finalize a launch after presale period ends.

**Parameters:**
- `launch_id: u64` - Launch identifier

**Accounts:**
- `launch_config` - Launch configuration PDA (mut)
- `platform_config` - Platform configuration PDA (mut)
- `token_mint` - Token mint account (mut)
- `token_vault` - Token vault ATA (mut)
- `treasury_account` - Launch treasury PDA (mut)
- `platform_treasury` - Platform treasury account (mut)
- `creator` - Launch creator (signer, mut)
- `token_program` - SPL Token program
- `system_program` - System program

### Investor Operations

#### `contribute`

Contribute SOL to a launch.

**Parameters:**
- `amount: u64` - Contribution amount in lamports

**Accounts:**
- `launch_config` - Launch configuration PDA (mut)
- `investor_account` - Investor account PDA (init_if_needed, mut)
- `platform_config` - Platform configuration PDA
- `treasury_account` - Launch treasury PDA (mut)
- `investor` - Investor account (signer, mut)
- `system_program` - System program

**Example:**
```typescript
const contributionAmount = new BN(0.5 * LAMPORTS_PER_SOL);

await program.methods
  .contribute(contributionAmount)
  .accounts({
    launchConfig: launchConfigPda,
    investorAccount: investorAccountPda,
    platformConfig: platformConfigPda,
    treasuryAccount: treasuryPda,
    investor: investor.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([investor])
  .rpc();
```

#### `claim_tokens`

Claim vested tokens from a successful launch.

**Parameters:**
- `launch_id: u64` - Launch identifier

**Accounts:**
- `launch_config` - Launch configuration PDA
- `investor_account` - Investor account PDA (mut)
- `token_vault` - Token vault ATA (mut)
- `investor_token_account` - Investor token ATA (mut)
- `investor` - Investor account (signer)
- `token_program` - SPL Token program

#### `claim_refund`

Claim refund from a failed launch.

**Parameters:**
- `launch_id: u64` - Launch identifier

**Accounts:**
- `launch_config` - Launch configuration PDA
- `investor_account` - Investor account PDA (mut)
- `treasury_account` - Launch treasury PDA (mut)
- `investor` - Investor account (signer, mut)
- `system_program` - System program

### Administrative Controls

#### `emergency_pause`

Emergency pause a launch (admin only).

**Parameters:**
- `launch_id: u64` - Launch identifier

**Accounts:**
- `launch_config` - Launch configuration PDA (mut)
- `platform_config` - Platform configuration PDA
- `admin` - Platform administrator (signer)

#### `collect_fees`

Collect platform fees (admin only).

**Parameters:**
- `amount: u64` - Amount to collect in lamports

**Accounts:**
- `platform_config` - Platform configuration PDA
- `platform_treasury` - Platform treasury account (mut)
- `admin` - Platform administrator (signer, mut)
- `system_program` - System program

## Account Structures

### PlatformConfig

Global platform configuration account.

```rust
pub struct PlatformConfig {
    pub admin: Pubkey,                    // Platform administrator
    pub treasury: Pubkey,                 // Treasury account for fees
    pub platform_fee_percentage: u16,     // Fee percentage (basis points)
    pub min_launch_duration: i64,         // Minimum launch duration (seconds)
    pub max_launch_duration: i64,         // Maximum launch duration (seconds)
    pub min_soft_cap: u64,               // Minimum soft cap (lamports)
    pub is_paused: bool,                 // Platform pause status
    pub total_launches: u64,             // Total launches created
    pub total_raised: u64,               // Total amount raised (lamports)
    pub total_fees_collected: u64,       // Total fees collected (lamports)
    pub bump: u8,                        // PDA bump seed
}
```

**PDA Seeds:** `["platform", "config"]`

### LaunchConfig

Individual launch configuration account.

```rust
pub struct LaunchConfig {
    pub creator: Pubkey,                 // Launch creator
    pub token_mint: Pubkey,              // Token mint address
    pub launch_id: u64,                  // Unique launch ID
    pub name: String,                    // Token name
    pub symbol: String,                  // Token symbol
    pub decimals: u8,                    // Token decimals
    pub total_supply: u64,               // Total token supply
    pub presale_price: u64,              // Price per token (lamports)
    pub min_contribution: u64,           // Minimum contribution (lamports)
    pub max_contribution: u64,           // Maximum contribution (lamports)
    pub soft_cap: u64,                   // Soft cap (lamports)
    pub hard_cap: u64,                   // Hard cap (lamports)
    pub start_time: i64,                 // Presale start time
    pub end_time: i64,                   // Presale end time
    pub total_raised: u64,               // Total amount raised (lamports)
    pub contributor_count: u32,          // Number of contributors
    pub status: LaunchStatus,            // Current launch status
    pub vesting_config: VestingConfig,   // Vesting configuration
    pub metadata: LaunchMetadata,        // Project metadata
    pub bump: u8,                        // PDA bump seed
}
```

**PDA Seeds:** `["launch", launch_id.to_le_bytes()]`

### InvestorAccount

Individual investor participation account.

```rust
pub struct InvestorAccount {
    pub investor: Pubkey,                // Investor public key
    pub launch_id: u64,                  // Launch ID
    pub contribution_amount: u64,        // Total contributed (lamports)
    pub token_allocation: u64,           // Total tokens allocated
    pub claimed_amount: u64,             // Tokens already claimed
    pub last_claim_time: i64,            // Last claim timestamp
    pub is_refunded: bool,               // Refund status
    pub bump: u8,                        // PDA bump seed
}
```

**PDA Seeds:** `["investor", launch_id.to_le_bytes(), investor.key()]`

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | LaunchNotFound | Launch not found |
| 6001 | PresaleNotActive | Presale is not currently active |
| 6002 | ContributionTooLow | Contribution amount is below minimum |
| 6003 | ContributionTooHigh | Contribution amount exceeds maximum |
| 6004 | HardCapExceeded | Hard cap would be exceeded |
| 6005 | InsufficientFunds | Insufficient funds for operation |
| 6006 | VestingNotStarted | Vesting period has not started |
| 6007 | AlreadyClaimed | Tokens already claimed |
| 6008 | LaunchNotApproved | Launch has not been approved by admin |
| 6009 | Unauthorized | Unauthorized access - admin required |
| 6010 | LaunchAlreadyFinalized | Launch has already been finalized |
| 6011 | SoftCapNotReached | Soft cap has not been reached |
| 6012 | InvalidPresaleTime | Presale time window is invalid |
| 6013 | LaunchDurationTooShort | Launch duration is too short |
| 6014 | LaunchDurationTooLong | Launch duration is too long |
| 6015 | SoftCapTooLow | Soft cap is below platform minimum |
| 6016 | InvalidCapConfiguration | Hard cap must be greater than soft cap |
| 6017 | InvalidPlatformFee | Platform fee percentage is invalid |
| 6018 | InvalidLaunchDuration | Launch duration configuration is invalid |
| 6019 | InvalidSoftCap | Soft cap configuration is invalid |
| 6020 | InvalidVestingConfig | Vesting configuration is invalid |
| 6021 | ArithmeticOverflow | Arithmetic overflow occurred |
| 6022 | PlatformPaused | Platform is currently paused |
| 6023 | LaunchPaused | Launch is currently paused |
| 6024 | NoTokensAvailable | No tokens available for claiming |
| 6025 | RefundNotAvailable | Refund not available for this launch |
| 6026 | AlreadyRefunded | Already refunded |
| 6027 | CannotCancelLaunch | Launch cannot be cancelled in current state |
| 6028 | InvalidTokenParameters | Invalid token parameters |
| 6029 | MetadataTooLong | Metadata string too long |
| 6030 | EndTimeInPast | Launch end time must be in the future |
| 6031 | StartTimeAfterEndTime | Launch start time must be before end time |

## Events

The program emits events for all major operations to enable monitoring and analytics:

- Launch creation, approval, rejection
- Contributions and refunds
- Token claims and vesting updates
- Administrative actions
- Platform configuration changes

## Security Considerations

1. **Access Control**: All administrative functions require proper admin authorization
2. **Input Validation**: Comprehensive validation of all input parameters
3. **Arithmetic Safety**: Overflow protection for all mathematical operations
4. **Reentrancy Protection**: Proper state management prevents reentrancy attacks
5. **Time-based Security**: Validation of time-based operations and constraints
6. **Fund Security**: Secure escrow mechanisms for holding investor contributions