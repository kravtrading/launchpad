/// Platform configuration PDA seed
pub const PLATFORM_SEED: &[u8] = b"platform";
pub const CONFIG_SEED: &[u8] = b"config";

/// Launch configuration PDA seed
pub const LAUNCH_SEED: &[u8] = b"launch";

/// Investor account PDA seed
pub const INVESTOR_SEED: &[u8] = b"investor";

/// Treasury account PDA seed
pub const TREASURY_SEED: &[u8] = b"treasury";

/// Vesting account PDA seed
pub const VESTING_SEED: &[u8] = b"vesting";

/// Maximum string lengths for validation
pub const MAX_NAME_LENGTH: usize = 50;
pub const MAX_SYMBOL_LENGTH: usize = 10;
pub const MAX_DESCRIPTION_LENGTH: usize = 500;
pub const MAX_URL_LENGTH: usize = 200;
pub const MAX_SOCIAL_LENGTH: usize = 100;

/// Time constants
pub const SECONDS_PER_DAY: i64 = 86_400;
pub const SECONDS_PER_HOUR: i64 = 3_600;

/// Basis points for percentage calculations (10000 = 100%)
pub const BASIS_POINTS_MAX: u16 = 10_000;

/// Default platform configuration values
pub const DEFAULT_PLATFORM_FEE: u16 = 250; // 2.5%
pub const DEFAULT_MIN_LAUNCH_DURATION: i64 = 24 * SECONDS_PER_HOUR; // 24 hours
pub const DEFAULT_MAX_LAUNCH_DURATION: i64 = 30 * SECONDS_PER_DAY; // 30 days
pub const DEFAULT_MIN_SOFT_CAP: u64 = 1_000_000_000; // 1 SOL in lamports

/// Token decimals limits
pub const MIN_TOKEN_DECIMALS: u8 = 0;
pub const MAX_TOKEN_DECIMALS: u8 = 18;

/// Contribution limits (in lamports)
pub const MIN_CONTRIBUTION_LIMIT: u64 = 10_000_000; // 0.01 SOL
pub const MAX_CONTRIBUTION_LIMIT: u64 = 1_000_000_000_000; // 1000 SOL