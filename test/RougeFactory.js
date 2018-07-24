
const RGEToken = artifacts.require("./TestRGEToken.sol");
const Factory = artifacts.require("./RougeFactory.sol");
const SimpleRougeCampaign = artifacts.require("./SimpleRougeCampaign.sol");

const tare = 0.1 * 10**6;  /* tare price is 0.1 rge in beta phase */

contract('RougeFactory', function(accounts) {

  it("factory has correct parameters", async function() {

    const rge = await RGEToken.deployed();
    const factory = await Factory.deployed();

    const ftare = await factory.tare.call();
    assert.equal(ftare.toNumber(), tare, "tare price is set correctly in factory");
    
  });  

  it("create a simple Rouge campaign", async function() {

    const issuer = accounts[1];
    const tokens  = 1000 * 10**6; /* 1K RGE tokens */

    const issuance = 10;
    const deposit  = 50 * 10**6;

    const rge = await RGEToken.deployed();
    const factory = await Factory.deployed();

    const issuer_balance_before = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_before.toNumber(), 0, "issuer has no rge tokens to start with");

    await rge.giveMeRGE(tokens, {from: issuer});

    const issuer_balance_post = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_post.toNumber(), tokens, "issuer has receive tokens to create a campaign");

    await rge.newCampaign(issuance, deposit, {from: issuer, gas: 2000000, gasPrice: web3.toWei(1, "gwei")})

    const issuer_balance_after = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_after.toNumber(), tokens - deposit, "issuer has sent tokens as a deposit to the factory");

    const campaign_count = await factory.get_all_count.call();
    assert.equal(campaign_count.toNumber(), 1, "one campaign has been created");

    const campaign_address = await factory.get_campaign.call(issuer, 0);

    const factory_balance = await rge.balanceOf.call(factory.address);
    assert.equal(factory_balance.toNumber(), 0, "no tokens deposit in the factory");

    const campaign_balance = await rge.balanceOf.call(campaign_address);
    assert.equal(campaign_balance.toNumber(), deposit, "the tokens deposit is now in the new campaign contract");
    
  });  
  
});

