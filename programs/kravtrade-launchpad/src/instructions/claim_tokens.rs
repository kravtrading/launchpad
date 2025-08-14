use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{LaunchConfig, InvestorAccount, LaunchStatus};
use crate::constants::*;
use crate::errors::LaunchpadError;

#[derive(Accounts)]
#[instruction(launch_id: u64)]
pub struct ClaimTokens<'info> {
    #[account(
        seeds = [LAUNCH_SEED, launch_id.to_le_bytes().as_ref()],
        bump = launch_config.bump
    )]
    pub launch_config: Account<'info, LaunchConfig>,
    
    #[account(
        mut,
        seeds = [INVESTOR_SEED, launch_id.to_le_bytes().as_ref(), investor.key().as_ref()],
        bump = investor_account.bump
    )]
    pub investor_account: Account<'info, InvestorAccount>,
    
    #[account(
        mut,
        associated_token::mint = launch_config.token_mint,
        associated_token::authority = launch_config,
    )]
    pub token_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = launch_config.token_mint,
        associated_token::authority = investor,
    )]
    pub investor_token_account: Account<'info, TokenAccount>,
    
    pub investor: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn claim_tokens(ctx: Context<ClaimTokens>) -> Result<()> {
    let launch_config = &ctx.accounts.launch_config;
    let investor_account = &mut ctx.accounts.investor_account;
    let current_time = Clock::get()?.unix_timestamp;

    // Validate claim eligibility
    validate_claim_eligibility(launch_config, investor_account)?;

    // Calculate claimable amount based on vesting schedule
    let claimable_amount = investor_account.calculate_claimable_amount(
        current_time,
        &launch_config.vesting_config,
        launch_config.end_time, // Use launch end time as vesting start
    )?;

    if claimable_amount == 0 {
        return Err(LaunchpadError::NoTokensAvailable.into());
    }

    // Transfer tokens from vault to investor
    let launch_id_bytes = launch_config.launch_id.to_le_bytes();
    let seeds = &[
        LAUNCH_SEED,
        launch_id_bytes.as_ref(),
        &[launch_config.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.token_vault.to_account_info(),
                to: ctx.accounts.investor_token_account.to_account_info(),
                authority: ctx.accounts.launch_config.to_account_info(),
            },
            signer_seeds,
        ),
        claimable_amount,
    )?;

    // Update investor account
    investor_account.update_claimed_amount(claimable_amount, current_time)?;

    msg!(
        "Tokens claimed: {} tokens by {} for launch {}",
        claimable_amount,
        ctx.accounts.investor.key(),
        launch_config.launch_id
    );

    Ok(())
}

fn validate_claim_eligibility(
    launch_config: &LaunchConfig,
    investor_account: &InvestorAccount,
) -> Result<()> {
    // Check if launch was successful
    if launch_config.status != LaunchStatus::Successful {
        return Err(LaunchpadError::LaunchNotApproved.into());
    }

    // Check if investor has any allocation
    if investor_account.token_allocation == 0 {
        return Err(LaunchpadError::NoTokensAvailable.into());
    }

    // Check if investor has already claimed all tokens
    if investor_account.claimed_amount >= investor_account.token_allocation {
        return Err(LaunchpadError::AlreadyClaimed.into());
    }

    Ok(())
}