
var TestRGEToken = artifacts.require("./TestRGEToken.sol");
var RougeFactory = artifacts.require("./RougeFactory.sol");

module.exports = async function(deployer) {
 
  await Promise.all([
    deployer.deploy(TestRGEToken),
    deployer.deploy(RougeFactory)
  ]);

  instances = await Promise.all([
    TestRGEToken.deployed(),
    RougeFactory.deployed()
  ])

  rge = instances[0];
  factory = instances[1];

  results = await Promise.all([
    rge.setFactory(factory.address),
    factory.setParams(rge.address)
  ]);

};
