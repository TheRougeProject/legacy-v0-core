
const abi = require('ethereumjs-abi')
const BN = require('bn.js')
const ethUtil = require('ethereumjs-util')

const EIP20 = artifacts.require("./EIP20.sol");
const EIP721 = artifacts.require("./contrib/openzeppelin/mocks/ERC721BasicTokenMock.sol");

const RGEToken = artifacts.require("./TestRGEToken.sol");
const Factory = artifacts.require("./RougeFactory.sol");
const SimpleRougeCampaign = artifacts.require("./SimpleRougeCampaign.sol");

const tare = 0.1 * 10**6;          /* tare price is 0.1 rge in beta phase */
const tokens  = 1000 * 10**6;      /* issuer RGE tokens before campaign start */
const gas = 5000778
            
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

contract('SimpleRougeCampaign(Attachments)', function(accounts) {

  it("SimpleRougeCampaign with fuel attachment", async function() {

    const rge = await RGEToken.deployed();

    const issuer = accounts[3];
    const bearer = accounts[4];
    const issuance = 10;
    const deposit  = 50 * 10**6;

    const fuel_attachment = 1000; // 1 eth, i.e. 100 finney per voucher
    
    const campaign = await new_campaign(rge, issuer, issuance, deposit);

    const tx_attachFuel = await campaign.attachFuel({from: issuer, value: web3.toWei(1000, "finney")});

    const campaignBalance = await web3.fromWei(web3.eth.getBalance(campaign.address), 'finney');
    assert.equal(campaignBalance, fuel_attachment, "fuel attachement transfered");
    
    const expiration = Math.trunc((new Date()).getTime() / 1000) + 60*60*24*2
    await campaign.issue('0x0200ee00', 'test', expiration, {from: issuer});
    await campaign.distributeNote(bearer, {from: issuer});

    const bearerBalance_before = await web3.toDecimal(web3.fromWei(web3.eth.getBalance(bearer), 'finney')); // 100000

    const auth = create_auth_hash('acceptRedemption', campaign.address, bearer)
    const sign = get_signature(bearer, 'Rouge ID: ' + auth.substr(2))
    await campaign.acceptRedemption(bearer, auth, sign.v, sign.r, sign.s, {from: issuer});

    const bearerBalance_after = await web3.toDecimal(web3.fromWei(web3.eth.getBalance(bearer), 'finney'));
    assert.equal(bearerBalance_after, bearerBalance_before + (fuel_attachment / issuance), "attachment redeemed");
    
    await campaign.kill({from: issuer});

    const campaign_balance_after = await rge.balanceOf.call(campaign.address);
    assert.equal(campaign_balance_after.toNumber(), 0, "the campaign has no more rge after kill");

    const campaign_fuel_balance_after = await web3.fromWei(web3.eth.getBalance(campaign.address), 'finney');
    assert.equal(campaign_fuel_balance_after.toNumber(), 0, "the campaign has no more fuel attached after kill");
    
  });  


  it("SimpleRougeCampaign with ERC20 attachment", async function() {

    const rge = await RGEToken.deployed();

    const issuer = accounts[3];
    const bearer = accounts[4];
    const issuance = 10;
    const deposit  = 50 * 10**6;

    const erc20_attachment = 768; // i.e. 76 per voucher
    
    const campaign = await new_campaign(rge, issuer, issuance, deposit);

    const erc20 = await EIP20.new(1000000,'ERC', 0,'ERC', {from: issuer});
    await erc20.approve(campaign.address, erc20_attachment, {from: issuer});

    const tx_attach = await campaign.attachERC20(erc20.address, erc20_attachment, {from: issuer});

    const campaignBalance = await erc20.balanceOf.call(campaign.address);
    assert.equal(campaignBalance, erc20_attachment, "erc20 attachement transfered");
    
    const expiration = Math.trunc((new Date()).getTime() / 1000) + 60*60*24*2
    await campaign.issue('0x0200ee00', 'test', expiration, {from: issuer});
    await campaign.distributeNote(bearer, {from: issuer});

    const bearerBalance_before = await erc20.balanceOf.call(bearer);
    assert.equal(bearerBalance_before.toNumber(), 0, "no erc20 before redemption");

    const auth = create_auth_hash('acceptRedemption', campaign.address, bearer)
    const sign = get_signature(bearer, 'Rouge ID: ' + auth.substr(2))
    await campaign.acceptRedemption(bearer, auth, sign.v, sign.r, sign.s, {from: issuer});

    const bearerBalance_after = await erc20.balanceOf.call(bearer);
    assert.equal(bearerBalance_after.toNumber(), bearerBalance_before.toNumber() + Math.trunc(erc20_attachment / issuance), "attachment redeemed");
    
    await campaign.kill({from: issuer});

    const campaign_erc20_balance_after = await erc20.balanceOf.call(campaign.address);
    assert.equal(campaign_erc20_balance_after.toNumber(), erc20_attachment - bearerBalance_after, "erc20 left after kill");
 
    await erc20.transferFrom(campaign.address, issuer, campaign_erc20_balance_after, {from: issuer});

    const campaign_erc20_balance_after2 = await erc20.balanceOf.call(campaign.address);
    assert.equal(campaign_erc20_balance_after2.toNumber(), 0, "issuer has taken all the remaining erc20 back");

    const campaign_balance_after = await rge.balanceOf.call(campaign.address);
    assert.equal(campaign_balance_after.toNumber(), 0, "the campaign has no more rge after kill");

    const campaign_fuel_balance_after = await web3.fromWei(web3.eth.getBalance(campaign.address), 'finney');
    assert.equal(campaign_fuel_balance_after.toNumber(), 0, "the campaign has no more fuel attached after kill");
    
  });  

  it("SimpleRougeCampaign with ERC721 attachment", async function() {

    const rge = await RGEToken.deployed();

    const issuer = accounts[3];
    const bearer = accounts[4];
    const issuance = 4;
    const deposit  = 50 * 10**6;

    const erc721_attachment = issuance * 2; // 2 erc721 per voucher
    
    const campaign = await new_campaign(rge, issuer, issuance, deposit);

    const erc721 = await EIP721.new({from: issuer});

    const campaignBalance_before = await erc721.balanceOf.call(campaign.address);
    assert.equal(campaignBalance_before, 0, "no erc721 transfered yet");
    
    var i
    for (i = 0; i < erc721_attachment; i++) {
      const tx_mint = await erc721.mint(accounts[0], i);
      const tx_transfer = await erc721.safeTransferFrom(accounts[0], campaign.address, i);
    } 

    const campaignBalance_after = await erc721.balanceOf.call(campaign.address);
    assert.equal(campaignBalance_after, erc721_attachment, "erc721 attachement transfered");
    
    const tx_attach = await campaign.attachERC721(erc721.address, erc721_attachment, {from: issuer});

    const expiration = Math.trunc((new Date()).getTime() / 1000) + 60*60*24*2
    await campaign.issue('0x0200ee00', 'test', expiration, {from: issuer});
    await campaign.distributeNote(bearer, {from: issuer});

    const bearerBalance_before = await erc721.balanceOf.call(bearer);
    assert.equal(bearerBalance_before.toNumber(), 0, "no erc721 before redemption");

    const auth = create_auth_hash('acceptRedemption', campaign.address, bearer)
    const sign = get_signature(bearer, 'Rouge ID: ' + auth.substr(2))
    await campaign.acceptRedemption(bearer, auth, sign.v, sign.r, sign.s, {from: issuer});

    const bearerBalance_after = await erc721.balanceOf.call(bearer);
    assert.equal(bearerBalance_after.toNumber(), bearerBalance_before.toNumber() + Math.trunc(erc721_attachment / issuance), "attachment redeemed");
    
    await campaign.kill({from: issuer});

    const campaign_erc721_balance_after = await erc721.balanceOf.call(campaign.address);
    assert.equal(campaign_erc721_balance_after.toNumber(), erc721_attachment - bearerBalance_after, "erc721 left after kill");
    
    await erc721.safeTransferFrom(campaign.address, issuer, 2, {from: issuer});

    const campaign_erc721_balance_after2 = await erc721.balanceOf.call(campaign.address);
    assert.equal(campaign_erc721_balance_after2.toNumber(), campaign_erc721_balance_after - 1, "issuer can get erc721 back");

    const campaign_balance_after = await rge.balanceOf.call(campaign.address);
    assert.equal(campaign_balance_after.toNumber(), 0, "the campaign has no more rge after kill");

    const campaign_fuel_balance_after = await web3.fromWei(web3.eth.getBalance(campaign.address), 'finney');
    assert.equal(campaign_fuel_balance_after.toNumber(), 0, "the campaign has no more fuel attached after kill");
    
  });  


  
});

