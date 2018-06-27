
var RGEToken = artifacts.require("./TestRGEToken.sol");
var Factory = artifacts.require("./RougeFactory.sol");
var SimpleRougeCampaign = artifacts.require("./SimpleRougeCampaign.sol");

contract('RougeFactory', function(accounts) {

  it("create a simple Rouge campaign", async function() {

    var user = accounts[1];
    var tokens  = 1000 * 10**6;

    var issuance = 10;
    var deposit  = 50 * 10**6;

    let rge = await RGEToken.deployed();
    let factory = await Factory.deployed();

    let user_balance_before = await rge.balanceOf.call(user);
    assert.equal(user_balance_before.toNumber(), 0, "user has no rge tokens to start with");

    await await rge.giveMeRGE(tokens, {from: user});

    let user_balance_post = await rge.balanceOf.call(user);
    assert.equal(user_balance_post.toNumber(), tokens, "user has receive tokens to create a campaign");

    await rge.newCampaign(issuance, deposit, {from: user, gas: 2000000, gasPrice: web3.toWei(1, "gwei")})

    let user_balance_after = await rge.balanceOf.call(user);
    assert.equal(user_balance_after.toNumber(), tokens - deposit, "user has sent tokens ase deposit to the factory");

    let campaign_count = await factory.get_all_count.call();
    assert.equal(campaign_count.toNumber(), 1, "one campaign has been created");

    let campaign_address = await factory.get_campaign.call(user, 0);

    let factory_balance = await rge.balanceOf.call(factory.address);
    assert.equal(factory_balance.toNumber(), 0, "no tokens deposit in the factory");

    let campaign_balance = await rge.balanceOf.call(campaign_address);
    assert.equal(campaign_balance.toNumber(), deposit, "the tokens deposit is now in the new campaign contract");
    
  });  
  
  it("burning tokens test", async function() {

    var user = accounts[2];
    var tokens  = 1000 * 10**6;

    var issuance = 10;
    var deposit  = 50 * 10**6;

    let rge = await RGEToken.deployed();
    let factory = await Factory.deployed();

    await await rge.giveMeRGE(tokens, {from: user});
    await rge.newCampaign(issuance, deposit, {from: user, gas: 2000000, gasPrice: web3.toWei(1, "gwei")})
    let campaign_address = await factory.get_campaign.call(user, 0);

    let campaign_balance = await rge.balanceOf.call(campaign_address);
    assert.equal(campaign_balance.toNumber(), deposit, "the tokens deposit is now in the new campaign contract");

    let campaign = SimpleRougeCampaign.at(campaign_address);

    // very long expiration // 19 January, 2038 03:14:07 UT ( 2147483647 )
    await campaign.issue('Test Simple 2', 2147483647, {from: user});

    let available = await campaign.available.call();    
    assert.equal(available.toNumber(), issuance, "check notes available after issuance");

    await campaign.letsBurn(100, {from: user});

    let campaign_balance_after = await rge.balanceOf.call(campaign_address);
    assert.equal(campaign_balance_after.toNumber(), deposit - 100, "the contract has burned 100 tokens");

  });  
  

});

