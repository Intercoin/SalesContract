
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
require('hardhat-contract-sizer');
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

        // hardhat built-in list
        // used just for making tests!!!!!!!!!!!!!!
        {
          privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
          balance: '10000000000000000000000'
        },
        {
          privateKey: '0x59c6995e998f97a5a0044966f094538e6d0b13c9fba5b6d6f74a09a5e4d8b6f8',
          balance: '10000000000000000000000'
        },
        {
          privateKey: '0x5de4111afa1a4b94908f83103e07c7c8b1fcb64f2d1c4b0c89e5d9f39af51ed4',
          balance: '10000000000000000000000'
        },
        {
          privateKey: '0x7c8521182946d0e161f0c7b1f6d7f7e0e92ce40938e425c205b5b61896f8a3e7',
          balance: '10000000000000000000000'
        },
        {
          privateKey: '0x47e179ec1974887d0d5e5f0d5f5f5c6c6c83e1b4d29c3168c81551979c7c57cc',
          balance: '10000000000000000000000'
        },
        {
          privateKey: '0x8b3a350cf5c34c9194ca3a545d8b8b8d6ebf0f8b6b2b0f3d6d83d31f4d3e0b91',
          balance: '10000000000000000000000'
        },
        {
          privateKey: '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0b9a3e6c8e6c9f4f8d7b7a9d1',
          balance: '10000000000000000000000'
        },
        {
          privateKey: '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce036f7a7a6b0f3c9b5c7a2',
          balance: '10000000000000000000000'
        },
        {
          privateKey: '0x6c875dfb4f3b8dcd9a316bed112fb0a0e0eaa90bf34e66b4a79e2d0a73e7ac24',
          balance: '10000000000000000000000'
        },
        {
          privateKey: '0xf214f2b2cd5c8a4e8e1e8b4d29b1b7a4d5c7e3a9d4b5f6a7c8d9e0f1a2b3c4d5',
          balance: '10000000000000000000000'
        }

        //--------------------------
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

    // localhost: {
    //   allowUnlimitedContractSize: true,
    //   // accounts: [
    //   //   {balance: '10000000000000000000000', privateKey: process.env.private_key},
    //   //   {balance: '10000000000000000000000', privateKey: process.env.private_key_auxiliary},
    //   //   {balance: '10000000000000000000000', privateKey: process.env.private_key_tradedTokenITR},
    //   //   {balance: '10000000000000000000000', privateKey: process.env.private_key_tradedTokenQBIX},
    //   //   {balance: '10000000000000000000000', privateKey: process.env.private_key_claim},
    //   //   {balance: '10000000000000000000000', privateKey: process.env.private_key_tradedTokenKTA}
    //   // ],
    //   // //[bscURL]
    //   chainId: 56, // 0x38
    //   url: "http://127.0.0.1:8545/"

    // },
    
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
