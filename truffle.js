
const PrivateKeyProvider = require("truffle-privatekey-provider");

module.exports = {
  solc: {
    optimizer: {
      enabled: true,
      runs: 2000
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
      provider: () => new PrivateKeyProvider(process.env.PKEY, "https://sokol.poa.network"),
      network_id: 77,
    }
  }
};
