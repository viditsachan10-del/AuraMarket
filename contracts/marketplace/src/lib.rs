#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    log, symbol_short,
    token,
    Address, Env, Vec,
};

// ── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    NftContract,
    TokenAddress,
    ProtocolFee,
    Listing(u64),
    ActiveListings,
}

// ── Data Structures ──────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Listing {
    pub nft_id: u64,
    pub seller: Address,
    pub price_xlm: i128,
    pub active: bool,
    pub listed_at: u64,
}

// ── NFT contract client (inter-contract call interface) ───────────────────────

mod nft_contract {
    use soroban_sdk::contractimport;
    contractimport!(file = "./nft.wasm");
}

// ── Errors ───────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Clone, Debug, Copy, PartialEq)]
#[repr(u32)]
pub enum MarketError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    ListingNotFound = 4,
    ListingInactive = 5,
    NotSeller = 6,
    NotOwner = 7,
    InvalidPrice = 8,
    InsufficientBalance = 9,
}

// ── TTL constants ─────────────────────────────────────────────────────────────

const LEDGER_BUMP: u32 = 17_280;
const LEDGER_THRESHOLD: u32 = 17_280;

// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct MarketplaceContract;

#[contractimpl]
impl MarketplaceContract {
    // ── initialize ────────────────────────────────────────────────────────────

