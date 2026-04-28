//! NFT contract for AuraMarket.
//! Implements basic NFT functionality: minting and transfers.
//! Includes marketplace-specific authorization hooks.

#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, IntoVal, Map,
    String, Symbol, Val, Vec,
};

// ── Data Keys ────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    Admin,
    TotalSupply,
    Nft(u64),
    OwnerNfts(Address),
    Marketplace,
}

// ── Data Structures ──────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct NftMetadata {
    pub id: u64,
    pub name: String,
    pub description: String,
    pub image_url: String,
    pub owner: Address,
    pub is_listed: bool,
    pub created_at: u64,
    pub creator: Address,
}

// ── Errors ───────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum NftError {
    NotInitialized = 1,
    Unauthorized = 2,
    NotFound = 3,
    AlreadyListed = 4,
}

// ── Constants ────────────────────────────────────────────────────────────────

const LEDGER_THRESHOLD: u32 = 120960; // ~1 week
const LEDGER_BUMP: u32 = 241920;      // ~2 weeks

#[contract]
pub struct NftContract;

#[contractimpl]
impl NftContract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), NftError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(NftError::NotInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalSupply, &0u64);
        Ok(())
    }

    pub fn set_marketplace(env: Env, admin: Address, marketplace: Address) {
        admin.require_auth();
        let current_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != current_admin {
            panic!("Unauthorized admin");
        }
        env.storage().instance().set(&DataKey::Marketplace, &marketplace);
    }

    pub fn mint(
        env: Env,
        to: Address,
        name: String,
        description: String,
        image_url: String,
    ) -> Result<u64, NftError> {
        to.require_auth();

        let mut id: u64 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        id += 1;
        env.storage().instance().set(&DataKey::TotalSupply, &id);

        let metadata = NftMetadata {
            id,
            name,
            description,
            image_url,
            owner: to.clone(),
            is_listed: false,
            created_at: env.ledger().timestamp(),
            creator: to.clone(),
        };

        env.storage().persistent().set(&DataKey::Nft(id), &metadata);
        env.storage().persistent().extend_ttl(&DataKey::Nft(id), LEDGER_THRESHOLD, LEDGER_BUMP);

        let mut owner_nfts: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerNfts(to.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        owner_nfts.push_back(id);
        env.storage().persistent().set(&DataKey::OwnerNfts(to.clone()), &owner_nfts);

        env.events().publish((symbol_short!("mint"), id, to), id);
        Ok(id)
    }

    pub fn transfer(env: Env, caller: Address, from: Address, to: Address, id: u64) -> Result<(), NftError> {
        let marketplace_addr: Option<Address> = env.storage().instance().get(&DataKey::Marketplace);
        
        let mut authorized = false;
        if let Some(m) = marketplace_addr {
            if caller == m {
                authorized = true;
            }
        }

        if caller != from && !authorized {
            return Err(NftError::Unauthorized);
        }

        caller.require_auth();

        let mut metadata: NftMetadata = env
            .storage()
            .persistent()
            .get(&DataKey::Nft(id))
            .ok_or(NftError::NotFound)?;

        if metadata.owner != from {
            return Err(NftError::Unauthorized);
        }

        metadata.owner = to.clone();
        metadata.is_listed = false;
        env.storage().persistent().set(&DataKey::Nft(id), &metadata);

        Self::remove_nft_from_owner(&env, &from, id);
        Self::add_nft_to_owner(&env, &to, id);

        env.events().publish((symbol_short!("transfer"), id, from, to), id);
        Ok(())
    }

    pub fn set_listed(env: Env, caller: Address, id: u64, listed: bool) -> Result<(), NftError> {
        let marketplace_addr: Option<Address> = env.storage().instance().get(&DataKey::Marketplace);
        let mut authorized = false;
        if let Some(m) = marketplace_addr {
            if caller == m {
                authorized = true;
            }
        }

        caller.require_auth();

        let mut metadata: NftMetadata = env
            .storage()
            .persistent()
            .get(&DataKey::Nft(id))
            .ok_or(NftError::NotFound)?;

        if caller != metadata.owner && !authorized {
            return Err(NftError::Unauthorized);
        }

        metadata.is_listed = listed;
        env.storage().persistent().set(&DataKey::Nft(id), &metadata);
        Ok(())
    }

    pub fn get_nft(env: Env, id: u64) -> Option<NftMetadata> {
        env.storage().persistent().get(&DataKey::Nft(id))
    }

    pub fn get_owner_nfts(env: Env, owner: Address) -> Vec<u64> {
        env.storage().persistent().get(&DataKey::OwnerNfts(owner)).unwrap_or_else(|| Vec::new(&env))
    }

    pub fn get_total_supply(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
    }

    // ── SEP-41 Token Interface (for Freighter Collectibles discovery) ─────────

    pub fn name(_env: Env) -> String {
        String::from_str(&_env, "AuraMarket NFT")
    }

    pub fn symbol(_env: Env) -> String {
        String::from_str(&_env, "AURA")
    }

    pub fn decimals(_env: Env) -> u32 {
        0
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        let nfts: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerNfts(id))
            .unwrap_or_else(|| Vec::new(&env));
        nfts.len() as i128
    }

    pub fn token_id_of_owner_by_index(env: Env, owner: Address, index: u32) -> u64 {
        let nfts: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerNfts(owner))
            .unwrap_or_else(|| Vec::new(&env));
        nfts.get(index).unwrap_or(0)
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0u64) as i128
    }

    pub fn token_uri(env: Env, token_id: u64) -> String {
        let metadata: NftMetadata = env
            .storage()
            .persistent()
            .get(&DataKey::Nft(token_id))
            .expect("NFT not found");
        metadata.image_url
    }

    pub fn get_metadata(env: Env, token_id: u64) -> Map<Symbol, Val> {
        let metadata: NftMetadata = env
            .storage()
            .persistent()
            .get(&DataKey::Nft(token_id))
            .expect("NFT not found");
        let mut map: Map<Symbol, Val> = Map::new(&env);
        map.set(Symbol::new(&env, "name"), metadata.name.into_val(&env));
        map.set(Symbol::new(&env, "description"), metadata.description.into_val(&env));
        map.set(Symbol::new(&env, "image"), metadata.image_url.into_val(&env));
        map.set(Symbol::new(&env, "id"), (metadata.id as i128).into_val(&env));
        map
    }

    // ── Internal Helpers ────────────────────────────────────────────────────────

    fn add_nft_to_owner(env: &Env, owner: &Address, id: u64) {
        let mut nfts: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerNfts(owner.clone()))
            .unwrap_or_else(|| Vec::new(env));
        nfts.push_back(id);
        env.storage().persistent().set(&DataKey::OwnerNfts(owner.clone()), &nfts);
    }

    fn remove_nft_from_owner(env: &Env, owner: &Address, id: u64) {
        let nfts: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerNfts(owner.clone()))
            .unwrap_or_else(|| Vec::new(env));
        
        let mut new_nfts = Vec::new(env);
        for i in 0..nfts.len() {
            let nft_id = nfts.get(i).unwrap();
            if nft_id != id {
                new_nfts.push_back(nft_id);
            }
        }
        env.storage().persistent().set(&DataKey::OwnerNfts(owner.clone()), &new_nfts);
    }
}
