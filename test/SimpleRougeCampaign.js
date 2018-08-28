
const abi = require('ethereumjs-abi')
const BN = require('bn.js')
const ethUtil = require('ethereumjs-util')

const RGEToken = artifacts.require("./TestRGEToken.sol");
const Factory = artifacts.require("./RougeFactory.sol");
const SimpleRougeCampaign = artifacts.require("./SimpleRougeCampaign.sol");

const tare = 0.1 * 10**6;          /* tare price is 0.1 rge in beta phase */
const tokens  = 1000 * 10**6;      /* issuer RGE tokens before campaign start */
const gas = 6000778
            
const new_campaign = async function(rge, issuer, issuance, deposit) {

  const factory = await Factory.deployed();

  const issuer_balance_before = await rge.balanceOf.call(issuer);

  /* refill issuer tokens to test starting value */
  await rge.giveMeRGE(tokens - issuer_balance_before, {from: issuer});

  await rge.newCampaign(issuance, deposit, {from: issuer, gas: gas, gasPrice: web3.toWei(1, "gwei")})
  const campaign_address = await factory.get_last_campaign.call(issuer);

  return SimpleRougeCampaign.at(campaign_address);

}

const create_auth_hash = function(msg, campaign, account) {

  return '0x' + abi.soliditySHA3(
    [ "string", "address", "address" ], [ msg, new BN(campaign, 16), new BN(account, 16) ]
  ).toString('hex')
  
}

const get_signature = function(account, msg) {

  const signature = web3.eth.sign(account, ethUtil.bufferToHex(ethUtil.toBuffer(msg))).substr(2)
  return {
    r: '0x' + signature.slice(0, 64),
    s: '0x' + signature.slice(64, 128),
    v: web3.toDecimal( '0x' + signature.slice(128, 130) ) + 27
  }
  
}

