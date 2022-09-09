const fs = require('fs');
//const HDWalletProvider = require('truffle-hdwallet-provider');

function get_data(_message) {
    return new Promise(function(resolve, reject) {
        fs.readFile('./scripts/arguments.json', (err, data) => {
            if (err) {
                if (err.code == 'ENOENT' && err.syscall == 'open' && err.errno == -4058) {
					let obj = {};
					data = JSON.stringify(obj, null, "");
                    fs.writeFile('./scripts/arguments.json', data, (err) => {
                        if (err) throw err;
                        resolve(data);
                    });
                } else {
                    throw err;
                }
            } else {
            	resolve(data);
			}
        });
    });
}

async function main() {
	var data = await get_data();
    var data_object_root = JSON.parse(data);
	if (typeof data_object_root[hre.network.name] === 'undefined') {
		throw("Arguments file: missed data");
    } else if (typeof data_object_root[hre.network.name] === 'undefined') {
		throw("Arguments file: missed network data");
    }
	data_object = data_object_root[hre.network.name];

	if (
		typeof data_object.implementationFundContract === 'undefined' ||
		typeof data_object.implementationFundContractAggregator === 'undefined' ||
		typeof data_object.implementationFundContractToken === 'undefined' ||
		typeof data_object.releaseManager === 'undefined' ||
		!data_object.implementationFundContract ||
		!data_object.implementationFundContractAggregator ||
		!data_object.implementationFundContractToken ||
		!data_object.releaseManager
	) {
		throw("Arguments file: wrong addresses");
	}

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
		// implementation was created inside
		data_object.implementationFundContract,
		data_object.implementationFundContractAggregator,
		data_object.implementationFundContractToken,
		ZERO_ADDRESS //costmanager
	]
	let params = [
		..._params,
		options
	]

	console.log("Account balance:", (await deployer.getBalance()).toString());

	const FundFactoryF = await ethers.getContractFactory("FundFactory");

	this.factory = await FundFactoryF.connect(deployer).deploy(...params);

	await this.factory.connect(deployer).registerReleaseManager(data_object.releaseManager);

	console.log("Factory deployed at:", this.factory.address);
	console.log("with params:", [..._params]);

	console.log("registered with release manager:", data_object.releaseManager);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
	console.error(error);
	process.exit(1);
  });