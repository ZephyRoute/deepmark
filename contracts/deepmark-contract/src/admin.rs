//! Administration: who may replace the contract code, and how that power is
//! given up for good.
//!
//! The admin is set once at deployment and kept in instance storage. It can
//! upgrade the code, hand the role to another address, or renounce it. After a
//! renounce there is no admin and the code can never change again.

use crate::components::DataKey;
use crate::Error;
use soroban_sdk::{contractevent, Address, BytesN, Env};

/// Topic: ("upgraded", admin). The contract code was replaced.
#[contractevent]
pub struct Upgraded {
    #[topic]
    pub admin: Address,
    pub wasm_hash: BytesN<32>,
}

/// Topic: ("admin_changed", previous). The admin role moved to another address.
#[contractevent]
pub struct AdminChanged {
    #[topic]
    pub previous: Address,
    pub next: Address,
}

/// Topic: ("admin_renounced", previous). The contract is now frozen for good.
#[contractevent]
pub struct AdminRenounced {
    #[topic]
    pub previous: Address,
}

/// The current admin, or `None` once the role was renounced.
pub fn current(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

/// Record the first admin. Only the constructor calls this.
pub fn init(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

/// Authenticate the admin, or fail with `Frozen` if there is none.
pub fn require(env: &Env) -> Result<Address, Error> {
    let admin = current(env).ok_or(Error::Frozen)?;
    admin.require_auth();
    Ok(admin)
}

/// Move the role. Both the current and the new admin must sign, so the role
/// can never be handed to a mistyped address nobody controls.
pub fn transfer(env: &Env, next: &Address) -> Result<(), Error> {
    let previous = require(env)?;
    next.require_auth();
    init(env, next);
    AdminChanged {
        previous,
        next: next.clone(),
    }
    .publish(env);
    Ok(())
}

/// Give the role up. There is no way back.
pub fn renounce(env: &Env) -> Result<(), Error> {
    let previous = require(env)?;
    env.storage().instance().remove(&DataKey::Admin);
    AdminRenounced { previous }.publish(env);
    Ok(())
}

/// Replace the contract code with an uploaded wasm. Storage is kept as is.
pub fn upgrade(env: &Env, wasm_hash: &BytesN<32>) -> Result<(), Error> {
    let admin = require(env)?;
    env.deployer()
        .update_current_contract_wasm(wasm_hash.clone());
    Upgraded {
        admin,
        wasm_hash: wasm_hash.clone(),
    }
    .publish(env);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{AdminChanged, AdminRenounced, Upgraded};
    use crate::components::CONTRACT_VERSION;
    use crate::{DeepmarkContract, DeepmarkContractClient, Error};
    use soroban_sdk::{
        testutils::{Address as _, Events as _},
        Address, BytesN, Env, Event as _,
    };
    use std::panic::{catch_unwind, AssertUnwindSafe};

    struct Deployed<'a> {
        env: Env,
        client: DeepmarkContractClient<'a>,
        admin: Address,
    }

    /// Deploys with the constructor signature mocked, then drops every mocked
    /// authorization so each test states exactly who signs what.
    fn deployed<'a>() -> Deployed<'a> {
        let env = Env::default();
        let admin = Address::generate(&env);
        let relics = [
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ];
        env.mock_all_auths();
        let id = env.register(
            DeepmarkContract,
            (
                admin.clone(),
                relics[0].clone(),
                relics[1].clone(),
                relics[2].clone(),
            ),
        );
        env.set_auths(&[]);
        let client = DeepmarkContractClient::new(&env, &id);
        Deployed { env, client, admin }
    }

    fn unknown_wasm(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[7u8; 32])
    }

    /// The smallest module the host accepts as a contract: the wasm header and
    /// one custom section naming the environment interface it targets. It has
    /// no functions, which is enough to exercise the upgrade path.
    fn minimal_contract_wasm() -> std::vec::Vec<u8> {
        const WASM_HEADER: [u8; 8] = *b"\0asm\x01\0\0\0";
        const CUSTOM_SECTION_ID: u8 = 0;
        const ENV_META_NAME: &[u8] = b"contractenvmetav0";
        const INTERFACE_VERSION_ENTRY: u32 = 0;
        const PROTOCOL: u32 = 25;
        const PRE_RELEASE: u32 = 0;

        let mut payload = std::vec![ENV_META_NAME.len() as u8];
        payload.extend_from_slice(ENV_META_NAME);
        for word in [INTERFACE_VERSION_ENTRY, PROTOCOL, PRE_RELEASE] {
            payload.extend_from_slice(&word.to_be_bytes());
        }
        let mut wasm = WASM_HEADER.to_vec();
        wasm.push(CUSTOM_SECTION_ID);
        wasm.push(payload.len() as u8);
        wasm.extend_from_slice(&payload);
        wasm
    }

    #[test]
    fn the_constructor_records_the_admin_and_the_release() {
        let d = deployed();
        assert_eq!(d.client.admin(), Some(d.admin.clone()));
        assert_eq!(d.client.version(), CONTRACT_VERSION);
    }

    #[test]
    fn deploying_needs_the_admin_signature() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let relic = Address::generate(&env);
        let result = catch_unwind(AssertUnwindSafe(|| {
            env.register(
                DeepmarkContract,
                (admin.clone(), relic.clone(), relic.clone(), relic.clone()),
            );
        }));
        assert!(result.is_err());
    }

    #[test]
    fn nobody_without_the_admin_signature_can_change_anything() {
        let d = deployed();
        let stranger = Address::generate(&d.env);

        assert!(d.client.try_upgrade(&unknown_wasm(&d.env)).is_err());
        assert!(d.client.try_set_admin(&stranger).is_err());
        assert!(d.client.try_renounce_admin().is_err());
        assert_eq!(d.client.admin(), Some(d.admin.clone()));
    }

    #[test]
    fn the_admin_can_upgrade_and_the_swap_is_announced() {
        let d = deployed();
        let hash = d
            .env
            .deployer()
            .upload_contract_wasm(minimal_contract_wasm().as_slice());
        d.env.mock_all_auths();

        d.client.upgrade(&hash);

        let auths = d.env.auths();
        assert_eq!(auths.len(), 1);
        assert_eq!(auths[0].0, d.admin);
        assert_eq!(
            d.env.events().all(),
            [Upgraded {
                admin: d.admin.clone(),
                wasm_hash: hash,
            }
            .to_xdr(&d.env, &d.client.address)]
        );
    }

    #[test]
    fn an_upgrade_to_code_that_was_never_uploaded_is_refused() {
        let d = deployed();
        d.env.mock_all_auths();
        assert!(d.client.try_upgrade(&unknown_wasm(&d.env)).is_err());
    }

    #[test]
    fn handing_over_the_role_needs_both_signatures() {
        let d = deployed();
        let next = Address::generate(&d.env);

        d.env.mock_all_auths();
        d.client.set_admin(&next);

        let signers: std::vec::Vec<Address> = d.env.auths().into_iter().map(|a| a.0).collect();
        assert!(signers.contains(&d.admin));
        assert!(signers.contains(&next));
        assert_eq!(
            d.env.events().all(),
            [AdminChanged {
                previous: d.admin.clone(),
                next: next.clone(),
            }
            .to_xdr(&d.env, &d.client.address)]
        );
        assert_eq!(d.client.admin(), Some(next.clone()));

        // The previous admin lost the role.
        d.env.set_auths(&[]);
        assert!(d.client.try_renounce_admin().is_err());
    }

    #[test]
    fn a_new_admin_that_did_not_sign_cannot_be_installed() {
        let d = deployed();
        let next = Address::generate(&d.env);
        d.env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &d.admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &d.client.address,
                fn_name: "set_admin",
                args: soroban_sdk::vec![&d.env, soroban_sdk::IntoVal::into_val(&next, &d.env)],
                sub_invokes: &[],
            },
        }]);

        assert!(d.client.try_set_admin(&next).is_err());
        assert_eq!(d.client.admin(), Some(d.admin.clone()));
    }

    #[test]
    fn renouncing_freezes_the_contract_for_good() {
        let d = deployed();
        d.env.mock_all_auths();
        d.client.renounce_admin();

        assert_eq!(
            d.env.events().all(),
            [AdminRenounced {
                previous: d.admin.clone(),
            }
            .to_xdr(&d.env, &d.client.address)]
        );
        assert_eq!(d.client.admin(), None);
        let stranger = Address::generate(&d.env);
        assert_eq!(
            d.client.try_upgrade(&unknown_wasm(&d.env)),
            Err(Ok(Error::Frozen))
        );
        assert_eq!(d.client.try_set_admin(&stranger), Err(Ok(Error::Frozen)));
        assert_eq!(d.client.try_renounce_admin(), Err(Ok(Error::Frozen)));
    }
}
