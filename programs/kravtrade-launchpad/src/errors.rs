use anchor_lang::prelude::*;

#[error_code]
pub enum LaunchpadError {
    #[msg("Launch not found")]
    LaunchNotFound,
    
    #[msg("Presale is not currently active")]
    PresaleNotActive,
    
    #[msg("Contribution amount is below minimum")]
    ContributionTooLow,
    
    #[msg("Contribution amount exceeds maximum")]
    ContributionTooHigh,
    
    #[msg("Hard cap would be exceeded")]
    HardCapExceeded,
    
    #[msg("Insufficient funds for operation")]
    InsufficientFunds,
    
    #[msg("Vesting period has not started")]
    VestingNotStarted,
    
    #[msg("Tokens already claimed")]
    AlreadyClaimed,
    
    #[msg("Launch has not been approved by admin")]
    LaunchNotApproved,
    
    #[msg("Unauthorized access - admin required")]
    Unauthorized,
    
    #[msg("Launch has already been finalized")]
    LaunchAlreadyFinalized,
    
    #[msg("Soft cap has not been reached")]
    SoftCapNotReached,
    
    #[msg("Presale time window is invalid")]
    InvalidPresaleTime,
    
    #[msg("Launch duration is too short")]
    LaunchDurationTooShort,
    
    #[msg("Launch duration is too long")]
    LaunchDurationTooLong,
    
    #[msg("Soft cap is below platform minimum")]
    SoftCapTooLow,
    
    #[msg("Hard cap must be greater than soft cap")]
    InvalidCapConfiguration,
    
    #[msg("Platform fee percentage is invalid")]
    InvalidPlatformFee,
    
    #[msg("Launch duration configuration is invalid")]
    InvalidLaunchDuration,
    
    #[msg("Soft cap configuration is invalid")]
    InvalidSoftCap,
    
    #[msg("Vesting configuration is invalid")]
    InvalidVestingConfig,
    
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
    
    #[msg("Platform is currently paused")]
    PlatformPaused,
    
    #[msg("Launch is currently paused")]
    LaunchPaused,
    
    #[msg("No tokens available for claiming")]
    NoTokensAvailable,
    
    #[msg("Refund not available for this launch")]
    RefundNotAvailable,
    
    #[msg("Already refunded")]
    AlreadyRefunded,
    
    #[msg("Launch cannot be cancelled in current state")]
    CannotCancelLaunch,
    
    #[msg("Invalid token parameters")]
    InvalidTokenParameters,
    
    #[msg("Metadata string too long")]
    MetadataTooLong,
    
    #[msg("Launch end time must be in the future")]
    EndTimeInPast,
    
    #[msg("Launch start time must be before end time")]
    StartTimeAfterEndTime,
}