contract('SimpleRougeCampaign', function(accounts) {

  it("no acquisition/noredemtion campaign", async function() {

    const rge = await RGEToken.deployed();

    const issuer = accounts[3];
    const issuance = 10;
    const deposit  = 50 * 10**6;

    const campaign = await new_campaign(rge, issuer, issuance, deposit);
    
    // expiration of the campaign in 2 days
    const expiration = Math.trunc((new Date()).getTime() / 1000) + 60*60*24*2
    await campaign.issue('0x0200ee00', 'no acquisition/noredemtion campaign', expiration, {from: issuer});

    const available = await campaign.available.call();    
    assert.equal(available.toNumber(), issuance, "check notes available after issuance");

    await campaign.kill({from: issuer});

    const burned  = tare * issuance;

    const campaign_balance_after = await rge.balanceOf.call(campaign.address);
    assert.equal(campaign_balance_after.toNumber(), 0, "the campaign has no more rge after kill");

    const issuer_balance_after = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_after.toNumber(), tokens - burned, "the issuer has his tokens back less tare for 10 notes");

  });  
  
  it("one distribution/one redemption by issuer", async function() {

    const rge = await RGEToken.deployed();

    const issuer = accounts[3];
    const bearer = accounts[4];
    const issuance = 10;
    const deposit  = 50 * 10**6;

    const campaign = await new_campaign(rge, issuer, issuance, deposit);

    const expiration = Math.trunc((new Date()).getTime() / 1000) + 60*60*24*2
    await campaign.issue('0x0200ee00', 'issuer test', expiration, {from: issuer});

    await campaign.distributeNote(bearer, {from: issuer});

    const acquired = await campaign.acquired.call();    
    assert.equal(acquired.toNumber(), 1, "check notes acquired after distributeNote");

    // call acceptRedemption with auth message and bearer signature
    const auth = create_auth_hash('acceptRedemption', campaign.address, bearer)
    const sign = get_signature(bearer, 'Rouge ID: ' + auth.substr(2))
    await campaign.acceptRedemption(bearer, auth, sign.v, sign.r, sign.s, {from: issuer});

    const redeemed = await campaign.redeemed.call();    
    assert.equal(redeemed.toNumber(), 1, "note(s) redeemed after confirmRedemption");

    await campaign.kill({from: issuer});

    const burned  = tare * (issuance - redeemed);

    const campaign_balance_after = await rge.balanceOf.call(campaign.address);
    assert.equal(campaign_balance_after.toNumber(), 0, "the campaign has no more rge after kill");

    const issuer_balance_after = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_after.toNumber(), tokens - burned, "the issuer has his tokens back less tare for unredeemed notes");

  });  

  it("one acquisition/one redemption by bearer", async function() {

    const rge = await RGEToken.deployed();

    const issuer = accounts[3];
    const bearer = accounts[4];
    const issuance = 10;
    const deposit  = 50 * 10**6;

    const campaign = await new_campaign(rge, issuer, issuance, deposit);

    const expiration = Math.trunc((new Date()).getTime() / 1000) + 60*60*24*2
    await campaign.issue('0x0200ee00', 'acceptRedemption Test', expiration, {from: issuer});

    // call acquire with auth message and issuer signature
    const auth1 = create_auth_hash('acceptAcquisition', campaign.address, bearer)
    const sign1 = get_signature(issuer, 'Rouge ID: ' + auth1.substr(2))
    await campaign.acquire(auth1, sign1.v, sign1.r, sign1.s, issuer, {from: bearer});
    
    const acquired = await campaign.acquired.call();    
    assert.equal(acquired.toNumber(), 1, "check notes acquired after distributeNote");
    
    // call acceptRedemption with auth message and issuer signature
    const auth2 = create_auth_hash('acceptRedemption', campaign.address, bearer)
    const sign2 = get_signature(issuer, 'Rouge ID: ' + auth2.substr(2))
    await campaign.redeem(auth2, sign2.v, sign2.r, sign2.s, issuer, {from: bearer});

    const redeemed = await campaign.redeemed.call();    
    assert.equal(redeemed.toNumber(), 1, "note(s) redeemed after confirmRedemption");

    const campaign_state = await campaign.getState.call();
    assert.equal(campaign_state, '0x0000000a01000000090000000100000001', "return null state");

    await campaign.kill({from: issuer});

    const burned  = tare * (issuance - redeemed);

    const campaign_balance_after = await rge.balanceOf.call(campaign.address);
    assert.equal(campaign_balance_after.toNumber(), 0, "the campaign has no more rge after kill");

    const issuer_balance_after = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_after.toNumber(), tokens - burned, "the issuer has his tokens back less tare for unredeemed notes");
    
  });  
  
  it("one acquisition/one redemption by bearer using attestor", async function() {

    const rge = await RGEToken.deployed();

    const issuer = accounts[2];
    const attestor = accounts[3];
    const bearer = accounts[4];
    const issuance = 10;
    const deposit  = 50 * 10**6;

    const campaign = await new_campaign(rge, issuer, issuance, deposit);

    const expiration = Math.trunc((new Date()).getTime() / 1000) + 60*60*24*2
    await campaign.issueWithAttestor('0x0200ee00', 'acceptRedemption Test', expiration, attestor, [4, 5], {from: issuer});

    // call acquire with auth message and attestor signature
    const auth1 = create_auth_hash('acceptAcquisition', campaign.address, bearer)
    const sign1 = get_signature(attestor, 'Rouge ID: ' + auth1.substr(2))
    await campaign.acquire(auth1, sign1.v, sign1.r, sign1.s, attestor, {from: bearer});
    
    const acquired = await campaign.acquired.call();    
    assert.equal(acquired.toNumber(), 1, "check notes acquired after distributeNote");
    
    // call acceptRedemption with auth message and attestor signature
    const auth2 = create_auth_hash('acceptRedemption', campaign.address, bearer)
    const sign2 = get_signature(attestor, 'Rouge ID: ' + auth2.substr(2))
    await campaign.redeem(auth2, sign2.v, sign2.r, sign2.s, attestor, {from: bearer});

    const redeemed = await campaign.redeemed.call();    
    assert.equal(redeemed.toNumber(), 1, "note(s) redeemed after confirmRedemption");

    const campaign_state = await campaign.getState.call();
    assert.equal(campaign_state, '0x0000000a01000000090000000100000001', "return null state");

    await campaign.kill({from: issuer});

    const burned  = tare * (issuance - redeemed);

    const campaign_balance_after = await rge.balanceOf.call(campaign.address);
    assert.equal(campaign_balance_after.toNumber(), 0, "the campaign has no more rge after kill");

    const issuer_balance_after = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_after.toNumber(), tokens - burned, "the issuer has his tokens back less tare for unredeemed notes");
    
  });  

});

