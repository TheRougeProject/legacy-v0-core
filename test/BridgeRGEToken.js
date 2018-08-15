
const abi = require('ethereumjs-abi')
const BN = require('bn.js')
const ethUtil = require('ethereumjs-util')

const RGEToken = artifacts.require("./TestRGEToken.sol");
const RougeBridge = artifacts.require("./RougeBridge.sol");
const BridgeRGEToken = artifacts.require("./BridgeRGEToken.sol");

const createLockHash = function(msg, user, deposit, foreign_network, bridge, depositBlock) {
  return '0x' + abi.soliditySHA3(
    [ "string", "address", "uint", "uint", "address", "uint" ],
    [ msg, new BN(user, 16), deposit, foreign_network, new BN(bridge, 16), depositBlock ]
  ).toString('hex')
}

const createSealHash = function(msg, hash, v, r, s, lockBlock) {
  return '0x' + abi.soliditySHA3(
    [ "string", "bytes32", "uint8", "bytes32", "bytes32", "uint" ],
    [ msg, hash, v, r, s, lockBlock ]
  ).toString('hex')
}

const createAuthHash = function(msg, hash) {
  return '0x' + abi.soliditySHA3(
    [ "string", "bytes32" ], [ msg, hash ]
  ).toString('hex')
}
const createUnlockHash = function(msg, user, foreign_network, bridge, depositBlock) {
  return '0x' + abi.soliditySHA3(
    [ "string", "address", "uint", "address", "uint" ],
    [ msg, new BN(user, 16), foreign_network, new BN(bridge, 16), depositBlock ]
  ).toString('hex')
}

const getAccountSignature = function(hash, account) {
  const signature = web3.eth.sign(account, ethUtil.bufferToHex(ethUtil.toBuffer('Bridge fct: ' + hash.substr(2)))).substr(2)
  return {
    r: '0x' + signature.slice(0, 64),
    s: '0x' + signature.slice(64, 128),
    v: web3.toDecimal( '0x' + signature.slice(128, 130) ) + 27
  }  
}

contract('BridgeRGEToken', function(accounts) {
  
  it("Claim tokens locked in home bridge", async function() {


    // user need to use the SAME address on both chain.
    const user = accounts[1];
    
    const tokens  = 1000 * 10**6; /* 1K RGE tokens */
    const deposit  =  50 * 10**6; /* 1K RGE tokens */

    const foreign_network = 3;
    const foreign_authority = accounts[3];

    const rge = await RGEToken.deployed();
    const bridge = await RougeBridge.deployed();

    /* ########## THIS HAPPENS ON THE HOME CHAIN ########## */

    await rge.giveMeRGE(tokens, {from: user});
    await rge.approve(bridge.address, deposit, {from: user});

    await bridge.adminBridge(foreign_network, true, foreign_authority)

    const tx = await bridge.deposit(deposit, foreign_network, {from: user, gas: 67431 +20000, gasPrice: web3.toWei(1, "gwei")})
    const depositBlock = tx.receipt.blockNumber;

    const lockHash = createLockHash('locking', user, deposit, foreign_network, bridge.address, depositBlock)
    const signLock = getAccountSignature(lockHash, foreign_authority)    
    const lock_tx = await bridge.lockEscrow(lockHash, user, foreign_network, depositBlock, signLock.v, signLock.r, signLock.s);
    const lockBlock = lock_tx.receipt.blockNumber;
    const expected_seal = createSealHash('sealing', lockHash, signLock.v, signLock.r, signLock.s, lockBlock);
    const seal = await bridge.escrowSeal.call(user, foreign_network, depositBlock);
    assert.equal(seal, expected_seal, "we got a correct seal");

    // owner is create the Auth Hash (to be used on foreign chain)

    const authHash = createAuthHash('authorization', seal);
    const signAuth = getAccountSignature(authHash, accounts[0]);    
    const auth_tx = await bridge.createAuth(authHash, user, foreign_network, depositBlock, signAuth.v, signAuth.r, signAuth.s);

    const event_BridgeAuth_sign = web3.sha3('BridgeAuth(address,uint256,uint256,uint8,bytes32,bytes32,bytes32)')
    auth_tx.receipt.logs.forEach( function(e) {
      if (e.topics[0] === event_BridgeAuth_sign) {
        assert.equal(e.topics[1].slice(26, 66), user.substr(2), "user coherent in log");
        assert.equal(web3.toDecimal( e.topics[2] ), foreign_network , "coherent foreign_network");
        assert.equal(web3.toDecimal( e.topics[3] ), depositBlock, "coherent block number");
        assert.equal(web3.toDecimal(e.data.slice(0, 66)), signAuth.v, "sign v ok");
        assert.equal('0x' + e.data.slice(66, 130), signAuth.r, "sign r ok");
        assert.equal('0x' + e.data.slice(130, 194), signAuth.s, "sign s ok");
        assert.equal('0x' + e.data.slice(194, 260), authHash, "AuthHash ok");
      }
    })

    const user_balance = await rge.balanceOf.call(user);
    assert.equal(user_balance.toNumber(), tokens - deposit, "tokens back with user");

    /* ########## THIS HAPPENS ON THE FOREIGN CHAIN ########## */

    /* nb: for the sake of test, it's the same chain */

    const f_rge = await BridgeRGEToken.new(foreign_network, bridge.address, accounts[0], 'Foreign RGE', 'f_RGE', {from: foreign_authority});

    const user_balance_before = await f_rge.balanceOf.call(user);
    assert.equal(user_balance_before.toNumber(), 0, "user has no f_rge tokens to start with");

    // all these arguments can be read from main chain ledger : LOG EscrowLocked (+ its block number) & LOG BridgeAuth

    const claim_tx = await f_rge.claim(seal, authHash, deposit, depositBlock, lockBlock, signLock.v, signLock.r, signLock.s, signAuth.v, signAuth.r, signAuth.s, {from: user})

    const user_balance_after = await f_rge.balanceOf.call(user);
    assert.equal(user_balance_after.toNumber(), deposit, "user get his rge on foreign chain");

    const surrender_tx = await f_rge.surrender(deposit, depositBlock, signLock.v, signLock.r, signLock.s, {from: user})
    
    const user_balance_post = await f_rge.balanceOf.call(user);
    assert.equal(user_balance_post.toNumber(), 0, "user lost his f_rge tokens after surrender");


    const hash2 = createUnlockHash('unlocking', user, foreign_network, bridge.address, depositBlock)
    const sign2 = getAccountSignature(hash2, foreign_authority)
    const repudiate_tx = await f_rge.repudiate(hash2, user, depositBlock, sign2.v, sign2.r, sign2.s, {from: foreign_authority});

    /* ########## BACK ON HOME CHAIN ########## */

    /* arguments from unlockEscrow can be read from foreign chain LOG Repudiate */
    
    const unlock_tx = await bridge.unlockEscrow(hash2, user, foreign_network, depositBlock, sign2.v, sign2.r, sign2.s);

    const seal_after = await bridge.escrowSeal.call(user, foreign_network, depositBlock);
    assert.equal(seal_after, false, "the tokens are not locked anymore in the bridge contract");
      
    const withdraw = await bridge.withdraw(foreign_network, depositBlock, {from: user})

    const bridge_balance_after_withdraw = await rge.balanceOf.call(bridge.address);
    assert.equal(bridge_balance_after_withdraw.toNumber(), 0, "empty bridge");

    const user_balance_after_withdraw = await rge.balanceOf.call(user);
    assert.equal(user_balance_after_withdraw.toNumber(), tokens, "tokens back with user");
    
  });  
  
});

