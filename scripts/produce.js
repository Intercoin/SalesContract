const fs = require('fs');
//const HDWalletProvider = require('truffle-hdwallet-provider');

async function main() {
	
	const [deployer] = await ethers.getSigners();
	
	const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
	console.log(
		"Deploying contracts with the account:",
		deployer.address
	);

	var options = {
		//gasPrice: ethers.utils.parseUnits('50', 'gwei'), 
		//gasLimit: 5e6
	};

	let _params = [
		// * @param _commonSettings CommonSettings data struct
		// *  address sellingToken address of ITR token
		// *  address token0 USD Coin
		// *  address token1 Wrapped token (WETH,WBNB,...)
		// *  address liquidityLib liquidityLib address(see intercoin/liquidity pkg)
		// *  uint64 endTime after this time exchange stop
		[
			"0x3eC1440B81c55cB7646491A7187710512A7f4b19",
			"0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
			"0x55d398326f99059ff775485246999027b3197955",
			"0x1ea4c4613a4dfdaeeb95a261d11520c90d5d6252",
			1725148800
		],
		// * @param _priceSettings PriceSettings struct's array
		// *  uint64 timestamp timestamp
		// *  uint256 price price exchange
		// *  uint256 amountRaised raised amount
		[[1704067200, 4000, "0x7c13bc4b2c133c56000000"],[1711929600, 60000, "0x7c13bc4b2c133c56000000"],[1719792000, 80000, "0x7c13bc4b2c133c56000000"]],
		// * @param _bonusSettings ThresholdBonuses struct's array
		// *  uint256 threshold thresholds
		// *  uint256 bonus bonuses
		[[0,0],["0x2b5e3af16b1880000",25],["0x56bc75e2d63100000",50],["0x56bc75e2d63100000",75],["0x15af1d78b58c400000",100]],
		// * @param _ownerCanWithdraw enum option where:
		// *  0 -owner can not withdraw tokens
		// *  1 -owner can withdraw tokens only after endTimePassed
		// *  2 -owner can withdraw tokens anytime
	 	2,
		// * @param _whitelistData whitelist data struct
		// *  address contractAddress;
		// *	bytes4 method;
		// *	uint8 role;
		["0x0000000000000000000000000000000000000000","0x00000000",0,true],
		// * @param _lockedInPrice lockedInPrice struct
		// *  uint256 _minimumLockedInAmount Minimum amount required to buy and hold the price.
		// *  uint256 _maximumLockedInAmount Maximum amount available to buy at the held price.
		["0xd3c21bcecceda100000","0x295be96e6406697200000"],
		// * @param _compensationSettings compensationSettings data struct		
		// *  uint64 endTime after this time receiving compensation tokens will be disabled
		[
			1825148800
		]
	];
	let params = [
		..._params,
		options
	]

    const deployerBalanceBefore = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", (deployerBalanceBefore).toString());

    const SalesFactory = await ethers.getContractAt("SalesFactory", "0x0801010000205568f8F4C54C84c2e71Ac8E987f8");   
	
	let tx = await SalesFactory.connect(deployer).produce(...params);
	
	const deployerBalanceAfter = await ethers.provider.getBalance(deployer.address);
	console.log("Spent:", ethers.formatUnits(deployerBalanceBefore - deployerBalanceAfter), 18);
	console.log("gasPrice:", ethers.formatUnits((await network.provider.send("eth_gasPrice")), "gwei")," gwei");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
	console.error(error);
	process.exit(1);
  });