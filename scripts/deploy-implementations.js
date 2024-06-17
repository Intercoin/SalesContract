const fs = require('fs');
//const HDWalletProvider = require('truffle-hdwallet-provider');

function get_data(_message) {
    return new Promise(function(resolve, reject) {
        fs.readFile('./scripts/arguments.json', (err, data) => {
            if (err) {
				
                if (err.code == 'ENOENT' && err.syscall == 'open' && err.errno == -4058) {
                    fs.writeFile('./scripts/arguments.json', "", (err2) => {
                        if (err2) throw err2;
                        resolve();
                    });
                    data = ""
                } else {
                    throw err;
                }
            }
    
            resolve(data);
        });
    });
}

function write_data(_message) {
    return new Promise(function(resolve, reject) {
        fs.writeFile('./scripts/arguments.json', _message, (err) => {
            if (err) throw err;
            console.log('Data written to file');
            resolve();
        });
    });
}

async function main() {
	var data = await get_data();

    var data_object_root = JSON.parse(data);
	var data_object = {};
	if (typeof data_object_root[hre.network.name] === 'undefined') {
        data_object.time_created = Date.now()
    } else {
        data_object = data_object_root[hre.network.name];
    }
	//----------------

	//const [deployer, depl_auxiliary, deployer_FactoryDeployer] = await ethers.getSigners();

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
    const RELEASE_MANAGER = hre.network.name == 'mumbai'? process.env.RELEASE_MANAGER_MUMBAI : process.env.RELEASE_MANAGER;
	console.log(
		"Deploying contracts with the account:",
		depl_auxiliary.address
	);

	// var options = {
	// 	//gasPrice: ethers.utils.parseUnits('50', 'gwei'), 
	// 	gasLimit: 10e6
	// };

	
    const deployerBalanceBefore = await ethers.provider.getBalance(depl_auxiliary.address);
    console.log("Account balance:", (deployerBalanceBefore).toString());

	const FundContractF = await ethers.getContractFactory("Sales");
	const FundContractAggregatorF = await ethers.getContractFactory("SalesAggregator");
    const FundContractTokenF = await ethers.getContractFactory("SalesToken");
	    
	let implementationFundContract          = await FundContractF.connect(depl_auxiliary).deploy();
    let implementationFundContractAggregator= await FundContractAggregatorF.connect(depl_auxiliary).deploy();
    let implementationFundContractToken     = await FundContractTokenF.connect(depl_auxiliary).deploy();
	await implementationFundContract.waitForDeployment();
    await implementationFundContractAggregator.waitForDeployment();
    await implementationFundContractToken.waitForDeployment();
	
    const liquidityLib = "0x1ea4c4613a4dfdaeeb95a261d11520c90d5d6252";
	console.log("Implementations:");
	console.log("  FundContract deployed at:            ", implementationFundContract.target);
    console.log("  FundContractAggregator deployed at:  ", implementationFundContractAggregator.target);
	console.log("  FundContractToken deployed at:       ", implementationFundContractToken.target);
    console.log("  liquidityLib uses at:                ", liquidityLib);//1.0.0
    console.log("Linked with manager:");
    console.log("  Release manager:", RELEASE_MANAGER);

	data_object.implementationFundContract 	        = implementationFundContract.target;
	data_object.implementationFundContractAggregator= implementationFundContractAggregator.target;
    data_object.implementationFundContractToken     = implementationFundContractToken.target;
    data_object.liquidityLib                        = liquidityLib;
    data_object.releaseManager	                    = RELEASE_MANAGER;

	const deployerBalanceAfter = await ethers.provider.getBalance(depl_auxiliary.address);
	console.log("Spent:", ethers.formatUnits(deployerBalanceBefore - deployerBalanceAfter), 18);
	console.log("gasPrice:", ethers.formatUnits((await network.provider.send("eth_gasPrice")), "gwei")," gwei");

	//---
	const ts_updated = Date.now();
    data_object.time_updated = ts_updated;
    data_object_root[`${hre.network.name}`] = data_object;
    data_object_root.time_updated = ts_updated;
    let data_to_write = JSON.stringify(data_object_root, null, 2);
	console.log(data_to_write);
    await write_data(data_to_write);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
	console.error(error);
	process.exit(1);
  });