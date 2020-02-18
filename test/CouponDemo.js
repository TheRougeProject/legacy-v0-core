
const { newTestCampaign, authHash, protocolSig } = require('./utils.js');

const RGEToken = artifacts.require("./TestRGEToken.sol");

const tare = 0.1 * 10**6;          /* tare price is 0.1 rge in beta phase */
const tokens  = 1000 * 10**6;      /* issuer RGE tokens before campaign start */

const attestor = '0x955d20aedce1227941b12fa27aa1c77af758e10c';

contract('SimpleRougeCampaign(CouponDemo)', function(accounts) {

  it("one acquisition/one redemption signature using attestor demo", async function() {

    const rge = await RGEToken.deployed();

    const issuer = accounts[2];
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

