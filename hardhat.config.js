
require('dotenv').config();
/*
require("@nomiclabs/hardhat-ethers")

require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-web3")
require("@nomicfoundation/hardhat-verify");
require("solidity-coverage")
require("hardhat-gas-reporter")
//require("hardhat-docgen")
require("@hardhat-docgen/core")
//require("@hardhat-docgen/markdown")
//require("./docgen-custom-markdown")

*/
require("@nomicfoundation/hardhat-toolbox");

//----------------------------------------------------------------

const bscURL = `https://bsc-mainnet.infura.io/v3/${process.env.INFURA_ID_PROJECT}`//'https://bsc-dataseed.binance.org'
const mainnetURL = `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_MAINNET}`
const maticURL = `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_ID_PROJECT}`//`https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_MATIC}`
const mumbaiURL = "https://polygon-mumbai-bor.publicnode.com";//'https://matic-mumbai.chainstacklabs.com';

const baseURL = 'https://mainnet.base.org';
const optimismURL = 'https://optimism.llamarpc.com';

//--------------------------
module.exports = {
  solidity: "0.8.28",
  defaultNetwork: "hardhat",
  networks: {
    
    hardhat: {
      accounts: [
        {
          privateKey: process.env.private_key,
          balance: '10000000000000000000000'
        },
        {
          privateKey: process.env.private_key_auxiliary,
          balance: '10000000000000000000000'
        },
        {
          privateKey: process.env.private_key_releasemanager,
          balance: '10000000000000000000000'
        },
        {
          privateKey: process.env.private_key_sales,
          balance: '10000000000000000000000'
        },
      ],
      allowUnlimitedContractSize: false,
      //gasPrice: "auto",
      //gasLimit: 22000000,
      // //[bscURL]
      chainId: 56,
      forking: {url: bscURL,}
      //forking: {url: 'https://bsc.blockrazor.xyz',}
      //forking: {url: 'https://binance.llamarpc.com',}

      //[matic]
      // chainId: 137,
      // forking: {url: maticURL}
      
      
      
    },
    
    bsc: {
      url: bscURL,
      chainId: 56,
      gasPrice: "auto",
      accounts: [
        process.env.private_key,
        process.env.private_key_auxiliary,
        process.env.private_key_releasemanager,
        process.env.private_key_sales
      ],
      saveDeployments: true
    },
    polygon: {
      url: maticURL,
      chainId: 0x89,
      //gasPrice: "auto",
      accounts: [
        process.env.private_key,
        process.env.private_key_auxiliary,
        process.env.private_key_releasemanager,
        process.env.private_key_sales
      ],
      saveDeployments: true
    },
    mumbai: {
      url: mumbaiURL,
      chainId: 80001,
      gasPrice: "auto",
      gasLimit: 5000000,
      accounts: [
        process.env.private_key,
        process.env.private_key_auxiliary,
        process.env.private_key_releasemanager,
        process.env.private_key_sales
      ],
      saveDeployments: true
    },
    mainnet: {
      url: mainnetURL,
      chainId: 1,
      gasPrice: 3_000000000, // 3 gwei
      accounts: [
        process.env.private_key,
        process.env.private_key_auxiliary,
        process.env.private_key_releasemanager,
        process.env.private_key_sales
      ],
      saveDeployments: true
    },
    base: {
      url: baseURL,
      chainId: 8453,
      accounts: [
        process.env.private_key,
        process.env.private_key_auxiliary,
        process.env.private_key_releasemanager,
        process.env.private_key_sales
      ],
      saveDeployments: true
    },
    optimisticEthereum: {
      url: optimismURL,
      chainId: 10,
      accounts: [
        process.env.private_key,
        process.env.private_key_auxiliary,
        process.env.private_key_releasemanager,
        process.env.private_key_sales
      ],
      saveDeployments: true
    }
  },
  // docgen: {
  //   theme: '../../docgen-custom-markdown',
  //   path: './docs',
  //   clear: true,
  //   runOnCompile: false,
  // },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD"
  },
  etherscan: {
    apiKey: {
      polygon: process.env.MATIC_API_KEY,
      bsc: process.env.BSCSCAN_API_KEY,
      mainnet: process.env.ETHERSCAN_API_KEY,
      optimisticEthereum: process.env.OPTIMISM_API_KEY,
      base: process.env.BASE_API_KEY
    }
    //apiKey: process.env.MATIC_API_KEY
    //apiKey: process.env.BSCSCAN_API_KEY
    //apiKey: process.env.ETHERSCAN_API_KEY
  },
  solidity: {
    compilers: [
        {
          version: "0.8.11",
          settings: {
            optimizer: {
              enabled: true,
              runs: 100,
            },
            metadata: {
              // do not include the metadata hash, since this is machine dependent
              // and we want all generated code to be deterministic
              // https://docs.soliditylang.org/en/v0.7.6/metadata.html
              bytecodeHash: "none",
            },
          },
        },
        {
          version: "0.6.7",
          settings: {},
          settings: {
            optimizer: {
              enabled: false,
              runs: 80,
            },
            metadata: {
              // do not include the metadata hash, since this is machine dependent
              // and we want all generated code to be deterministic
              // https://docs.soliditylang.org/en/v0.7.6/metadata.html
              bytecodeHash: "none",
            },
          },
        },
      ],
  
    
  },
  
  namedAccounts: {
    deployer: 0,
    },

  paths: {
    sources: "contracts",
  },
  gasReporter: {
    currency: 'USD',
    enabled: (process.env.REPORT_GAS === "true") ? true : false
  },
  mocha: {
    timeout: 200000
  }
}
