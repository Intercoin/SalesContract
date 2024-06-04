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
		"0x3eC1440B81c55cB7646491A7187710512A7f4b19",
        [[1704067200, 4000, "0x7c13bc4b2c133c56000000"],[1711929600, 60000, "0x7c13bc4b2c133c56000000"],[1719792000, 80000, "0x7c13bc4b2c133c56000000"]],
        1725148800,
        [[0,0],["0x2b5e3af16b1880000",25],["0x56bc75e2d63100000",50],["0x56bc75e2d63100000",75],["0x15af1d78b58c400000",100]],
        2,
        ["0x0000000000000000000000000000000000000000","0x00000000",0,true],
        ["0xd3c21bcecceda100000","0x295be96e6406697200000"]
	]
	let params = [
		..._params,
		options
	]

    const deployerBalanceBefore = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", (deployerBalanceBefore).toString());


    const SalesFactory = await ethers.getContractAt("SalesFactory", "0x08010100c8389ea2fd9c59473670d981ae146c47");   
	
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