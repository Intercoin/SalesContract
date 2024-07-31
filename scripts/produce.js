const fs = require('fs');
//const HDWalletProvider = require('truffle-hdwallet-provider');
const { 
    getArguments
} = require("./helpers/arguments-for-stable-prices.js");

async function main() {
	
	
	var depl_local,
        depl_auxiliary,
        depl_releasemanager,
		depl_sales;

    var signers = await ethers.getSigners();
    if (signers.length == 1) {
        depl_local = signers[0];
        depl_auxiliary = signers[0];
        depl_releasemanager = signers[0];
		depl_sales = signers[0];
    } else {
        [
            depl_local,
            depl_auxiliary,
            depl_releasemanager,
			depl_sales
        ] = signers;
    }

	
	const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
	console.log(
		"Deploying contracts with the account:",
		depl_auxiliary.address
	);

	const _arguments = getArguments();

console.log(_arguments);
    const deployerBalanceBefore = await ethers.provider.getBalance(depl_auxiliary.address);
    console.log("Account balance:", (deployerBalanceBefore).toString());

    //const SalesFactory = await ethers.getContractAt("SalesFactory", "0x080101006379fcb14e08a24388888bbb8fbfa8c9");   
	const SalesFactoryF = await ethers.getContractFactory("SalesFactory");   
	const SalesFactory = SalesFactoryF.attach("0x08010100d9d250947417b9de5b6622fa1dcb64b8");
	//---
	
	let tx = await SalesFactory.connect(depl_auxiliary).produceWithStablePrices(..._arguments);
	
	const rc = await tx.wait(); // 0ms, as tx is already confirmed

	const event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
	const [instance,] = event.args;
	console.log("instance = ", instance);

	const newOwner = '0x3ec1440b81c55cb7646491a7187710512a7f4b19';
	console.log("transferOwnership to ", newOwner);
	const SalesWithStablePricesF = await ethers.getContractFactory("SalesWithStablePrices");   
	const SalesWithStablePrices = SalesWithStablePricesF.attach(instance);
	await SalesWithStablePrices.connect(depl_auxiliary).transferOwnership(newOwner);
	console.log("Done");


	const deployerBalanceAfter = await ethers.provider.getBalance(depl_auxiliary.address);
	console.log("Spent:", ethers.formatUnits(deployerBalanceBefore - deployerBalanceAfter), 18);
	console.log("gasPrice:", ethers.formatUnits((await network.provider.send("eth_gasPrice")), "gwei")," gwei");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
	console.error(error);
	process.exit(1);
  });