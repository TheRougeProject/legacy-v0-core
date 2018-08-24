
const TestRGEToken = artifacts.require("./TestRGEToken.sol");
const RougeFactory = artifacts.require("./RougeFactory.sol");

const RougeBridge = artifacts.require("./RougeBridge.sol");
const BridgeRGEToken = artifacts.require("./BridgeRGEToken.sol");

module.exports = async function(deployer) {
 
  await Promise.all([
    deployer.deploy(TestRGEToken),
    deployer.deploy(RougeFactory),
    deployer.deploy(RougeBridge, '0x345ca3e014aaf5dca488057592ee47305d9b3e10'),
    deployer.deploy(BridgeRGEToken, 3, '0x0', '0x0', '0x0', 'Foreign RGE', 'f_RGE')
  ]);

  instances = await Promise.all([
    TestRGEToken.deployed(),
    RougeFactory.deployed()
  ])

  rge = instances[0];
  factory = instances[1];

  results = await Promise.all([
    rge.setFactory(factory.address),
    factory.setParams(rge.address, 100000)
  ]);
  
};