    pub fn initialize(
        env: Env,
        admin: Address,
        nft_contract: Address,
        token_address: Address,
        fee_bps: u32,
    ) -> Result<(), MarketError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(MarketError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NftContract, &nft_contract);
        env.storage().instance().set(&DataKey::TokenAddress, &token_address);
        env.storage().instance().set(&DataKey::ProtocolFee, &fee_bps);
        env.storage().instance().set(&DataKey::ActiveListings, &Vec::<u64>::new(&env));
        env.storage().instance().extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);
        Ok(())
    }

    // ── list_nft ──────────────────────────────────────────────────────────────
    // Inter-contract calls: get_nft (verify ownership) + set_listed(true)

    pub fn list_nft(
        env: Env,
        seller: Address,
        nft_id: u64,
        price_xlm: i128,
    ) -> Result<(), MarketError> {
        seller.require_auth();

        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(MarketError::NotInitialized);
        }
        if price_xlm <= 0 {
            return Err(MarketError::InvalidPrice);
        }

        let nft_contract_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::NftContract)
            .ok_or(MarketError::NotInitialized)?;

        // ── INTER-CONTRACT CALL 1: verify seller owns NFT ──────────────────
        let nft_client = nft_contract::Client::new(&env, &nft_contract_id);
        let nft = nft_client.get_nft(&nft_id).unwrap();
        if nft.owner != seller {
            return Err(MarketError::NotOwner);
        }

        // ── INTER-CONTRACT CALL 2: mark NFT as listed in NFT contract ──────
        nft_client.set_listed(&env.current_contract_address(), &nft_id, &true);

        // Store listing
        let listing = Listing {
            nft_id,
            seller: seller.clone(),
            price_xlm,
            active: true,
            listed_at: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&DataKey::Listing(nft_id), &listing);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Listing(nft_id), LEDGER_THRESHOLD, LEDGER_BUMP);

        // Update active listings index
        let mut active: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::ActiveListings)
            .unwrap_or_else(|| Vec::new(&env));
        if !active.contains(&nft_id) {
            active.push_back(nft_id);
        }
        env.storage().instance().set(&DataKey::ActiveListings, &active);
        env.storage().instance().extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);

        env.events()
            .publish((symbol_short!("list"), nft_id, seller.clone(), price_xlm), nft_id);
        log!(&env, "AuraMarket listed: nft_id={} seller={} price={}", nft_id, seller, price_xlm);
        Ok(())
    }

    // ── buy_nft ───────────────────────────────────────────────────────────────
    // Inter-contract calls: transfer (ownership) + set_listed(false)

    pub fn buy_nft(env: Env, buyer: Address, nft_id: u64) -> Result<(), MarketError> {
        buyer.require_auth();

        let listing: Listing = env
            .storage()
            .persistent()
            .get(&DataKey::Listing(nft_id))
            .ok_or(MarketError::ListingNotFound)?;

        if !listing.active {
            return Err(MarketError::ListingInactive);
        }

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(MarketError::NotInitialized)?;

        let fee_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ProtocolFee)
            .unwrap_or(250u32);

        let nft_contract_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::NftContract)
            .ok_or(MarketError::NotInitialized)?;

        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenAddress)
            .ok_or(MarketError::NotInitialized)?;

        // Calculate fee split
        let fee_amount = listing.price_xlm * (fee_bps as i128) / 10_000;
        let seller_amount = listing.price_xlm - fee_amount;

        // Native XLM token (Stellar asset contract)
        let xlm_token = token::Client::new(&env, &token_address);

        // Transfer seller_amount → seller
        xlm_token.transfer(&buyer, &listing.seller, &seller_amount);

        // Transfer fee → admin
        if fee_amount > 0 {
            xlm_token.transfer(&buyer, &admin, &fee_amount);
        }

        // ── INTER-CONTRACT CALL 3: transfer NFT ownership ──────────────────
        let nft_client = nft_contract::Client::new(&env, &nft_contract_id);
        nft_client.transfer(&env.current_contract_address(), &listing.seller, &buyer, &nft_id);

        // ── INTER-CONTRACT CALL 4: unmark listing in NFT contract ──────────
        nft_client.set_listed(&env.current_contract_address(), &nft_id, &false);

        // Mark listing inactive
        let mut updated = listing.clone();
        updated.active = false;
        env.storage().persistent().set(&DataKey::Listing(nft_id), &updated);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Listing(nft_id), LEDGER_THRESHOLD, LEDGER_BUMP);

        // Remove from active index
        Self::remove_active(&env, nft_id);

        env.events().publish(
            (
                symbol_short!("sale"),
                nft_id,
                buyer.clone(),
                listing.seller.clone(),
                listing.price_xlm,
            ),
            nft_id,
        );
        log!(
            &env,
            "AuraMarket sale: nft_id={} buyer={} seller={} price={}",
            nft_id,
            buyer,
            listing.seller,
            listing.price_xlm
        );
        Ok(())
    }

    // ── delist_nft ────────────────────────────────────────────────────────────
    // Inter-contract call: set_listed(false)

    pub fn delist_nft(env: Env, seller: Address, nft_id: u64) -> Result<(), MarketError> {
        seller.require_auth();

        let listing: Listing = env
            .storage()
            .persistent()
            .get(&DataKey::Listing(nft_id))
            .ok_or(MarketError::ListingNotFound)?;

        if listing.seller != seller {
            return Err(MarketError::NotSeller);
        }
        if !listing.active {
            return Err(MarketError::ListingInactive);
        }

        let nft_contract_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::NftContract)
            .ok_or(MarketError::NotInitialized)?;

        // ── INTER-CONTRACT CALL 5: unmark listing in NFT contract ──────────
        let nft_client = nft_contract::Client::new(&env, &nft_contract_id);
        nft_client.set_listed(&seller, &nft_id, &false);

        // Mark listing inactive
        let mut updated = listing;
        updated.active = false;
        env.storage().persistent().set(&DataKey::Listing(nft_id), &updated);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Listing(nft_id), LEDGER_THRESHOLD, LEDGER_BUMP);

        // Remove from active index
        Self::remove_active(&env, nft_id);

        env.events()
            .publish((symbol_short!("delist"), nft_id, seller.clone()), nft_id);
        log!(&env, "AuraMarket delisted: nft_id={} seller={}", nft_id, seller);
        Ok(())
    }

    // ── get_listing ───────────────────────────────────────────────────────────

    pub fn get_listing(env: Env, nft_id: u64) -> Result<Listing, MarketError> {
        let listing: Listing = env
            .storage()
            .persistent()
            .get(&DataKey::Listing(nft_id))
            .ok_or(MarketError::ListingNotFound)?;

        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Listing(nft_id), LEDGER_THRESHOLD, LEDGER_BUMP);
        Ok(listing)
    }

    // ── get_active_listings ───────────────────────────────────────────────────

    pub fn get_active_listings(env: Env) -> Vec<u64> {
        env.storage()
            .instance()
            .get(&DataKey::ActiveListings)
            .unwrap_or_else(|| Vec::new(&env))
    }

    // ── get_fee ───────────────────────────────────────────────────────────────

    pub fn get_fee(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::ProtocolFee)
            .unwrap_or(250u32)
    }

    // ── internal helpers ──────────────────────────────────────────────────────

    fn remove_active(env: &Env, nft_id: u64) {
        let mut active: Vec<u64> = env.storage().instance().get(&DataKey::ActiveListings).unwrap_or(Vec::new(env));
        if let Some(idx) = active.first_index_of(nft_id) {
            active.remove(idx);
        }
        env.storage().instance().set(&DataKey::ActiveListings, &active);
        env.storage().instance().extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);
    }
}

#[cfg(test)]
mod test;

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    // Integration tests would require both WASM contracts compiled.
    // Run: cargo test --features testutils
    // Full test suite lives in tests/integration.rs once WASM artifacts built.

    #[test]
    fn placeholder_compiles() {
        assert_eq!(1 + 1, 2);
    }
}
