
const HDWalletProvider = require('@truffle/hdwallet-provider')


module.exports = {

  compilers: {
    solc: {
      version: "0.8.2",
      settings: {
        optimizer: {
          enabled: true,
          runs: 2000
        },
        //  evmVersion: "byzantium"
      }
    }
  },

  networks: {
    local: {
      host: "localhost",
      port: 7545,
      network_id: "*" // Match any network id
    },
    // rinkeby: {
    //   provider: () => new PrivateKeyProvider(privateKey, "https://rinkeby.infura.io/"),
    //   network_id: 4
    // },
    sokol: {
      //host: "https://sokol-trace.poa.network", //https://sokol.poa.network",
      host: "https://sokol.poa.network",
      port: 443,
      provider: () => new HDWalletProvider({
        privateKeys: [ process.env.PKEY ],
        providerOrUrl: "https://sokol.poa.network",
      }),
      network_id: 77,
    }
  }
};
