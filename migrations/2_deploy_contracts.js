
const RGETokenInterface = artifacts.require("./RGETokenInterface.sol")
const TestRGEToken = artifacts.require("./TestRGEToken.sol")
const RougeFactory = artifacts.require("./RougeFactory.sol")

const RougeBridge = artifacts.require("./RougeBridge.sol")
// const BridgeRGEToken = artifacts.require("./BridgeRGEToken.sol")

module.exports = async function(deployer, network) {

  if (['test'].includes(network)) {

    await Promise.all([
      deployer.deploy(TestRGEToken),
      deployer.deploy(RougeFactory),
      deployer.deploy(RougeBridge, '0x345ca3e014aaf5dca488057592ee47305d9b3e10')
      // deployer.deploy(BridgeRGEToken, 3, '0x0', '0x0', '0x0', 'Foreign RGE', 'f_RGE')
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

    return
  }

  const rgeAddress = {
    sokol: '0x5475300766433dd082a7340fc48a445c483df68f'
  }

  if (network && rgeAddress[network]) {

    const rge = await RGETokenInterface.at(rgeAddress[network])

    await deployer.deploy(RougeFactory)
    const factory = await RougeFactory.deployed()

    const results = await Promise.all([
      rge.setFactory(factory.address),
      factory.setParams(rge.address, 100000)
    ]);

    console.log('results', results)

  }

};
