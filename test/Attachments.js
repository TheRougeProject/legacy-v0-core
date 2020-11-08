
const { newTestCampaign, getBalanceInFinney, authHash, protocolSig } = require('./utils.js');

const truffleContract = require("@truffle/contract")
const EIP20 = require("@openzeppelin/contracts/build/contracts/ERC20PresetMinterPauser.json");
const EIP721 = require("@openzeppelin/contracts/build/contracts/ERC721PresetMinterPauserAutoId.json");

const RGEToken = artifacts.require("./TestRGEToken.sol");
const Factory = artifacts.require("./RougeFactory.sol");
const SimpleRougeCampaign = artifacts.require("./SimpleRougeCampaign.sol");

const tare = 0.1 * 10**6;          /* tare price is 0.1 rge in beta phase */
const tokens  = 1000 * 10**6;      /* issuer RGE tokens before campaign start */
const gas = 5000778
            
contract('SimpleRougeCampaign(Attachments)', function(accounts) {

  it("SimpleRougeCampaign with fuel attachment", async function() {

    const rge = await RGEToken.deployed();

    const issuer = accounts[3];
    const bearer = accounts[4];
    const issuance = 10;
    const deposit  = 50 * 10**6;

    const fuel_attachment = 1000; // 1 eth, i.e. 100 finney per voucher
    
    const campaign = await newTestCampaign(rge, issuer, issuance, deposit, tokens);

    const tx_attachFuel = await campaign.attachFuel({from: issuer, value: web3.utils.toWei(fuel_attachment.toString(), "finney")});
    const campaignBalance = await getBalanceInFinney(campaign.address)
    assert.equal(campaignBalance, fuel_attachment, "fuel attachement transfered");
    
    const expiration = Math.trunc((new Date()).getTime() / 1000) + 60*60*24*2
    await campaign.issue('0x0200ee00', 'test', expiration, {from: issuer});
    await campaign.distributeNote(bearer, {from: issuer});

    const bearerBalance_before = await getBalanceInFinney(bearer)

    const auth = authHash('acceptRedemption', campaign.address, bearer)
    const sign = protocolSig(bearer, auth)
    await campaign.acceptRedemption(bearer, auth, sign.v, sign.r, sign.s, {from: issuer});

    const bearerBalance_after = await getBalanceInFinney(bearer)
    assert.equal(
      bearerBalance_after,
      web3.utils.toBN(bearerBalance_before).add(web3.utils.toBN(fuel_attachment / issuance)),
      "attachment redeemed"
    );
    
    await campaign.kill({from: issuer});

    const campaign_balance_after = await rge.balanceOf.call(campaign.address);
    assert.equal(campaign_balance_after.toNumber(), 0, "the campaign has no more rge after kill");

    const campaign_fuel_balance_after = await getBalanceInFinney(campaign.address)
    assert.equal(campaign_fuel_balance_after, 0, "the campaign has no more fuel attached after kill");

  });

  it("SimpleRougeCampaign with ERC20 attachment", async function() {

    const rge = await RGEToken.deployed();

    const issuer = accounts[3];
    const bearer = accounts[4];
    const issuance = 10;
    const deposit  = 50 * 10**6;

    const erc20_attachment = 768; // i.e. 76 per voucher

    const campaign = await newTestCampaign(rge, issuer, issuance, deposit, tokens);

    const ERC20 = truffleContract(EIP20)
    ERC20.setProvider(web3.currentProvider);
    const erc20 = await ERC20.new('ERC20 TEST', 'XXX', {from: issuer});
    const tx_mint = await erc20.mint(issuer, erc20_attachment * 10, {from: issuer});

    await erc20.approve(campaign.address, erc20_attachment, {from: issuer});

    const tx_attach = await campaign.attachERC20(erc20.address, erc20_attachment, {from: issuer});

    const campaignBalance = await erc20.balanceOf.call(campaign.address);
    assert.equal(campaignBalance, erc20_attachment, "erc20 attachement transfered");
    
    const expiration = Math.trunc((new Date()).getTime() / 1000) + 60*60*24*2
    await campaign.issue('0x0200ee00', 'test', expiration, {from: issuer});
    await campaign.distributeNote(bearer, {from: issuer});

    const bearerBalance_before = await erc20.balanceOf.call(bearer);
    assert.equal(bearerBalance_before.toNumber(), 0, "no erc20 before redemption");

    const auth = authHash('acceptRedemption', campaign.address, bearer)
    const sign = protocolSig(bearer, auth)
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

    const campaign_fuel_balance_after = await getBalanceInFinney(campaign.address);

    assert.equal(campaign_fuel_balance_after, '0', "the campaign has no more fuel attached after kill");
  });

  it("SimpleRougeCampaign with ERC721 attachment", async function() {

    const rge = await RGEToken.deployed();

    const issuer = accounts[3];
    const bearer = accounts[4];
    const issuance = 4;
    const deposit  = 50 * 10**6;

    const erc721_attachment = issuance * 2; // 2 erc721 per voucher
    
    const campaign = await newTestCampaign(rge, issuer, issuance, deposit, tokens);

    const ERC721 = truffleContract(EIP721)
    ERC721.setProvider(web3.currentProvider);
    const erc721 = await ERC721.new('ERC721 TEST', 'XXX', '#', {from: issuer});

    const campaignBalance_before = await erc721.balanceOf.call(campaign.address);
    assert.equal(campaignBalance_before, 0, "no erc721 transfered yet");
    
    var i
    for (i = 0; i < erc721_attachment; i++) {
      const tx_mint = await erc721.mint(accounts[0], {from: issuer});
      const tx_transfer = await erc721.safeTransferFrom(accounts[0], campaign.address, i, {from: accounts[0]});
    } 

    const campaignBalance_after = await erc721.balanceOf.call(campaign.address);
    assert.equal(campaignBalance_after, erc721_attachment, "erc721 attachement transfered");
    
    const tx_attach = await campaign.attachERC721(erc721.address, erc721_attachment, {from: issuer});

    const expiration = Math.trunc((new Date()).getTime() / 1000) + 60*60*24*2
    await campaign.issue('0x0200ee00', 'test', expiration, {from: issuer});
    await campaign.distributeNote(bearer, {from: issuer});

    const bearerBalance_before = await erc721.balanceOf.call(bearer);
    assert.equal(bearerBalance_before.toNumber(), 0, "no erc721 before redemption");

    const auth = authHash('acceptRedemption', campaign.address, bearer)
    const sign = protocolSig(bearer, auth)
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

    const campaign_fuel_balance_after = await getBalanceInFinney(campaign.address);
    assert.equal(campaign_fuel_balance_after, '0', "the campaign has no more fuel attached after kill");
    
  });
  
});

