
const abi = require('ethereumjs-abi')
const BN = require('bn.js')
const ethUtil = require('ethereumjs-util')

const RGEToken = artifacts.require("./TestRGEToken.sol");
const RougeBridge = artifacts.require("./RougeBridge.sol");

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

const getSignature = function(hash, pkey) {
  const signature = ethUtil.ecsign(ethUtil.hashPersonalMessage(
                    ethUtil.toBuffer('Bridge fct: ' + hash.substr(2))), new Buffer(pkey, 'hex')
  )
  return { r: ethUtil.bufferToHex(signature.r), s: ethUtil.bufferToHex(signature.s), v: signature.v }
}

const getAccountSignature = function(hash, account) {
  const signature = web3.eth.sign(account, ethUtil.bufferToHex(ethUtil.toBuffer('Bridge fct: ' + hash.substr(2)))).substr(2)
  return {
    r: '0x' + signature.slice(0, 64),
    s: '0x' + signature.slice(64, 128),
    v: web3.toDecimal( '0x' + signature.slice(128, 130) ) + 27
  }
}

contract('RougeBridge', function(accounts) {

  it("bridge has correct parameters", async function() {

    const rge = await RGEToken.deployed();
    const bridge = await RougeBridge.deployed(rge.address);

    const address_rge = await bridge.rge.call();
    assert.equal(address_rge, rge.address, "rge address price is set correctly in bridge");
    
  });  

  it("Bridge deposit then withdraw without locked", async function() {

    const user = accounts[1];
    const tokens  = 1000 * 10**6; /* 1K RGE tokens */
    const deposit  =  50 * 10**6; /* 1K RGE tokens */
    const foreign_network = 3;
    
    const rge = await RGEToken.deployed();
    const bridge = await RougeBridge.deployed();

    const user_balance_before = await rge.balanceOf.call(user);
    assert.equal(user_balance_before.toNumber(), 0, "user has no rge tokens to start with");

    await rge.giveMeRGE(tokens, {from: user});

    const user_balance_post = await rge.balanceOf.call(user);
    assert.equal(user_balance_post.toNumber(), tokens, "user has receive tokens");

    await rge.approve(bridge.address, deposit, {from: user});

    const is_closed = await bridge.isOpen.call(foreign_network);
    assert.equal(is_closed, false, "Bridge closed by default");

    await bridge.adminBridge(foreign_network, true, '0x0')

    const is_opened = await bridge.isOpen.call(foreign_network);
    assert.equal(is_opened, true, "Bridge is now opened");

    const estimate = await bridge.deposit.estimateGas(deposit, foreign_network, {gas: 200000, from: user})
    // console.log('Base estimate newCampaign => ', estimate)

    const result = await bridge.deposit(deposit, foreign_network, {from: user, gas: 67431 + 20000, gasPrice: web3.toWei(1, "gwei")})
    const depositBlock = result.receipt.blockNumber;

    const event_BridgeDeposit_sign = web3.sha3('BridgeDeposit(address,uint256,uint256,uint256)')
    var countlog = 0;
    result.receipt.logs.forEach( function(e) {
      if (e.topics[0] === event_BridgeDeposit_sign) {
        countlog++
        assert.equal(e.topics[1].slice(26, 66), user.substr(2), "user coherent in log");
        assert.equal(web3.toDecimal( e.topics[2] ), foreign_network , "coherent foreign_network");
        assert.equal(web3.toDecimal( e.topics[3] ), depositBlock, "coherent block number");
      }
    })
    assert.equal(countlog, 1, "1 log tested");
    assert.equal(result.receipt.cumulativeGasUsed, estimate, "cumulativeGasUsed correctly predicted");

    const user_balance_after_deposit = await rge.balanceOf.call(user);
    assert.equal(user_balance_after_deposit.toNumber(), tokens - deposit, "tokens are in escrow, not user");

    const bridge_balance_after_deposit = await rge.balanceOf.call(bridge.address);
    assert.equal(bridge_balance_after_deposit.toNumber(), deposit, "tokens are in bridge address");
    
    const withdraw = await bridge.withdraw(foreign_network, depositBlock, {from: user})

    const user_balance_after_withdraw = await rge.balanceOf.call(user);
    assert.equal(user_balance_after_withdraw.toNumber(), tokens, "tokens back with user");

    const bridge_balance_after_withdraw = await rge.balanceOf.call(bridge.address);
    assert.equal(bridge_balance_after_withdraw.toNumber(), 0, "empty bridge");

  });

  /* ********** ********** ********** ********** ********** ********** */

  it("Bridge deposit locked by seal", async function() {

    const user = accounts[2];
    const tokens  = 1000 * 10**6; /* 1K RGE tokens */
    const deposit  =  50 * 10**6; /* 1K RGE tokens */
    const foreign_network = 3;
    const foreign_authority = '0x955d20aedce1227941b12fa27aa1c77af758e10c';
    const foreign_authority_pkey = 'c81c5128f1051be82c1896906cb1e283e07ec99e8ff53c5d02ea78cf5e7cc790';

    const rge = await RGEToken.deployed();
    const bridge = await RougeBridge.deployed();

    await rge.giveMeRGE(tokens, {from: user});
    await rge.approve(bridge.address, deposit, {from: user});

    await bridge.adminBridge(foreign_network, true, foreign_authority)

    const result = await bridge.deposit(deposit, foreign_network, {from: user, gas: 67431 +20000, gasPrice: web3.toWei(1, "gwei")})
    const depositBlock = result.receipt.blockNumber;

    // foreign chain + owner locking fct

    const hash1 = createLockHash('locking', user, deposit, foreign_network, bridge.address, depositBlock)
    const sign1 = getSignature(hash1, foreign_authority_pkey)    
    const lock_tx = await bridge.lockEscrow(hash1, user, foreign_network, depositBlock, sign1.v, sign1.r, sign1.s);
    const lockBlock = lock_tx.receipt.blockNumber;

    const expected_seal = createSealHash('sealing', hash1, sign1.v, sign1.r, sign1.s, lockBlock);
    const seal = await bridge.escrowSeal.call(user, foreign_network, depositBlock);
    assert.equal(seal, expected_seal, "check seal in that locked tokens");

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

    // this should fail as expected
    // await bridge.withdraw(foreign_network, depositBlock, {from: user})
    
    const hash2 = createUnlockHash('unlocking', user, foreign_network, bridge.address, depositBlock)
    const sign2 = getSignature(hash2, foreign_authority_pkey)
    const unlock_tx = await bridge.unlockEscrow(hash2, user, foreign_network, depositBlock, sign2.v, sign2.r, sign2.s);

    const seal_after = await bridge.escrowSeal.call(user, foreign_network, depositBlock);
    assert.equal(seal_after, false, "the tokens are not locked anymore in the bridge contract");
      
    const user_balance_before_withdraw = await rge.balanceOf.call(user);
    assert.equal(user_balance_before_withdraw.toNumber(), tokens - deposit, "tokens still locked");

    const withdraw = await bridge.withdraw(foreign_network, depositBlock, {from: user})

    const bridge_balance_after_withdraw = await rge.balanceOf.call(bridge.address);
    assert.equal(bridge_balance_after_withdraw.toNumber(), 0, "empty bridge");

    const user_balance_after_withdraw = await rge.balanceOf.call(user);
    assert.equal(user_balance_after_withdraw.toNumber(), tokens, "tokens back with user");
    
  });  
  
});

