use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, MintTo};
use crate::state::{LaunchConfig, PlatformConfig, LaunchStatus};
use crate::constants::*;
use crate::errors::LaunchpadError;

#[derive(Accounts)]
#[instruction(launch_id: u64)]
pub struct FinalizeLaunch<'info> {
    #[account(
        mut,
        seeds = [LAUNCH_SEED, launch_id.to_le_bytes().as_ref()],
        bump = launch_config.bump
    )]
    pub launch_config: Account<'info, LaunchConfig>,
    
    #[account(
        mut,
        seeds = [PLATFORM_SEED, CONFIG_SEED],
        bump = platform_config.bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    #[account(
        mut,
        mint::authority = launch_config,
    )]
    pub token_mint: Account<'info, token::Mint>,
    
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = launch_config,
    )]
    pub token_vault: Account<'info, TokenAccount>,
    
    /// CHECK: Treasury account holding contributions
    #[account(
        mut,
        seeds = [TREASURY_SEED, launch_id.to_le_bytes().as_ref()],
        bump
    )]
    pub treasury_account: AccountInfo<'info>,
    
    /// CHECK: Platform treasury for fee collection
    #[account(mut)]
    pub platform_treasury: AccountInfo<'info>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn finalize_launch(ctx: Context<FinalizeLaunch>) -> Result<()> {
    let launch_config = &mut ctx.accounts.launch_config;
    let platform_config = &mut ctx.accounts.platform_config;
    let current_time = Clock::get()?.unix_timestamp;

    // Validate finalization eligibility
    validate_finalization_eligibility(launch_config, current_time)?;

    // Check if creator is authorized
    if launch_config.creator != ctx.accounts.creator.key() {
        return Err(LaunchpadError::Unauthorized.into());
    }

    // Determine launch outcome
    let is_successful = launch_config.has_reached_soft_cap();
    
    if is_successful {
        // Launch successful - mint tokens and distribute funds
        finalize_successful_launch(ctx, launch_config, platform_config)?;
    } else {
        // Launch failed - mark for refunds
        launch_config.status = LaunchStatus::Failed;
        msg!("Launch {} failed to reach soft cap", launch_config.launch_id);
    }

    Ok(())
}

fn validate_finalization_eligibility(
    launch_config: &LaunchConfig,
    current_time: i64,
) -> Result<()> {
    // Check if launch is in correct status
    if launch_config.status != LaunchStatus::Active && launch_config.status != LaunchStatus::Successful {
        return Err(LaunchpadError::LaunchAlreadyFinalized.into());
    }

    // Check if presale period has ended or hard cap reached
    let presale_ended = current_time > launch_config.end_time;
    let hard_cap_reached = launch_config.has_reached_hard_cap();
    
    if !presale_ended && !hard_cap_reached {
        return Err(LaunchpadError::PresaleNotActive.into());
    }

    Ok(())
}

fn finalize_successful_launch(
    ctx: Context<FinalizeLaunch>,
    launch_config: &mut LaunchConfig,
    platform_config: &mut PlatformConfig,
) -> Result<()> {
    let total_raised = launch_config.total_raised;
    
    // Calculate platform fee
    let platform_fee = platform_config.calculate_platform_fee(total_raised)?;
    let creator_amount = total_raised.saturating_sub(platform_fee);

    // Calculate total tokens to mint for presale
    let total_tokens_for_presale = launch_config.calculate_token_allocation(total_raised)?;

    // Mint tokens to vault for distribution
    let launch_id_bytes = launch_config.launch_id.to_le_bytes();
    let seeds = &[
        LAUNCH_SEED,
        launch_id_bytes.as_ref(),
        &[launch_config.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.token_vault.to_account_info(),
                authority: ctx.accounts.launch_config.to_account_info(),
            },
            signer_seeds,
        ),
        total_tokens_for_presale,
    )?;

    // Transfer platform fee to platform treasury
    if platform_fee > 0 {
        **ctx.accounts.treasury_account.try_borrow_mut_lamports()? -= platform_fee;
        **ctx.accounts.platform_treasury.try_borrow_mut_lamports()? += platform_fee;
    }

    // Transfer remaining funds to creator
    if creator_amount > 0 {
        **ctx.accounts.treasury_account.try_borrow_mut_lamports()? -= creator_amount;
        **ctx.accounts.creator.try_borrow_mut_lamports()? += creator_amount;
    }

    // Update launch status
    launch_config.status = LaunchStatus::Successful;

    // Update platform statistics
    platform_config.update_stats(total_raised, platform_fee)?;

    msg!(
        "Launch {} finalized successfully. Raised: {} lamports, Fee: {} lamports, Creator: {} lamports",
        launch_config.launch_id,
        total_raised,
        platform_fee,
        creator_amount
    );

    Ok(())
}