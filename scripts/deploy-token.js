const { BigNumber } = require('ethers');
const TWO = BigNumber.from('2');
const THREE = BigNumber.from('3');
const FOUR = BigNumber.from('4');
const FIVE = BigNumber.from('5');
const SEVEN = BigNumber.from('7');
const TEN = BigNumber.from('10');
const HUNDRED = BigNumber.from('100');
const THOUSAND = BigNumber.from('1000');
const MILLION = BigNumber.from('1000000');
const ONE_ETH = ethers.utils.parseEther('1');

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
        "ITR-test",
        "ITR-test",
        TWO.mul(HUNDRED).mul(MILLION).mul(ONE_ETH), // 200mil tokens
        40  // days
		
	]
	let params = [
		..._params,
		options
	]

    const deployerBalanceBefore = await deployer.getBalance();
    console.log("Account balance:", (deployerBalanceBefore).toString());

	const TokenF = await ethers.getContractFactory("Token");

	this.token = await TokenF.connect(deployer).deploy(...params);

	console.log("Token deployed at:", this.token.address);
	console.log("with params:", [..._params]);

	const deployerBalanceAfter = await deployer.getBalance();
	console.log("Spent:", ethers.utils.formatEther(deployerBalanceBefore.sub(deployerBalanceAfter)));
	console.log("gasPrice:", ethers.utils.formatUnits((await network.provider.send("eth_gasPrice")), "gwei")," gwei");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
	    console.error(error);
	    process.exit(1);
    });