
var RGEToken = artifacts.require("./TestRGEToken.sol");
var Factory = artifacts.require("./RougeFactory.sol");
var SimpleRougeCampaign = artifacts.require("./SimpleRougeCampaign.sol");

var tare = 0.1 * 10**6;  /* price price is 0.1 rge in beta phase */

contract('RougeFactory', function(accounts) {

  it("create a simple Rouge campaign", async function() {

    var issuer = accounts[1];
    var tokens  = 1000 * 10**6; /* 1K RGE tokens */

    var issuance = 10;
    var deposit  = 50 * 10**6;

    let rge = await RGEToken.deployed();
    let factory = await Factory.deployed();

    let issuer_balance_before = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_before.toNumber(), 0, "issuer has no rge tokens to start with");

    await rge.giveMeRGE(tokens, {from: issuer});

    let issuer_balance_post = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_post.toNumber(), tokens, "issuer has receive tokens to create a campaign");

    await rge.newCampaign(issuance, deposit, {from: issuer, gas: 2000000, gasPrice: web3.toWei(1, "gwei")})

    let issuer_balance_after = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_after.toNumber(), tokens - deposit, "issuer has sent tokens as a deposit to the factory");

    let campaign_count = await factory.get_all_count.call();
    assert.equal(campaign_count.toNumber(), 1, "one campaign has been created");

    let campaign_address = await factory.get_campaign.call(issuer, 0);

    let factory_balance = await rge.balanceOf.call(factory.address);
    assert.equal(factory_balance.toNumber(), 0, "no tokens deposit in the factory");

    let campaign_balance = await rge.balanceOf.call(campaign_address);
    assert.equal(campaign_balance.toNumber(), deposit, "the tokens deposit is now in the new campaign contract");
    
  });  
  
  it("simple tare burning test with no redemption", async function() {

    var issuer = accounts[2];
    var tokens  = 1000 * 10**6;

    var issuance = 10;
    var deposit  = 50 * 10**6;

    let rge = await RGEToken.deployed();
    let factory = await Factory.deployed();

    await rge.giveMeRGE(tokens, {from: issuer});
    await rge.newCampaign(issuance, deposit, {from: issuer, gas: 2000000, gasPrice: web3.toWei(1, "gwei")})
    let campaign_address = await factory.get_campaign.call(issuer, 0);

    let ftare = await factory.tare.call();
    assert.equal(ftare.toNumber(), tare, "tare price is set correctly in factory");

    let campaign_balance = await rge.balanceOf.call(campaign_address);
    assert.equal(campaign_balance.toNumber(), deposit, "the tokens deposit is now in the new campaign contract");

    let campaign = SimpleRougeCampaign.at(campaign_address);

    // very long expiration // 19 January, 2038 03:14:07 UT ( 2147483647 )
    await campaign.issue('Test Simple 2', 2147483647, {from: issuer});

    let available = await campaign.available.call();    
    assert.equal(available.toNumber(), issuance, "check notes available after issuance");

    await campaign.kill({from: issuer});

    let burned  = tare * issuance;

    let campaign_balance_after = await rge.balanceOf.call(campaign_address);
    assert.equal(campaign_balance_after.toNumber(), 0, "the campaign has no more rge after kill");

    let issuer_balance_after = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_after.toNumber(), tokens - burned, "the issuer has his tokens back less tare for 10 notes");

  });  
  
  it("acceptRedemption from issuer", async function() {

    var issuer = accounts[3];
    var bearer = accounts[4];

    var tokens  = 1000 * 10**6;
    var issuance = 10;
    var deposit  = 50 * 10**6;

    let rge = await RGEToken.deployed();
    let factory = await Factory.deployed();

    await rge.giveMeRGE(tokens, {from: issuer});
    await rge.newCampaign(issuance, deposit, {from: issuer, gas: 2000000, gasPrice: web3.toWei(1, "gwei")})
    let campaign_address = await factory.get_campaign.call(issuer, 0);

    let campaign_balance = await rge.balanceOf.call(campaign_address);
    assert.equal(campaign_balance.toNumber(), deposit, "the tokens deposit is now in the new campaign contract");

    let campaign = SimpleRougeCampaign.at(campaign_address);

    await campaign.issue('acceptRedemption Test', 2147483647, {from: issuer});
    await campaign.giveNote(bearer, {from: issuer});

    let acquired = await campaign.acquired.call();    
    assert.equal(acquired.toNumber(), 1, "check notes acquired after giveNote");

    // at minimum, msg needs to include the campaign address to protect against replay
    let msg = campaign_address + 'valid ticket';

    // bearer signature that to be used by issuer
    let signature = web3.eth.sign(bearer, web3.sha3(msg));
    signature = signature.substr(2);
    const r = '0x' + signature.slice(0, 64)
    const s = '0x' + signature.slice(64, 128)
    const v = '0x' + signature.slice(128, 130)
    const v_decimal = web3.toDecimal(v) + 27

    await campaign.acceptRedemption(bearer, web3.sha3(msg), v_decimal, r, s, {from: issuer});

    let redeemed = await campaign.redeemed.call();    
    assert.equal(redeemed.toNumber(), 1, "notes redeemed after confirmRedemption");

    await campaign.kill({from: issuer});

    let burned  = tare * (issuance - 1);

    let campaign_balance_after = await rge.balanceOf.call(campaign_address);
    assert.equal(campaign_balance_after.toNumber(), 0, "the campaign has no more rge after kill");

    let issuer_balance_after = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_after.toNumber(), tokens - burned, "the issuer has his tokens back less tare for unredeemed notes");

  });  
  

});

