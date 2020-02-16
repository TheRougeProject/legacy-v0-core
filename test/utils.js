
const abi = require('ethereumjs-abi')
const BN = web3.utils.BN
const ethUtils = require('ethereumjs-util')

const zeroAddress = '0x0000000000000000000000000000000000000000'

// Mnemonic: candy maple cake sugar pudding cream honey rich smooth crumble sweet treat
// Private Keys truffe test
// Accounts:
// (0) 0x627306090abab3a6e1400e9345bc60c78a8bef57
// (1) 0xf17f52151ebef6c7334fad080c5704d77216b732
// (2) 0xc5fdf4076b8f3a5357c5e395ab970b5b54098fef
// (3) 0x821aea9a577a9b44299b9c15c88cf3087f3b5544
// (4) 0x0d1d4e623d10f9fba5db95830f7d3839406c6af2
// (5) 0x2932b7a2355d6fecc4b5c0b6bd44cc31df247a2e
// (6) 0x2191ef87e392377ec08e7c08eb105ef5448eced5
// (7) 0x0f4f2ac550a1b4e2280d04c21cea7ebd822934b5
// (8) 0x6330a553fc93768f612722bb8c2ec78ac90b3bbc
// (9) 0x5aeda56215b167893e80b4fe645ba6d5bab767de
// (0) c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3
// (1) ae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f
// (2) 0dbbe8e4ae425a6d2687f1a7e3ba17bc98c673636790f1b8ad91193c05875ef1
// (3) c88b703fb08cbea894b6aeff5a544fb92e78a18e19814cd85da83b71f772aa6c
// (4) 388c684f0ba1ef5017716adb5d21a053ea8e90277d0868337519f97bede61418
// (5) 659cbb0e2411a44db63778987b1e22153c086a95eb6b18bdf89de078917abc63
// (6) 82d052c865f5763aad42add438569276c00d3d88a2d062d36b2bae914d58b8c8
// (7) aa3680d5d48a8283413f7a108367c7299ca73f553735860a87b08f39395618b7
// (8) 0f62d96d6675f32685bbdb8ac13cda7c23436f63efbb9d07700d8669ff12b7c4
// (9) 8d5366123cb560bb606379f90a0bfd4769eecc0557f1b362dcae9012b548b1e5

const privateKey = {
  '0x627306090abab3a6e1400e9345bc60c78a8bef57': 'c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3',
  '0xf17f52151ebef6c7334fad080c5704d77216b732': 'ae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f',
  '0xc5fdf4076b8f3a5357c5e395ab970b5b54098fef': '0dbbe8e4ae425a6d2687f1a7e3ba17bc98c673636790f1b8ad91193c05875ef1',
  '0x821aea9a577a9b44299b9c15c88cf3087f3b5544': 'c88b703fb08cbea894b6aeff5a544fb92e78a18e19814cd85da83b71f772aa6c',
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2': '388c684f0ba1ef5017716adb5d21a053ea8e90277d0868337519f97bede61418',
  '0x2932b7a2355d6fecc4b5c0b6bd44cc31df247a2e': '659cbb0e2411a44db63778987b1e22153c086a95eb6b18bdf89de078917abc63',
  '0x2191ef87e392377ec08e7c08eb105ef5448eced5': '82d052c865f5763aad42add438569276c00d3d88a2d062d36b2bae914d58b8c8',
  '0x0f4f2ac550a1b4e2280d04c21cea7ebd822934b5': 'aa3680d5d48a8283413f7a108367c7299ca73f553735860a87b08f39395618b7',
  '0x6330a553fc93768f612722bb8c2ec78ac90b3bbc': '0f62d96d6675f32685bbdb8ac13cda7c23436f63efbb9d07700d8669ff12b7c4',
  '0x5aeda56215b167893e80b4fe645ba6d5bab767de': '8d5366123cb560bb606379f90a0bfd4769eecc0557f1b362dcae9012b548b1e5',
  // demo attestor
  '0x955d20aedce1227941b12fa27aa1c77af758e10c': 'c81c5128f1051be82c1896906cb1e283e07ec99e8ff53c5d02ea78cf5e7cc790',
}

const getBalanceInFinney = async address => web3.utils.fromWei(
  web3.utils.toBN(await web3.eth.getBalance(address)),
  'finney'
);

function authHash (msg, campaign, bearer) {
  // return '0x' + abi.soliditySHA3(
  return '0x' + ethUtils.keccak(abi.solidityPack(
    ['string', 'address', 'address'], [msg, new BN(campaign, 16), new BN(bearer, 16)]
  )).toString('hex')
}

function protocolSig (account, hash, prefix = 'Rouge ID: ') {
  const signature = ethUtils.ecsign(ethUtils.hashPersonalMessage(
    ethUtils.toBuffer(ethUtils.bufferToHex( Buffer.from(prefix + hash.substr(2))))
  ), ethUtils.toBuffer('0x' + privateKey[account.toLowerCase()]))
  return {
    r: ethUtils.bufferToHex(signature.r),
    s: ethUtils.bufferToHex(signature.s),
    v: signature.v
  }
}

const Factory = artifacts.require("./RougeFactory.sol");
const SimpleRougeCampaign = artifacts.require("./SimpleRougeCampaign.sol");
const gas = 5000778

const newTestCampaign = async function(rge, issuer, issuance, deposit, tokens) {

  const factory = await Factory.deployed();

  const issuer_balance_before = await rge.balanceOf.call(issuer);

  /* refill issuer tokens to test starting value */
  await rge.giveMeRGE(tokens - issuer_balance_before, {from: issuer});

  const tx = await rge.newCampaign(issuance, deposit, {from: issuer, gas: gas, gasPrice: web3.utils.toWei('1', "gwei")})

  const campaign_address = tx.receipt.logs[1].args.to;

  return SimpleRougeCampaign.at(campaign_address);
}

const createLockHash = function(user, deposit, foreign_network, bridge, depositBlock) {
  return '0x' + abi.soliditySHA3(
    [ "address", "uint", "uint", "address", "uint" ],
    [ new BN(user, 16), deposit, foreign_network, new BN(bridge, 16), depositBlock ]
  ).toString('hex')
}

const createSealHash = function(hash, v, r, s, lockBlock) {
  return '0x' + abi.soliditySHA3(
    [ "bytes32", "uint8", "bytes32", "bytes32", "uint" ],
    [ hash, v, r, s, lockBlock ]
  ).toString('hex')
}

const createUnlockHash = function(user, foreign_network, bridge, depositBlock) {
  return '0x' + abi.soliditySHA3(
    [ "address", "uint", "address", "uint" ],
    [ new BN(user, 16), foreign_network, new BN(bridge, 16), depositBlock ]
  ).toString('hex')
}

const bridgeSig = (account, hash) => protocolSig(account, hash, 'Bridge fct: ');

module.exports = {
  createLockHash, createSealHash, createUnlockHash, bridgeSig,
  zeroAddress, getBalanceInFinney, newTestCampaign, authHash, protocolSig
}
