
const hre = require('hardhat');

const getWrapperAddress = () => {
    const networkName = hre.network.name;
	const chainId = hre.network.config.chainId;
	
    // https://coinmarketcap.com/currencies/weth/
	// https://coinmarketcap.com/currencies/wmatic/
	// https://coinmarketcap.com/currencies/wbnb/
    if (/*(networkName == 'bsc') &&*/ (chainId == 56)) {
		return "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
    } else if (/*(networkName == 'polygon') &&*/ (chainId == 137)) {
		return "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
	} else if (/*(networkName == 'mainnet') &&*/ (chainId == 1)) {
		return "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
	} else if (/*(networkName == 'optimisticEthereum') &&*/ (chainId == 10)) {
		return "0x4200000000000000000000000000000000000006";
	} else if (/*(networkName == 'base') &&*/ (chainId == 8453)) {
		return "0x4200000000000000000000000000000000000006";
	} else if ((networkName == 'hardhat')) {
		return "0x4Fabb145d64652a948d72533023f6E7A623C7C53"; //!!!!####
	} else {
		throw "unknown network for grab usdc token | networkName=`"+networkName+"`; chainId=`"+chainId+"`";
	}
}

module.exports = { getWrapperAddress }
