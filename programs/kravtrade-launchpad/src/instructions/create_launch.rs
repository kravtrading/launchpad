use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::{LaunchConfig, PlatformConfig, LaunchStatus, VestingConfig, LaunchMetadata};
use crate::constants::*;
use crate::errors::LaunchpadError;

#[derive(Accounts)]
#[instruction(launch_id: u64)]
pub struct CreateLaunch<'info> {
    #[account(
        init,
        payer = creator,
        space = LaunchConfig::LEN,
        seeds = [LAUNCH_SEED, launch_id.to_le_bytes().as_ref()],
        bump
    )]
    pub launch_config: Account<'info, LaunchConfig>,
    
    #[account(
        seeds = [PLATFORM_SEED, CONFIG_SEED],
        bump = platform_config.bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    #[account(
        init,
        payer = creator,
        mint::decimals = decimals,
        mint::authority = launch_config,
    )]
    pub token_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = launch_config,
    )]
    pub token_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_launch(
    ctx: Context<CreateLaunch>,
    launch_id: u64,
    name: String,
    symbol: String,
    decimals: u8,
    total_supply: u64,
    presale_price: u64,
    min_contribution: u64,
    max_contribution: u64,
    soft_cap: u64,
    hard_cap: u64,
    start_time: i64,
    end_time: i64,
    vesting_config: VestingConfig,
    metadata: LaunchMetadata,
) -> Result<()> {
    let platform_config = &ctx.accounts.platform_config;
    
    // Check if platform is operational
    if !platform_config.is_operational() {
        return Err(LaunchpadError::PlatformPaused.into());
    }

    // Validate input parameters
    validate_launch_parameters(
        &name,
        &symbol,
        decimals,
        total_supply,
        presale_price,
        min_contribution,
        max_contribution,
        soft_cap,
        hard_cap,
        start_time,
        end_time,
        &vesting_config,
        &metadata,
        platform_config,
    )?;

    let launch_config = &mut ctx.accounts.launch_config;
    let current_time = Clock::get()?.unix_timestamp;

    // Initialize launch configuration
    launch_config.creator = ctx.accounts.creator.key();
    launch_config.token_mint = ctx.accounts.token_mint.key();
    launch_config.launch_id = launch_id;
    launch_config.name = name;
    launch_config.symbol = symbol;
    launch_config.decimals = decimals;
    launch_config.total_supply = total_supply;
    launch_config.presale_price = presale_price;
    launch_config.min_contribution = min_contribution;
    launch_config.max_contribution = max_contribution;
    launch_config.soft_cap = soft_cap;
    launch_config.hard_cap = hard_cap;
    launch_config.start_time = start_time;
    launch_config.end_time = end_time;
    launch_config.total_raised = 0;
    launch_config.contributor_count = 0;
    launch_config.status = LaunchStatus::Pending;
    launch_config.vesting_config = vesting_config;
    launch_config.metadata = metadata;
    launch_config.bump = ctx.bumps.launch_config;

    msg!(
        "Launch created: ID {}, Token: {}, Creator: {}",
        launch_id,
        ctx.accounts.token_mint.key(),
        ctx.accounts.creator.key()
    );

    Ok(())
}

fn validate_launch_parameters(
    name: &str,
    symbol: &str,
    decimals: u8,
    total_supply: u64,
    presale_price: u64,
    min_contribution: u64,
    max_contribution: u64,
    soft_cap: u64,
    hard_cap: u64,
    start_time: i64,
    end_time: i64,
    vesting_config: &VestingConfig,
    metadata: &LaunchMetadata,
    platform_config: &PlatformConfig,
) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;

    // Validate string lengths
    if name.len() > MAX_NAME_LENGTH {
        return Err(LaunchpadError::MetadataTooLong.into());
    }
    if symbol.len() > MAX_SYMBOL_LENGTH {
        return Err(LaunchpadError::MetadataTooLong.into());
    }

    // Validate token parameters
    if decimals > MAX_TOKEN_DECIMALS {
        return Err(LaunchpadError::InvalidTokenParameters.into());
    }
    if total_supply == 0 || presale_price == 0 {
        return Err(LaunchpadError::InvalidTokenParameters.into());
    }

    // Validate contribution limits
    if min_contribution == 0 || max_contribution == 0 {
        return Err(LaunchpadError::InvalidTokenParameters.into());
    }
    if min_contribution > max_contribution {
        return Err(LaunchpadError::InvalidTokenParameters.into());
    }

    // Validate caps
    if soft_cap == 0 || hard_cap == 0 {
        return Err(LaunchpadError::InvalidCapConfiguration.into());
    }
    if soft_cap >= hard_cap {
        return Err(LaunchpadError::InvalidCapConfiguration.into());
    }

    // Validate against platform minimums
    platform_config.validate_soft_cap(soft_cap)?;
    platform_config.validate_launch_duration(start_time, end_time)?;

    // Validate time parameters
    if start_time <= current_time {
        return Err(LaunchpadError::InvalidPresaleTime.into());
    }
    if end_time <= start_time {
        return Err(LaunchpadError::StartTimeAfterEndTime.into());
    }

    // Validate vesting configuration
    vesting_config.validate()?;

    // Validate metadata lengths
    validate_metadata_lengths(metadata)?;

    Ok(())
}

fn validate_metadata_lengths(metadata: &LaunchMetadata) -> Result<()> {
    if metadata.description.len() > MAX_DESCRIPTION_LENGTH {
        return Err(LaunchpadError::MetadataTooLong.into());
    }
    if metadata.website.len() > MAX_URL_LENGTH {
        return Err(LaunchpadError::MetadataTooLong.into());
    }
    if metadata.twitter.len() > MAX_SOCIAL_LENGTH {
        return Err(LaunchpadError::MetadataTooLong.into());
    }
    if metadata.telegram.len() > MAX_SOCIAL_LENGTH {
        return Err(LaunchpadError::MetadataTooLong.into());
    }
    if metadata.discord.len() > MAX_SOCIAL_LENGTH {
        return Err(LaunchpadError::MetadataTooLong.into());
    }
    if metadata.logo_uri.len() > MAX_URL_LENGTH {
        return Err(LaunchpadError::MetadataTooLong.into());
    }
    if metadata.documentation.len() > MAX_URL_LENGTH {
        return Err(LaunchpadError::MetadataTooLong.into());
    }
    Ok(())
}