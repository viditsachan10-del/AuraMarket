#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    log, symbol_short,
    Address, Env, String, Vec,
};

// ── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    TotalSupply,
    Nft(u64),
    OwnerNfts(Address),
}

// ── Data Structures ──────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct NftMetadata {
    pub id: u64,
    pub name: String,
    pub description: String,
    pub image_url: String,
    pub owner: Address,
    pub creator: Address,
    pub created_at: u64,
    pub is_listed: bool,
}

// ── Errors ───────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Clone, Debug, Copy, PartialEq)]
#[repr(u32)]
pub enum NftError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    NftNotFound = 4,
    NotOwner = 5,
    InvalidInput = 6,
}

// ── TTL constants (ledgers) ───────────────────────────────────────────────────

const LEDGER_BUMP: u32 = 17_280;   // ~24 h on Stellar (5 s/ledger)
const LEDGER_THRESHOLD: u32 = 17_280;

// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct NftContract;

#[contractimpl]
impl NftContract {
    // ── initialize ────────────────────────────────────────────────────────────

    pub fn initialize(env: Env, admin: Address) -> Result<(), NftError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(NftError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalSupply, &0u64);
        env.storage().instance().extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);
        Ok(())
    }

    // ── mint ──────────────────────────────────────────────────────────────────

    pub fn mint(
        env: Env,
        to: Address,
        name: String,
        description: String,
        image_url: String,
    ) -> Result<u64, NftError> {
        to.require_auth();

        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(NftError::NotInitialized);
        }
        if name.len() == 0 || image_url.len() == 0 {
            return Err(NftError::InvalidInput);
        }

        // Increment supply
        let mut total: u64 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        total += 1;
        env.storage().instance().set(&DataKey::TotalSupply, &total);
        env.storage().instance().extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);

        let id = total;
        let now = env.ledger().timestamp();

        let metadata = NftMetadata {
            id,
            name,
            description,
            image_url,
            owner: to.clone(),
            creator: to.clone(),
            created_at: now,
            is_listed: false,
        };

        // Store NFT
        env.storage().persistent().set(&DataKey::Nft(id), &metadata);
        env.storage().persistent().extend_ttl(&DataKey::Nft(id), LEDGER_THRESHOLD, LEDGER_BUMP);

        // Update owner list
        let mut owner_nfts: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerNfts(to.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        owner_nfts.push_back(id);
        env.storage().persistent().set(&DataKey::OwnerNfts(to.clone()), &owner_nfts);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::OwnerNfts(to.clone()), LEDGER_THRESHOLD, LEDGER_BUMP);

        // Emit event
        env.events().publish((symbol_short!("mint"), id, to), id);

        log!(&env, "AuraMarket NFT minted: id={}", id);
        Ok(id)
    }

    // ── transfer ──────────────────────────────────────────────────────────────

    pub fn transfer(env: Env, from: Address, to: Address, id: u64) -> Result<(), NftError> {
        from.require_auth();

        let mut metadata: NftMetadata = env
            .storage()
            .persistent()
            .get(&DataKey::Nft(id))
            .ok_or(NftError::NftNotFound)?;

        if metadata.owner != from {
            return Err(NftError::NotOwner);
        }

        // Remove from sender's list
        let mut from_nfts: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerNfts(from.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        if let Some(idx) = from_nfts.first_index_of(id) {
            from_nfts.remove(idx);
        }
        env.storage().persistent().set(&DataKey::OwnerNfts(from.clone()), &from_nfts);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::OwnerNfts(from.clone()), LEDGER_THRESHOLD, LEDGER_BUMP);

        // Add to receiver's list
        let mut to_nfts: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerNfts(to.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        to_nfts.push_back(id);
        env.storage().persistent().set(&DataKey::OwnerNfts(to.clone()), &to_nfts);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::OwnerNfts(to.clone()), LEDGER_THRESHOLD, LEDGER_BUMP);

        // Update NFT owner + clear listing
        metadata.owner = to.clone();
        metadata.is_listed = false;
        env.storage().persistent().set(&DataKey::Nft(id), &metadata);
        env.storage().persistent().extend_ttl(&DataKey::Nft(id), LEDGER_THRESHOLD, LEDGER_BUMP);

        env.events().publish((symbol_short!("transfer"), id, from.clone(), to.clone()), id);
        log!(&env, "AuraMarket NFT transferred: id={} from={} to={}", id, from, to);
        Ok(())
    }

    // ── get_nft ───────────────────────────────────────────────────────────────

    pub fn get_nft(env: Env, id: u64) -> Result<NftMetadata, NftError> {
        let metadata: NftMetadata = env
            .storage()
            .persistent()
            .get(&DataKey::Nft(id))
            .ok_or(NftError::NftNotFound)?;

        env.storage().persistent().extend_ttl(&DataKey::Nft(id), LEDGER_THRESHOLD, LEDGER_BUMP);
        Ok(metadata)
    }

    // ── get_owner_nfts ────────────────────────────────────────────────────────

    pub fn get_owner_nfts(env: Env, owner: Address) -> Vec<u64> {
        let nfts: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerNfts(owner.clone()))
            .unwrap_or_else(|| Vec::new(&env));

        env.storage()
            .persistent()
            .extend_ttl(&DataKey::OwnerNfts(owner), LEDGER_THRESHOLD, LEDGER_BUMP);
        nfts
    }

    // ── total_supply ──────────────────────────────────────────────────────────

    pub fn total_supply(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
    }

    // ── set_listed ────────────────────────────────────────────────────────────
    // Callable by owner OR marketplace contract (no auth check for marketplace
    // because marketplace already verified ownership in its own auth flow).

    pub fn set_listed(
        env: Env,
        caller: Address,
        id: u64,
        listed: bool,
    ) -> Result<(), NftError> {
        let mut metadata: NftMetadata = env
            .storage()
            .persistent()
            .get(&DataKey::Nft(id))
            .ok_or(NftError::NftNotFound)?;

        // Caller must be owner OR admin (marketplace is registered as admin)
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(NftError::NotInitialized)?;

        if caller != metadata.owner && caller != admin {
            caller.require_auth();
            // Re-verify after auth
            if caller != metadata.owner && caller != admin {
                return Err(NftError::Unauthorized);
            }
        } else {
            caller.require_auth();
        }

        metadata.is_listed = listed;
        env.storage().persistent().set(&DataKey::Nft(id), &metadata);
        env.storage().persistent().extend_ttl(&DataKey::Nft(id), LEDGER_THRESHOLD, LEDGER_BUMP);

        env.events().publish((symbol_short!("listed"), id, listed), id);
        log!(&env, "AuraMarket NFT listing status: id={} listed={}", id, listed);
        Ok(())
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::{Env, String};

    #[test]
    fn test_mint_and_get() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, NftContract);
        let client = NftContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        client.initialize(&admin);

        let id = client.mint(
            &user,
            &String::from_str(&env, "Aura #1"),
            &String::from_str(&env, "First AuraMarket NFT"),
            &String::from_str(&env, "https://example.com/nft/1.png"),
        );

        assert_eq!(id, 1u64);
        assert_eq!(client.total_supply(), 1u64);

        let nft = client.get_nft(&1u64);
        assert_eq!(nft.owner, user);
        assert_eq!(nft.is_listed, false);
    }

    #[test]
    fn test_transfer() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, NftContract);
        let client = NftContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.initialize(&admin);
        let id = client.mint(
            &alice,
            &String::from_str(&env, "Aura #1"),
            &String::from_str(&env, "Test NFT"),
            &String::from_str(&env, "https://example.com/1.png"),
        );

        client.transfer(&alice, &bob, &id);

        let nft = client.get_nft(&id);
        assert_eq!(nft.owner, bob);

        let alice_nfts = client.get_owner_nfts(&alice);
        assert_eq!(alice_nfts.len(), 0);

        let bob_nfts = client.get_owner_nfts(&bob);
        assert_eq!(bob_nfts.len(), 1);
    }
}
