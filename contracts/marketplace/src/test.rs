#[cfg(test)]
mod tests {
    use crate::{MarketplaceContract, MarketplaceContractClient};
    use auramarket_nft::{NftContract, NftContractClient};
    use soroban_sdk::testutils::{Address as _};
    use soroban_sdk::{Env, String, token, Address};

    fn setup_test(env: &Env) -> (Address, Address, Address, Address, NftContractClient, token::Client, token::StellarAssetClient, MarketplaceContractClient) {
        let admin = Address::generate(env);
        let alice = Address::generate(env);
        let bob = Address::generate(env);
        
        // Register NFT contract using the struct directly (Native)
        let nft_contract_id = env.register_contract(None, NftContract);
        let nft_client = NftContractClient::new(env, &nft_contract_id);
        nft_client.initialize(&admin);

        let xlm_address = env.register_stellar_asset_contract(Address::generate(env));
        let xlm_client = token::Client::new(env, &xlm_address);
        let xlm_admin = token::StellarAssetClient::new(env, &xlm_address);

        let marketplace_id = env.register_contract(None, MarketplaceContract);
        let marketplace_client = MarketplaceContractClient::new(env, &marketplace_id);
        
        // Set marketplace in NFT contract
        nft_client.set_marketplace(&admin, &marketplace_id);

        marketplace_client.initialize(&admin, &nft_contract_id, &xlm_address, &250u32);

        (admin, alice, bob, xlm_address, nft_client, xlm_client, xlm_admin, marketplace_client)
    }

    #[test]
    fn test_full_marketplace_flow() {
        let env = Env::default();
        env.mock_all_auths();

        let (admin, alice, bob, _xlm_address, nft_client, xlm_client, xlm_admin, marketplace_client) = setup_test(&env);

        // 1. Mint NFT for Alice
        let nft_id = nft_client.mint(
            &alice,
            &String::from_str(&env, "Aura #1"),
            &String::from_str(&env, "Test NFT"),
            &String::from_str(&env, "https://example.com/1.png"),
        );

        // 2. List NFT on Marketplace
        let price = 100_000_000i128; // 100 XLM
        marketplace_client.list_nft(&alice, &nft_id, &price);

        // Verify listing
        let listing = marketplace_client.get_listing(&nft_id);
        assert_eq!(listing.price_xlm, price);
        assert_eq!(listing.seller, alice);
        assert!(listing.active);

        // Verify NFT is marked as listed in NFT contract
        assert!(nft_client.get_nft(&nft_id).unwrap().is_listed);

        // 3. Buy NFT (Bob buys from Alice)
        xlm_admin.mint(&bob, &price);
        marketplace_client.buy_nft(&bob, &nft_id);

        // 4. Verify results
        assert_eq!(nft_client.get_nft(&nft_id).unwrap().owner, bob);
        assert!(!nft_client.get_nft(&nft_id).unwrap().is_listed);

        let fee = price * 250 / 10_000;
        let seller_received = price - fee;
        
        assert_eq!(xlm_client.balance(&alice), seller_received);
        assert_eq!(xlm_client.balance(&admin), fee);
        assert_eq!(xlm_client.balance(&bob), 0);
        assert!(!marketplace_client.get_listing(&nft_id).active);
    }

    #[test]
    fn test_delist() {
        let env = Env::default();
        env.mock_all_auths();

        let (_admin, alice, _bob, _xlm_address, nft_client, _xlm_client, _xlm_admin, marketplace_client) = setup_test(&env);

        let nft_id = nft_client.mint(
            &alice,
            &String::from_str(&env, "Aura #1"),
            &String::from_str(&env, "Test NFT"),
            &String::from_str(&env, "https://example.com/1.png"),
        );

        marketplace_client.list_nft(&alice, &nft_id, &1000i128);
        assert!(nft_client.get_nft(&nft_id).unwrap().is_listed);

        marketplace_client.delist_nft(&alice, &nft_id);
        
        assert!(!nft_client.get_nft(&nft_id).unwrap().is_listed);
        assert!(!marketplace_client.get_listing(&nft_id).active);
    }
}
