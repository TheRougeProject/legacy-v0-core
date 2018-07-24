
const RGEToken = artifacts.require("./TestRGEToken.sol");
const Factory = artifacts.require("./RougeFactory.sol");
const SimpleRougeCampaign = artifacts.require("./SimpleRougeCampaign.sol");

const tare = 0.1 * 10**6;  /* tare price is 0.1 rge in beta phase */

const new_campaign = async function(rge, issuer, tokens, issuance, deposit) {

  const factory = await Factory.deployed();

  await rge.giveMeRGE(tokens, {from: issuer});
  await rge.newCampaign(issuance, deposit, {from: issuer, gas: 2000000, gasPrice: web3.toWei(1, "gwei")})
  const campaign_address = await factory.get_campaign.call(issuer, 0);

  return SimpleRougeCampaign.at(campaign_address);

}

const get_signature = function(account, message) {

  const signature = web3.eth.sign(account, web3.sha3(message)).substr(2)
  return {
    r: '0x' + signature.slice(0, 64),
    s: '0x' + signature.slice(64, 128),
    v: web3.toDecimal( '0x' + signature.slice(128, 130) ) + 27
  }
  
}

contract('SimpleRougeCampaign', function(accounts) {

  it("simple tare burning test with no redemption", async function() {

    const rge = await RGEToken.deployed();

    const issuer = accounts[2];
    const tokens  = 1000 * 10**6;
    const issuance = 10;
    const deposit  = 50 * 10**6;

    const campaign = await new_campaign(rge, issuer, tokens, issuance, deposit);
    
    // expiration of the campaign in 2 days
    const expiration = Math.trunc((new Date()).getTime() / 1000) + 60*60*24*2
    await campaign.issue('tare burning', expiration, {from: issuer});

    const available = await campaign.available.call();    
    assert.equal(available.toNumber(), issuance, "check notes available after issuance");

    await campaign.kill({from: issuer});

    const burned  = tare * issuance;

    const campaign_balance_after = await rge.balanceOf.call(campaign.address);
    assert.equal(campaign_balance_after.toNumber(), 0, "the campaign has no more rge after kill");

    const issuer_balance_after = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_after.toNumber(), tokens - burned, "the issuer has his tokens back less tare for 10 notes");

  });  
  
  it("acceptRedemption from issuer", async function() {

    const rge = await RGEToken.deployed();

    const issuer = accounts[3];
    const bearer = accounts[4];
    const tokens  = 1000 * 10**6;
    const issuance = 10;
    const deposit  = 50 * 10**6;

    const campaign = await new_campaign(rge, issuer, tokens, issuance, deposit);

    const expiration = Math.trunc((new Date()).getTime() / 1000) + 60*60*24*2
    await campaign.issue('acceptRedemption Test', expiration, {from: issuer});

    await campaign.giveNote(bearer, {from: issuer});

    const acquired = await campaign.acquired.call();    
    assert.equal(acquired.toNumber(), 1, "check notes acquired after giveNote");

    // bearer signature that to be used by issuer
    // at minimum, msg needs to include the campaign address to protect against replay
    const msg = 'this is a valid note of ' + campaign.address
    const sign = get_signature(bearer, msg)
    
    await campaign.acceptRedemption(bearer, web3.sha3(msg), sign.v, sign.r, sign.s, {from: issuer});

    const redeemed = await campaign.redeemed.call();    
    assert.equal(redeemed.toNumber(), 1, "notes redeemed after confirmRedemption");

    await campaign.kill({from: issuer});

    const burned  = tare * (issuance - 1);

    const campaign_balance_after = await rge.balanceOf.call(campaign.address);
    assert.equal(campaign_balance_after.toNumber(), 0, "the campaign has no more rge after kill");

    const issuer_balance_after = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_after.toNumber(), tokens - burned, "the issuer has his tokens back less tare for unredeemed notes");

  });  
  

});

