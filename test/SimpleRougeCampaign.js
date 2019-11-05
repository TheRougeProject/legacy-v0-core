
const { newTestCampaign, authHash, protocolSig } = require('./utils.js');

const RGEToken = artifacts.require("./TestRGEToken.sol");
const Factory = artifacts.require("./RougeFactory.sol");
const SimpleRougeCampaign = artifacts.require("./SimpleRougeCampaign.sol");

const tare = 0.1 * 10**6;          /* tare price is 0.1 rge in beta phase */
const tokens  = 1000 * 10**6;      /* issuer RGE tokens before campaign start */
const gas = 6000778

contract('SimpleRougeCampaign', function(accounts) {

  it("no acquisition/noredemtion campaign", async function() {

    const rge = await RGEToken.deployed();

    const issuer = accounts[3];
    const issuance = 10;
    const deposit  = 50 * 10**6;

    const campaign = await newTestCampaign(rge, issuer, issuance, deposit, tokens);
    
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

    const campaign = await newTestCampaign(rge, issuer, issuance, deposit, tokens);

    const expiration = Math.trunc((new Date()).getTime() / 1000) + 60*60*24*2
    await campaign.issue('0x0200ee00', 'issuer test', expiration, {from: issuer});

    await campaign.distributeNote(bearer, {from: issuer});

    const acquired = await campaign.acquired.call();    
    assert.equal(acquired.toNumber(), 1, "check notes acquired after distributeNote");

    // call acceptRedemption with auth message and bearer signature
    const auth = authHash('acceptRedemption', campaign.address, bearer)
    const sign = protocolSig(bearer, auth)
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

    const campaign = await newTestCampaign(rge, issuer, issuance, deposit, tokens);

    const expiration = Math.trunc((new Date()).getTime() / 1000) + 60*60*24*2
    await campaign.issue('0x0200ee00', 'acceptRedemption Test', expiration, {from: issuer});

    // call acquire with auth message and issuer signature
    const auth1 = authHash('acceptAcquisition', campaign.address, bearer)
    const sign1 = protocolSig(issuer, auth1)
    await campaign.acquire(auth1, sign1.v, sign1.r, sign1.s, issuer, {from: bearer});
    
    const acquired = await campaign.acquired.call();    
    assert.equal(acquired.toNumber(), 1, "check notes acquired after distributeNote");
    
    // call acceptRedemption with auth message and issuer signature
    const auth2 = authHash('acceptRedemption', campaign.address, bearer)
    const sign2 = protocolSig(issuer, auth2)
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

    const campaign = await newTestCampaign(rge, issuer, issuance, deposit, tokens);

    const expiration = Math.trunc((new Date()).getTime() / 1000) + 60*60*24*2
    await campaign.issueWithAttestor('0x0200ee00', 'acceptRedemption Test', expiration, attestor, [4, 5], {from: issuer});

    // call acquire with auth message and attestor signature
    const auth1 = authHash('acceptAcquisition', campaign.address, bearer)
    const sign1 = protocolSig(attestor, auth1)
    await campaign.acquire(auth1, sign1.v, sign1.r, sign1.s, attestor, {from: bearer});
    
    const acquired = await campaign.acquired.call();    
    assert.equal(acquired.toNumber(), 1, "check notes acquired after distributeNote");
    
    // call acceptRedemption with auth message and attestor signature
    const auth2 = authHash('acceptRedemption', campaign.address, bearer)
    const sign2 = protocolSig(attestor, auth2)
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

