const { expect } = require("chai");
const hre = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
require("@nomicfoundation/hardhat-chai-matchers");

const { 
    getStableCoinsList
} = require("./helpers/stablecoins.js");

const mixedCall = require('../js/mixedCall.js');

const ZERO = BigInt('0');
const ONE = BigInt('1');
const TWO = BigInt('2');
const THREE = BigInt('3');
const FOUR = BigInt('4');
const FIVE = BigInt('5');
const SEVEN = BigInt('7');
const TEN = BigInt('10');
const HUNDRED = BigInt('100');
const THOUSAND = BigInt('1000');
const MILLION = BigInt('1000000');


const ONE_ETH = ethers.parseEther('1');

//const TOTALSUPPLY = ethers.utils.parseEther('1000000000');    
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const NO_COSTMANAGER = ZERO_ADDRESS;


const FRACTION = 10000n;


const ethDenom = 100_000000n;//HUNDRED.mul(MILLION);

const amountETHSendToContract = ethers.parseEther('10'); //TEN.mul(ONE_ETH); // 10ETH
const amountTokenSendToContract = ethers.parseEther('10'); //TEN.mul(ONE_ETH); // 10token

const timePeriod = 5184000n;//60*24*60*60;

describe("Sales", function () {

    async function deploy() {
        const [
            owner, 
            accountOne, 
            accountTwo, 
            accountThree, 
            accountFourth, 
            accountFive, 
            accountSix, 
            accountSeven, 
            accountEight, 
            accountNine, 
            accountEleven, 
            trustedForwarder
        ] = await ethers.getSigners();
        // predefined init params
        let tmp;
        tmp = await ethers.provider.send("eth_blockNumber",[]);
        tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
        
        const blockTime = BigInt(parseInt(tmp.timestamp));

        const timestamps = [blockTime+(2n*timePeriod), blockTime+(4n*timePeriod), blockTime+(6n*timePeriod)];
        const prices = [100000n, 150000n, 180000n]; // (0.0010/0.0015/0.0018)  mul by 1e8. 0.001 means that for 1 eth got 1000 tokens    //_00000000
        //prices = [100000000, 150000000, 180000000]; // 1 eth got 1 token and so on
        const lastTime = blockTime+8n*timePeriod;

        const lastTimeForCompensation = blockTime+20n*timePeriod;

        const amountRaisedEx = [
            0n, 
            ethers.parseEther('1000000'),//MILLION.mul(ONE_ETH), 
            ethers.parseEther('2000000'),//TWO.mul(MILLION).mul(ONE_ETH), 

        ];

        const enumWithdrawOption = {
            never: 0,
            afterEndTime: 1,
            anytime: 2
        }

        const dontUseWhitelist = [
            ZERO_ADDRESS, // 
            "0x00000000", // bytes4
            0n, 
            false // use whitelist
        ];

        const thresholds = [// count in eth (10/25/50)
            ethers.parseEther('10'), //TEN.mul(ONE_ETH), 
            ethers.parseEther('25'), //FIVE.mul(FIVE).mul(ONE_ETH), 
            ethers.parseEther('50'), //FIVE.mul(TEN).mul(ONE_ETH)
        ];

        const dontUseLockedInAmount = [
            ethers.parseEther('0'),//uint256 minimumLockedInAmount;
            ethers.parseEther('0')//uint256 maximumLockedInAmount;
        ];
        
        const bonuses = [10n, 20n, 50n];  //[10, 20, 50]; // [0.1, 0.2, 0.5] mul by 100


        const priceSettings = [
            [timestamps[0], prices[0], amountRaisedEx[0]],
            [timestamps[1], prices[1], amountRaisedEx[1]],
            [timestamps[1], prices[2], amountRaisedEx[2]]
        ];

        const thresholdBonuses = [
            [thresholds[0], bonuses[0]],
            [thresholds[1], bonuses[1]],
            [thresholds[2], bonuses[2]],
        ]

        var SalesMockF = await ethers.getContractFactory("SalesMock");    
        var SalesTokenF = await ethers.getContractFactory("SalesTokenMock");
        var SalesAggregatorF = await ethers.getContractFactory("SalesWithStablePrices");

        const ERC20MintableF = await ethers.getContractFactory("ERC20Mintable");

        const ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');
        await ERC20MintableInstance.waitForDeployment();
        const Token2PayInstance = await ERC20MintableF.connect(owner).deploy('token2','token2');
        await Token2PayInstance.waitForDeployment();

        var SalesFactoryF = await ethers.getContractFactory("SalesFactory");

        var ReleaseManagerFactoryF= await ethers.getContractFactory("@intercoin/releasemanager/contracts/ReleaseManagerFactory.sol:ReleaseManagerFactory")
        var ReleaseManagerF = await ethers.getContractFactory("@intercoin/releasemanager/contracts/ReleaseManager.sol:ReleaseManager");
        let implementationReleaseManager    = await ReleaseManagerF.deploy();
        await implementationReleaseManager.waitForDeployment();

        let releaseManagerFactory   = await ReleaseManagerFactoryF.connect(owner).deploy(implementationReleaseManager.target);
        await releaseManagerFactory.waitForDeployment();

        let tx,rc,event,instance,instancesCount;
        //
        tx = await releaseManagerFactory.connect(owner).produce();
        rc = await tx.wait(); // 0ms, as tx is already confirmed
        event = rc.logs.find(obj => obj.fragment.name === 'InstanceProduced');
        [instance, instancesCount] = event.args;

        let releaseManager = await ethers.getContractAt("@intercoin/releasemanager/contracts/ReleaseManager.sol:ReleaseManager",instance);

        let salesInstance = await SalesMockF.deploy();
        await salesInstance.waitForDeployment();
        
        let salesTokenInstance = await SalesTokenF.deploy();
        await salesTokenInstance.waitForDeployment();

        let salesAggregatorInstance = await SalesAggregatorF.deploy();
        await salesAggregatorInstance.waitForDeployment();

        const SalesFactory = await SalesFactoryF.connect(owner).deploy(
            salesInstance.target,
            salesTokenInstance.target,
            salesAggregatorInstance.target,
            NO_COSTMANAGER,
            releaseManager.target
        );

        // 
        const factoriesList = [SalesFactory.target];
        const factoryInfo = [
            [
                1,//uint8 factoryIndex; 
                1,//uint16 releaseTag; 
                "0x53696c766572000000000000000000000000000000000000"//bytes24 factoryChangeNotes;
            ]
        ]

        var libData = await ethers.getContractFactory("@intercoin/liquidity/contracts/LiquidityLib.sol:LiquidityLib");    
        const liquidityLib = await libData.deploy();

        const chainIdHex = await network.provider.send('eth_chainId');
        const list = getStableCoinsList(chainIdHex);

        const CommonSettings = [
            ERC20MintableInstance.target,   // *  address sellingToken address of ITR token
            list.usdt,                      // *  address token0 USD Coin
            list.weth,                      // *  address token1 Wrapped token (WETH,WBNB,...)
            liquidityLib.target,            // *  address liquidityLib liquidityLib address(see intercoin/liquidity pkg)
            lastTime,                       // *  address endTime after this time exchange stop
            
        ];

        const CompensationSettings = [
            lastTimeForCompensation         // *  address endTimeForCompensation after this time receiving compensation tokens will be disabled
        ]


        await releaseManager.connect(owner).newRelease(factoriesList, factoryInfo);
        return {
            owner, 
            accountOne, 
            accountTwo, 
            accountThree, 
            accountFourth, 
            accountFive, 
            accountSix, 
            accountSeven, 
            accountEight, 
            accountNine, 
            accountEleven, 
            trustedForwarder,
            //
            blockTime,
            timestamps,
            prices,
            amountRaisedEx,
            priceSettings,
            //---
            lastTime,
            enumWithdrawOption,
            dontUseWhitelist,
            dontUseLockedInAmount,
            //----
            thresholds,
            bonuses,
            thresholdBonuses,
            //-------
            lastTimeForCompensation,
            CommonSettings,
            CompensationSettings,
            //
            SalesFactory,
            ERC20MintableF,
            ERC20MintableInstance,
            Token2PayInstance
        }
    }

    async function deploySalesTokenInstance() {
        const res = await loadFixture(deploy);
        const {
            owner,
            timestamps,
            prices,
            amountRaisedEx,
            //--
            priceSettings,
            //--
            lastTime,
            thresholds,
            bonuses,
            //--
            thresholdBonuses,
            //---
            enumWithdrawOption,
            dontUseWhitelist,
            dontUseLockedInAmount,
            CommonSettings,
            CompensationSettings,
            SalesFactory,
            ERC20MintableF,
            Token2PayInstance
        } = res;
        
        let tx = await SalesFactory.connect(owner).produceSalesForToken(
            Token2PayInstance.target,
            CommonSettings,
            priceSettings,
            thresholdBonuses,
            enumWithdrawOption.anytime,
            dontUseWhitelist,
            dontUseLockedInAmount,
            CompensationSettings
        );

        const rc = await tx.wait(); // 0ms, as tx is already confirmed

        const event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
        const [instance,] = event.args;

        const SalesTokenInstance = await ethers.getContractAt("SalesTokenMock",instance);   

        return {...res, ...{
            SalesTokenInstance
        }};
    }
     
    async function deploySalesInstance() {

        const res = await loadFixture(deploy);
        
        const {
            owner,
            //----
            timestamps,
            prices,
            amountRaisedEx,
            //----
            priceSettings,
            //----
            lastTime,
            //----
            thresholds,
            bonuses,
            //----
            thresholdBonuses,
            //---
            enumWithdrawOption,
            dontUseWhitelist,
            dontUseLockedInAmount,
            CommonSettings,
            SalesFactory,
            ERC20MintableF,
            ERC20MintableInstance
        } = res;

        let tx = await SalesFactory.connect(owner).produce(
            CommonSettings,
            priceSettings,
            thresholdBonuses,
            enumWithdrawOption.anytime,
            dontUseWhitelist,
            dontUseLockedInAmount
        );

        const rc = await tx.wait(); // 0ms, as tx is already confirmed
        const event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
        const [instance,] = event.args;

        const SalesInstance = await ethers.getContractAt("SalesMock",instance);   

        return {...res, ...{
            SalesInstance
        }};
    }

    describe("TrustedForwarder", function () {
        
    
        it("should be empty after init", async() => {
            const {accountOne, SalesTokenInstance} = await deploySalesTokenInstance();
            expect(await SalesTokenInstance.connect(accountOne).isTrustedForwarder(ZERO_ADDRESS)).to.be.true;
        });

        it("should be setup by owner", async() => {
            const {owner, accountOne, accountTwo, SalesTokenInstance} = await deploySalesTokenInstance();

            await expect(SalesTokenInstance.connect(accountOne).setTrustedForwarder(accountTwo.address)).to.be.revertedWith("Ownable: caller is not the owner");
            expect(await SalesTokenInstance.connect(accountOne).isTrustedForwarder(ZERO_ADDRESS)).to.be.true;
            await SalesTokenInstance.connect(owner).setTrustedForwarder(accountTwo.address);
            expect(await SalesTokenInstance.connect(accountOne).isTrustedForwarder(accountTwo.address)).to.be.true;
        });
        
        it("should drop trusted forward if trusted forward become owner ", async() => {
            const {owner, accountOne, accountTwo, SalesTokenInstance} = await deploySalesTokenInstance();

            await SalesTokenInstance.connect(owner).setTrustedForwarder(accountTwo.address);
            expect(await SalesTokenInstance.connect(accountOne).isTrustedForwarder(accountTwo.address)).to.be.true;
            await SalesTokenInstance.connect(owner).transferOwnership(accountTwo.address);
            expect(await SalesTokenInstance.connect(accountOne).isTrustedForwarder(ZERO_ADDRESS)).to.be.true;
        });

        it("shouldnt become owner and trusted forwarder", async() => {
            const {owner, SalesTokenInstance} = await deploySalesTokenInstance();

            await expect(SalesTokenInstance.connect(owner).setTrustedForwarder(owner.address)).to.be.revertedWithCustomError(SalesTokenInstance, `ForwarderCanNotBeOwner`);
        });

        it("shouldnt withdraw by owner if setup option `_ownerCanWithdraw` eq `never` ", async() => {
            const {
                owner,
                accountFive,
                priceSettings,
                lastTime,
                thresholdBonuses,
                enumWithdrawOption,
                dontUseWhitelist,
                dontUseLockedInAmount,
                CommonSettings,
                SalesFactory,
                ERC20MintableInstance
            } = await deploy();

            let tx = await SalesFactory.connect(owner).produce(
                CommonSettings,
                priceSettings,
                thresholdBonuses,
                enumWithdrawOption.never, 
                dontUseWhitelist,
                dontUseLockedInAmount
            );

            let rc = await tx.wait(); // 0ms, as tx is already confirmed
            let event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
            let [instance,] = event.args;

            var SalesInstance = await ethers.getContractAt("Sales",instance);   

            let tmp = await ethers.provider.send("eth_blockNumber",[]);
            tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
            let currentBlockTime = BigInt(tmp.timestamp);

            // send ETH to Contract, but it should be revert with message "Amount exceeds allowed balance"
            const amountSellingTokensSendToContract = ethers.parseEther('1000000');//MILLION.mul(ONE_ETH);
            await ERC20MintableInstance.connect(owner).mint(SalesInstance.target, amountSellingTokensSendToContract);

            //
            await expect(
                SalesInstance.connect(owner).withdraw(amountSellingTokensSendToContract, accountFive.address)
            ).to.be.revertedWithCustomError(SalesInstance, "WithdrawDisabled");
            
            // go to end time
            await ethers.provider.send('evm_increaseTime', [parseInt(lastTime-currentBlockTime)]);
            await ethers.provider.send('evm_mine');

            await expect(
                SalesInstance.connect(owner).withdraw(amountSellingTokensSendToContract, accountFive.address)
            ).to.be.revertedWithCustomError(SalesInstance, "WithdrawDisabled");

        });

        it("should withdraw by owner after endTime is passed if setup option `_ownerCanWithdraw` eq `afterEndTime` ", async() => {
            
            const {
                owner,
                accountFive,
                priceSettings,
                lastTime,
                thresholdBonuses,
                enumWithdrawOption,
                dontUseWhitelist,  
                dontUseLockedInAmount,     
                CommonSettings,
                SalesFactory,
                ERC20MintableInstance
            } = await deploy();

            let tx = await SalesFactory.connect(owner).produce(
                CommonSettings,
                priceSettings,
                thresholdBonuses,
                enumWithdrawOption.afterEndTime, 
                dontUseWhitelist,
                dontUseLockedInAmount
            );

            let rc = await tx.wait(); // 0ms, as tx is already confirmed
            let event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
            let [instance,] = event.args;

            var SalesInstance = await ethers.getContractAt("Sales",instance);   

            let tmp = await ethers.provider.send("eth_blockNumber",[]);
            tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
            let currentBlockTime = BigInt(tmp.timestamp);

            const amountSellingTokensSendToContract = ethers.parseEther('1000000');//MILLION.mul(ONE_ETH);
            await ERC20MintableInstance.connect(owner).mint(SalesInstance.target, amountSellingTokensSendToContract);

            //
            await expect(
                SalesInstance.connect(owner).withdraw(amountSellingTokensSendToContract, accountFive.address)
            ).to.be.revertedWithCustomError(SalesInstance, "WithdrawDisabled");
            
            // go to end time
            await ethers.provider.send('evm_increaseTime', [parseInt(lastTime-currentBlockTime)]);
            await ethers.provider.send('evm_mine');

            let sellingTokensBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive.address);

            await SalesInstance.connect(owner).withdraw(amountSellingTokensSendToContract, accountFive.address);
            let sellingTokensBalanceAfter = await ERC20MintableInstance.balanceOf(accountFive.address);

            expect(sellingTokensBalanceAfter - sellingTokensBalanceBefore).to.be.eq(amountSellingTokensSendToContract);

        });

        it("should withdraw by owner anytime if setup option `_ownerCanWithdraw` eq `anytime` ", async() => {

            const {
                owner,
                accountFive,
                priceSettings,
                lastTime,
                thresholdBonuses,
                enumWithdrawOption,
                dontUseWhitelist,
                dontUseLockedInAmount,
                CommonSettings,
                SalesFactory,
                ERC20MintableInstance
            } = await deploy();

            let tx = await SalesFactory.connect(owner).produce(
                CommonSettings,
                priceSettings,
                thresholdBonuses,
                enumWithdrawOption.anytime,
                dontUseWhitelist,
                dontUseLockedInAmount
            );

            let rc = await tx.wait(); // 0ms, as tx is already confirmed
            let event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
            let [instance,] = event.args;

            var SalesInstance = await ethers.getContractAt("Sales",instance);   

            let tmp = await ethers.provider.send("eth_blockNumber",[]);
            tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
            let currentBlockTime = BigInt(tmp.timestamp);

            const amountSellingTokensSendToContract = ethers.parseEther('1000000');//MILLION.mul(ONE_ETH);
            await ERC20MintableInstance.connect(owner).mint(SalesInstance.target, amountSellingTokensSendToContract);


            let sellingTokensBalanceBefore,sellingTokensBalanceAfter,tmpSnapId;

            // make snapshot before time manipulations
            tmpSnapId = await ethers.provider.send('evm_snapshot', []);  
            sellingTokensBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive.address);
            await SalesInstance.connect(owner).withdraw(amountSellingTokensSendToContract, accountFive.address);
            sellingTokensBalanceAfter = await ERC20MintableInstance.balanceOf(accountFive.address);
            expect(sellingTokensBalanceAfter - sellingTokensBalanceBefore).to.be.eq(amountSellingTokensSendToContract);
            // restore snapshot
            await ethers.provider.send('evm_revert', [tmpSnapId]);

            // or go to end time
            await ethers.provider.send('evm_increaseTime', [parseInt(lastTime-currentBlockTime)]);
            await ethers.provider.send('evm_mine');

            // make snapshot before time manipulations
            tmpSnapId = await ethers.provider.send('evm_snapshot', []);  
            sellingTokensBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive.address);
            await SalesInstance.connect(owner).withdraw(amountSellingTokensSendToContract, accountFive.address);
            sellingTokensBalanceAfter = await ERC20MintableInstance.balanceOf(accountFive.address);
            expect(sellingTokensBalanceAfter - sellingTokensBalanceBefore).to.be.eq(amountSellingTokensSendToContract);
            // restore snapshot
            await ethers.provider.send('evm_revert', [tmpSnapId]);

        });
    });

    for (const trustedForwardMode of [false,true]) {

    describe(`${trustedForwardMode ? '[with trusted forwarder]' : ''} tests`, function () {  

        it('common test(token)', async () => {

            const {
                owner,
                accountTwo,
                accountFourth,
                accountFive,
                trustedForwarder,
                lastTime,
                ERC20MintableInstance,
                Token2PayInstance,
                SalesTokenInstance
            } = await loadFixture(deploySalesTokenInstance);

            if (trustedForwardMode) {
                await SalesTokenInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
            }

            // send ETH to Contract
            await expect(accountTwo.sendTransaction({
                to: SalesTokenInstance.target, 
                value: ONE_ETH,
                gasLimit: 150000
            })
            ).to.be.revertedWithCustomError(SalesTokenInstance, 'NotSupported');

            await Token2PayInstance.connect(owner).mint(accountTwo.address, amountTokenSendToContract);
            var ratio_TOKEN2_ITR = await SalesTokenInstance.connect(owner).getTokenPrice();

            // send t2 to Contract, but it should be revert with message "Amount exceeds allowed balance"
            await mixedCall(SalesTokenInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), accountTwo, 'buy(uint256)', [amountTokenSendToContract], "ERC20: insufficient allowance");
            
            await ERC20MintableInstance.connect(owner).mint(SalesTokenInstance.target, MILLION * ONE_ETH);

            var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);
            // set approve before
            await Token2PayInstance.connect(accountTwo).approve(SalesTokenInstance.target, amountTokenSendToContract);
            // send Token2 to Contract 
            await mixedCall(SalesTokenInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), accountTwo, 'buy(uint256)', [amountTokenSendToContract]);

            var accountTwoBalanceActual = await ERC20MintableInstance.balanceOf(accountTwo.address);
            var calculatedAmountOfTokens = amountTokenSendToContract * ethDenom / ratio_TOKEN2_ITR;
            var accountTwoBalanceExpected = accountTwoBalanceBefore + calculatedAmountOfTokens;

            expect(accountTwoBalanceActual).to.be.eq(accountTwoBalanceExpected);

            let tmp;
            tmp = await ethers.provider.send("eth_blockNumber",[]);
            tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
            currentBlockTime = BigInt(tmp.timestamp);

            // go to end time
            await ethers.provider.send('evm_increaseTime', [parseInt(lastTime-currentBlockTime)]);
            await ethers.provider.send('evm_mine');

            

            let tmpSnapId;
            //---------------------------------
            // Make claim to accountFourth

            // make snapshot before time manipulations
            tmpSnapId = await ethers.provider.send('evm_snapshot', []);  

            var accountFourthBalanceBefore = await Token2PayInstance.balanceOf(accountFourth.address);
            await mixedCall(SalesTokenInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), owner, 'claim(uint256,address)', [amountETHSendToContract, accountFourth.address]);
            var accountFourthBalanceAfter = await Token2PayInstance.balanceOf(accountFourth.address);
            expect(accountFourthBalanceAfter - accountFourthBalanceBefore).to.be.eq(amountETHSendToContract);

            // restore snapshot
            await ethers.provider.send('evm_revert', [tmpSnapId]);
            //---------------------------------end
            //---------------------------------
            // Make claimAll

            // make snapshot before time manipulations
            tmpSnapId = await ethers.provider.send('evm_snapshot', []);  

            var accountOwnerBalanceBefore = await Token2PayInstance.balanceOf(owner.address);
            let amountETHHoldOnContract = await SalesTokenInstance.getHoldedAmount();
            await mixedCall(SalesTokenInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), owner, 'claimAll', []);
            var accountOwnerBalanceAfter = await Token2PayInstance.balanceOf(owner.address);
            expect(accountOwnerBalanceAfter - accountOwnerBalanceBefore).to.be.eq(amountETHHoldOnContract);

            // restore snapshot
            await ethers.provider.send('evm_revert', [tmpSnapId]);
            //---------------------------------end

            var accountFiveBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive.address);
            await mixedCall(SalesTokenInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), owner, 'withdraw(uint256,address)', [calculatedAmountOfTokens, accountFive.address]);
            var accountFiveBalanceActual = await ERC20MintableInstance.balanceOf(accountFive.address);
            var accountFiveBalanceExpected = accountFiveBalanceBefore + calculatedAmountOfTokens;

            expect(accountFiveBalanceActual).to.be.eq(accountFiveBalanceExpected);

        });
    
        it('common test(eth)', async () => {
            const {
                owner,
                accountTwo,
                trustedForwarder,
                ERC20MintableInstance,
                SalesInstance
            } = await loadFixture(deploySalesInstance);

            if (trustedForwardMode) {
                await SalesInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
            }

            let tmp = await ethers.provider.send("eth_blockNumber",[]);
            tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
            let currentBlockTime = parseInt(tmp.timestamp);

            var ratio_ETH_ITR = await SalesInstance.getTokenPrice();
        
            // send ETH to Contract, but it should be revert with message "Amount exceeds allowed balance"
            await expect(
                accountTwo.sendTransaction({
                    to: SalesInstance.target, 
                    value: amountETHSendToContract
                })
            ).to.be.revertedWithCustomError(SalesInstance, "InsufficientAmount");
            
            await ERC20MintableInstance.connect(owner).mint(SalesInstance.target, MILLION * MILLION * MILLION * ONE_ETH);

            var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);
            // send ETH to Contract
            await accountTwo.sendTransaction({
                to: SalesInstance.target, 
                value: amountETHSendToContract
            });

            var accountTwoBalanceActual = await ERC20MintableInstance.balanceOf(accountTwo.address);
            var calculatedAmountOfTokens = amountETHSendToContract * ethDenom / ratio_ETH_ITR;
            var accountTwoBalanceExpected = accountTwoBalanceBefore + calculatedAmountOfTokens;
            
            expect(accountTwoBalanceActual).to.be.eq(accountTwoBalanceExpected);
            /*    
            // go to end time
            await ethers.provider.send('evm_increaseTime', [parseInt(lastTime-currentBlockTime)]);
            await ethers.provider.send('evm_mine');
                  

            @dev
            commented out this part
            need to fix the code below
            looks like is not completed

            let tmpSnapId;
            //---------------------------------
            // Make claim to accountFourth
            

            // make snapshot before time manipulations
            tmpSnapId = await ethers.provider.send('evm_snapshot', []);  

            var accountFourthBalanceBefore = (await ethers.provider.getBalance(accountFourth.address));
            await mixedCall(SalesTokenInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), owner, 'claim(uint256,address)', [amountETHSendToContract, accountFourth.address]);
            var accountFourthBalanceAfter = (await ethers.provider.getBalance(accountFourth.address));
            expect(accountFourthBalanceAfter.sub(accountFourthBalanceBefore)).to.be.eq(amountETHSendToContract);
            
            // restore snapshot
            await ethers.provider.send('evm_revert', [tmpSnapId]);
            //---------------------------------end
            //---------------------------------
            // Make claimAll

            var accountOwnerBalanceBefore = (await ethers.provider.getBalance(owner.address));
            let amountETHHoldOnContract = await SalesTokenInstance.getHoldedAmount();
            tx = await mixedCall(SalesTokenInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), owner, 'claimAll', []);
            rc = await tx.wait(); 
            txFee = rc.cumulativeGasUsed.mul(rc.effectiveGasPrice);
            if (trustedForwardMode) {
                txFee = 0; // owner didn't spent anything, trusted forwarder payed fee for tx
            }
            var accountOwnerBalanceAfter = (await ethers.provider.getBalance(owner.address));
            expect(accountOwnerBalanceAfter.sub(accountOwnerBalanceBefore).add(txFee)).to.be.eq(amountETHHoldOnContract);

            // make snapshot before time manipulations
            tmpSnapId = await ethers.provider.send('evm_snapshot', []);  


            var accountFiveBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive.address);
            await mixedCall(SalesTokenInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), owner, 'withdraw(uint256,address)', [calculatedAmountOfTokens, accountFive.address]);
            var accountFiveBalanceActual = await ERC20MintableInstance.balanceOf(accountFive.address);
            var accountFiveBalanceExpected = accountFiveBalanceBefore.add(calculatedAmountOfTokens);

            expect(accountFiveBalanceActual).to.be.eq(accountFiveBalanceExpected);
            
            // restore snapshot
            await ethers.provider.send('evm_revert', [tmpSnapId]);
            */
        });
    
        it('common test(token) with Whitelist', async () => {
            
            const {
                owner,
                accountTwo,
                accountFourth,
                accountFive,
                trustedForwarder,
                priceSettings,
                lastTime,
                thresholdBonuses,
                enumWithdrawOption,
                dontUseLockedInAmount,
                CommonSettings,
                CompensationSettings,
                SalesFactory,
                ERC20MintableInstance,
                Token2PayInstance
            } = await loadFixture(deploy);

            let MockWhitelistF = await ethers.getContractFactory("MockWhitelist");    
            let MockWhitelist = await MockWhitelistF.deploy();
            await MockWhitelist.setupSuccess(true);
            const UseExternalWhitelist = [
                MockWhitelist.target,
                "0x00000000",
                55,
                true
            ];

            let tx = await SalesFactory.connect(owner).produceSalesForToken(
                Token2PayInstance.target,
                //ERC20MintableInstance.target,
                CommonSettings,
                priceSettings,
                thresholdBonuses,
                enumWithdrawOption.anytime,
                UseExternalWhitelist,
                dontUseLockedInAmount,
                CompensationSettings
            );

            const rc = await tx.wait(); // 0ms, as tx is already confirmed
            const event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
            const [instance,] = event.args;

            const SalesTokenInstance = await ethers.getContractAt("SalesTokenMock",instance);   

            if (trustedForwardMode) {
                await SalesTokenInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
            }

            // send ETH to Contract
            await expect(accountTwo.sendTransaction({
                to: SalesTokenInstance.target, 
                value: ONE_ETH,
                gasLimit: 150000
            })
            ).to.be.revertedWithCustomError(SalesTokenInstance, `NotSupported`);

            await Token2PayInstance.connect(owner).mint(accountTwo.address, amountTokenSendToContract);
            var ratio_TOKEN2_ITR = await SalesTokenInstance.connect(owner).getTokenPrice();

            // send t2 to Contract, but it should be revert with message "Amount exceeds allowed balance"
            await mixedCall(SalesTokenInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), accountTwo, 'buy(uint256)', [amountTokenSendToContract], "ERC20: insufficient allowance");
            
            await ERC20MintableInstance.connect(owner).mint(SalesTokenInstance.target, MILLION * ONE_ETH);

            var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);
            // set approve before
            await Token2PayInstance.connect(accountTwo).approve(SalesTokenInstance.target, amountTokenSendToContract);
            // send Token2 to Contract 
            await mixedCall(SalesTokenInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), accountTwo, 'buy(uint256)', [amountTokenSendToContract]);

            var accountTwoBalanceActual = await ERC20MintableInstance.balanceOf(accountTwo.address);
            var calculatedAmountOfTokens = amountTokenSendToContract * ethDenom / ratio_TOKEN2_ITR;
            var accountTwoBalanceExpected = accountTwoBalanceBefore + calculatedAmountOfTokens;

            expect(accountTwoBalanceActual).to.be.eq(accountTwoBalanceExpected);

            let tmp;
            tmp = await ethers.provider.send("eth_blockNumber",[]);
            tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
            currentBlockTime = BigInt(tmp.timestamp);

            // go to end time
            await ethers.provider.send('evm_increaseTime', [parseInt(lastTime-currentBlockTime)]);
            await ethers.provider.send('evm_mine');

            

            let tmpSnapId;
            //---------------------------------
            // Make claim to accountFourth

            // make snapshot before time manipulations
            tmpSnapId = await ethers.provider.send('evm_snapshot', []);  

            var accountFourthBalanceBefore = await Token2PayInstance.balanceOf(accountFourth.address);
            await mixedCall(SalesTokenInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), owner, 'claim(uint256,address)', [amountETHSendToContract, accountFourth.address]);
            var accountFourthBalanceAfter = await Token2PayInstance.balanceOf(accountFourth.address);
            expect(accountFourthBalanceAfter - accountFourthBalanceBefore).to.be.eq(amountETHSendToContract);

            // restore snapshot
            await ethers.provider.send('evm_revert', [tmpSnapId]);
            //---------------------------------end
            //---------------------------------
            // Make claimAll

            // make snapshot before time manipulations
            tmpSnapId = await ethers.provider.send('evm_snapshot', []);  

            var accountOwnerBalanceBefore = await Token2PayInstance.balanceOf(owner.address);
            let amountETHHoldOnContract = await SalesTokenInstance.getHoldedAmount();
            await mixedCall(SalesTokenInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), owner, 'claimAll', []);
            var accountOwnerBalanceAfter = await Token2PayInstance.balanceOf(owner.address);
            expect(accountOwnerBalanceAfter - accountOwnerBalanceBefore).to.be.eq(amountETHHoldOnContract);

            // restore snapshot
            await ethers.provider.send('evm_revert', [tmpSnapId]);
            //---------------------------------end

            var accountFiveBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive.address);
            await mixedCall(SalesTokenInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), owner, 'withdraw(uint256,address)', [calculatedAmountOfTokens, accountFive.address]);
            var accountFiveBalanceActual = await ERC20MintableInstance.balanceOf(accountFive.address);
            var accountFiveBalanceExpected = accountFiveBalanceBefore + calculatedAmountOfTokens;

            expect(accountFiveBalanceActual).to.be.eq(accountFiveBalanceExpected);

        });

        it('common test(token) with Bad Whitelist contract', async () => {

            const {
                owner,
                accountTwo,
                trustedForwarder,
                priceSettings,
                lastTime,
                thresholdBonuses,
                enumWithdrawOption,
                dontUseLockedInAmount,
                CommonSettings,
                CompensationSettings,
                SalesFactory,
                ERC20MintableInstance,
                Token2PayInstance
            } = await loadFixture(deploy);

            let MockWhitelistF = await ethers.getContractFactory("MockWhitelist");    
            let MockWhitelist = await MockWhitelistF.deploy();
            const UseExternalWhitelist = [
                MockWhitelist.target,
                "0x00000000",
                55,
                true
            ];

            
            let tx = await SalesFactory.connect(owner).produceSalesForToken(
                Token2PayInstance.target,
                CommonSettings,
                priceSettings,
                thresholdBonuses,
                enumWithdrawOption.anytime,
                UseExternalWhitelist,
                dontUseLockedInAmount,
                CompensationSettings
            );

            const rc = await tx.wait(); // 0ms, as tx is already confirmed
            const event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
            const [instance,] = event.args;

            const SalesTokenInstance = await ethers.getContractAt("SalesTokenMock",instance);   

            if (trustedForwardMode) {
                await SalesTokenInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
            }

            // send ETH to Contract
            await expect(accountTwo.sendTransaction({
                to: SalesTokenInstance.target, 
                value: ONE_ETH,
                gasLimit: 150000
            })
            ).to.be.revertedWithCustomError(SalesTokenInstance, `NotSupported`);

            await Token2PayInstance.connect(owner).mint(accountTwo.address, amountTokenSendToContract);
            //var ratio_TOKEN2_ITR = await SalesTokenInstance.connect(owner).getTokenPrice();

            // send t2 to Contract, but it should be revert with message "Amount exceeds allowed balance"
            await mixedCall(SalesTokenInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), accountTwo, 'buy(uint256)', [amountTokenSendToContract], "ERC20: insufficient allowance");
            
            await ERC20MintableInstance.connect(owner).mint(SalesTokenInstance.target, MILLION * ONE_ETH);

            //var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);
            // set approve before
            await Token2PayInstance.connect(accountTwo).approve(SalesTokenInstance.target, amountTokenSendToContract);
            // send Token2 to Contract 
            await mixedCall(SalesTokenInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), accountTwo, 'buy(uint256)', [amountTokenSendToContract], {custom:"WhitelistError"});

        });
    
        it('test tokenPrice', async () => {
            const {
                owner,
                trustedForwarder,
                prices,
                priceSettings,
                lastTime,
                thresholdBonuses,
                enumWithdrawOption,
                dontUseWhitelist,
                dontUseLockedInAmount,
                CommonSettings,
                SalesFactory,
                ERC20MintableF
            } = await loadFixture(deploy);

            var priceSettingsCustom = priceSettings.map(function(arr) {
                return arr.slice();
            });
            
            var amountRaisedCustom = [0, 100, 500];
            // Example:
            //     thresholds = [10000, 25000, 50000]
            //     bonuses = [0.1, 0.2, 0.5]
            //     amountRaised = [0, 100, 500]
            priceSettingsCustom[0][2] = amountRaisedCustom[0];
            priceSettingsCustom[1][2] = amountRaisedCustom[1];
            priceSettingsCustom[2][2] = amountRaisedCustom[2];

            let tx = await SalesFactory.connect(owner).produce(
                CommonSettings,
                priceSettingsCustom,
                thresholdBonuses,
                enumWithdrawOption.anytime,
                dontUseWhitelist,
                dontUseLockedInAmount
            );

            const rc = await tx.wait(); // 0ms, as tx is already confirmed
            const event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
            const [instance,] = event.args;

            const SalesInstance = await ethers.getContractAt("SalesMock",instance);   

            if (trustedForwardMode) {
                await SalesInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
            }
            var tokenPrice;

            var setAmountTotalRaisedValues = [0,150,600];
            for (let i in setAmountTotalRaisedValues) {
                await SalesInstance.connect(owner).setTotalAmountRaised(setAmountTotalRaisedValues[i]);
                tokenPrice = await SalesInstance.getTokenPrice();
                expect(tokenPrice).to.be.eq(prices[i]);
            }

        });

        // usdt eth 
        // 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
        // 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
        it('test bonuses', async () => {
            
            // Example:
            //     thresholds = [10000, 25000, 50000]
            //     bonuses = [0.1, 0.2, 0.5]
            //     First person contributed $10,000 and got 0.1 bonus which is $1,000
            //     Second person in same group contributed $20,000 so total of group if $30,000 and so second person gets 20% of $20,000 = $4000 while first person gets 10% of $10,000 which is another $1,000.
    
            const {
                owner,
                accountOne,
                accountTwo,
                trustedForwarder,
                thresholds,
                ERC20MintableInstance,
                SalesInstance
            } = await loadFixture(deploySalesInstance);

            if (trustedForwardMode) {
                await SalesInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
            }

            var ratio_ETH_ITR = await SalesInstance.getTokenPrice();
            
            // equivalent thresholds[0]
            var ethAmount1 = BigInt(thresholds[0].toString());
            // equivalent thresholds[1]
            var ethAmount2 = BigInt(thresholds[1].toString());

            await ERC20MintableInstance.connect(owner).mint(SalesInstance.target, MILLION * ONE_ETH);
            
            await mixedCall(SalesInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), owner, 'setGroup(address[],string)', [[accountOne.address,accountTwo.address],'TestGroupName']);
        
            var accountOneBalanceBefore = await ERC20MintableInstance.balanceOf(accountOne.address);
            var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);

            await accountOne.sendTransaction({
                to: SalesInstance.target, 
                value: ethAmount1,
               // gasLimit: 2000000
            });

            var accountOneBalanceMiddle = await ERC20MintableInstance.balanceOf(accountOne.address);

            await accountTwo.sendTransaction({
                to: SalesInstance.target, 
                value: ethAmount2,
                gasLimit: 2000000
            });

            var accountOneBalanceAfter = await ERC20MintableInstance.balanceOf(accountOne.address);
            var accountTwoBalanceAfter = await ERC20MintableInstance.balanceOf(accountTwo.address);
            
            var base = ethAmount1 * ethDenom / ratio_ETH_ITR;

            expect(accountOneBalanceMiddle).to.be.eq(base+(base*(10n)/(100n)));
            expect(accountOneBalanceAfter).to.be.eq(base+(base*(20n)/(100n)));
        });

        it('test compensations', async () => {

            const {
                owner,
                accountTwo,
                trustedForwarder,
                lastTime,
                lastTimeForCompensation,
                ERC20MintableInstance,
                Token2PayInstance,
                SalesTokenInstance
            } = await loadFixture(deploySalesTokenInstance);

            if (trustedForwardMode) {
                await SalesTokenInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
            }

            let tmp = await ethers.provider.send("eth_blockNumber",[]);
            tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
            let currentBlockTime = BigInt(tmp.timestamp);
            await ERC20MintableInstance.connect(owner).mint(SalesTokenInstance.target, MILLION * MILLION * MILLION * ONE_ETH);

            var prices=[3000n,5500n,4000n];
            var sent=[];
            const endPrice = 5000n;
            var ratio_ETH_ITR, accountTwoBalanceBefore, accountTwoBalanceActual;

            //make iterations:
            for (var i=0; i < prices.length; ++i) {

                await SalesTokenInstance.connect(owner).setPrice(prices[i],1); // imitate uniswap price usdt/bnb 

                ratio_ETH_ITR = await SalesTokenInstance.getTokenPrice();
                accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);

                // send ETH to Contract
                // await accountTwo.sendTransaction({
                //     to: SalesTokenInstance.target, 
                //     value: amountETHSendToContract
                // });
                await Token2PayInstance.connect(owner).mint(accountTwo.address, amountTokenSendToContract);
                await Token2PayInstance.connect(accountTwo).approve(SalesTokenInstance.target, amountTokenSendToContract);
                await mixedCall(SalesTokenInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), accountTwo, 'buy(uint256)', [amountTokenSendToContract]);
                //-------------------------------
                accountTwoBalanceActual = await ERC20MintableInstance.balanceOf(accountTwo.address);

                sent[i] = amountETHSendToContract * ethDenom / ratio_ETH_ITR;

                expect(
                    accountTwoBalanceActual
                ).to.be.eq(
                    accountTwoBalanceBefore + sent[i]
                );
            }

            // run compensation
            await expect(
                SalesTokenInstance.connect(accountTwo).compensation()
            ).to.be.revertedWithCustomError(SalesTokenInstance, 'CompensationTimeShouldBePassed');

            // go to end time
            await time.increase(lastTime-currentBlockTime);
            
            //set Price
            await SalesTokenInstance.connect(owner).setPrice(endPrice,1);

            var expectedCompensationAmount = 0n;

            for (var i=0; i < prices.length; ++i) {
                // send =  sent * newPrice / oldPrice
                // if (send <= sent) continue;
                // otherwise compensationAmount += send - sent
                var send = sent[i] * endPrice / prices[i];
                if (send <= sent[i]) {
                    continue;
                }
                
                expectedCompensationAmount += send - sent[i];
                
            }

            accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);
            await SalesTokenInstance.connect(accountTwo).compensation();
            accountTwoBalanceActual = await ERC20MintableInstance.balanceOf(accountTwo.address);

            expect(
                accountTwoBalanceActual
            ).to.be.eq(
                accountTwoBalanceBefore + expectedCompensationAmount
            );

            await expect(
                SalesTokenInstance.connect(accountTwo).compensation()
            ).to.be.revertedWithCustomError(SalesTokenInstance, 'CompensationNotFound');

            // go to compensation end time
            await time.increase(lastTimeForCompensation - lastTime);

            await expect(
                SalesTokenInstance.connect(accountTwo).compensation()
            ).to.be.revertedWithCustomError(SalesTokenInstance, 'CompensationTimeExpired');

        });

        describe("test locked in Price", function () {
            it('shouldn\'t be locked up', async () => {
                
                const useLockedInAmount = [
                    BigInt(ethers.parseEther('10')),//uint256 minimumLockedInAmount;
                    BigInt(ethers.parseEther('100'))//uint256 maximumLockedInAmount;
                ];
                const {
                    owner,
                    accountTwo,
                    prices,
                    priceSettings,
                    lastTime,
                    thresholdBonuses,
                    enumWithdrawOption,
                    dontUseWhitelist,
                    CommonSettings,
                    ERC20MintableInstance,
                    SalesFactory
                } = await loadFixture(deploy);
                
                const tx = await SalesFactory.connect(owner).produce(
                    CommonSettings,
                    priceSettings,
                    thresholdBonuses,
                    enumWithdrawOption.never,
                    dontUseWhitelist,
                    useLockedInAmount
                );

                const rc = await tx.wait(); // 0ms, as tx is already confirmed
                const event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
                const [instance,] = event.args;

                const SalesInstance = await ethers.getContractAt("Sales",instance);   

                const fourthPartOfMinimum = useLockedInAmount[0]/FOUR;
                const amountETHSendToContractToBuyBeforeMinimum = prices[0] * fourthPartOfMinimum/BigInt('100000000');
                const amountETHSendToContractToBuyOverMinimum = prices[0] * useLockedInAmount[0]*TWO/BigInt('100000000');
                const amountETHSendToContractToBuyOverMaximum = prices[0] * useLockedInAmount[1]*TWO/BigInt('100000000');

                await ERC20MintableInstance.connect(owner).mint(SalesInstance.target , 1000000n*1000000n*1000000n*ONE_ETH);

                var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);
                // send ETH to Contract
                await accountTwo.sendTransaction({
                    to: SalesInstance.target, 
                    value: amountETHSendToContractToBuyBeforeMinimum
                });

                var accountTwoBalanceAfter = await ERC20MintableInstance.balanceOf(accountTwo.address);
                // send ETH to Contract
                await accountTwo.sendTransaction({
                    to: SalesInstance.target, 
                    value: amountETHSendToContractToBuyBeforeMinimum
                });
                var accountTwoBalanceAfter2 = await ERC20MintableInstance.balanceOf(accountTwo.address);
                // send ETH to Contract
                await accountTwo.sendTransaction({
                    to: SalesInstance.target, 
                    value: amountETHSendToContractToBuyBeforeMinimum
                });

                expect(accountTwoBalanceBefore).to.be.eq(ZERO);
                expect(accountTwoBalanceAfter - accountTwoBalanceBefore).to.be.eq(fourthPartOfMinimum);
                expect(accountTwoBalanceAfter2 - accountTwoBalanceAfter).to.be.eq(fourthPartOfMinimum);


            });

            it('should be locked up after buy minimum', async () => {
                
                const useLockedInAmount = [
                    BigInt(ethers.parseEther('10')),//uint256 minimumLockedInAmount;
                    BigInt(ethers.parseEther('100'))//uint256 maximumLockedInAmount;
                ];
                const {
                    owner,
                    accountTwo,
                    accountThree,
                    prices,
                    amountRaisedEx,
                    priceSettings,
                    lastTime,
                    thresholdBonuses,
                    enumWithdrawOption,
                    dontUseWhitelist,
                    CommonSettings,
                    ERC20MintableInstance,
                    SalesFactory
                } = await loadFixture(deploy);
                
                const tx = await SalesFactory.connect(owner).produce(
                    CommonSettings,
                    priceSettings,
                    thresholdBonuses,
                    enumWithdrawOption.never,
                    dontUseWhitelist,
                    useLockedInAmount
                );

                const rc = await tx.wait(); // 0ms, as tx is already confirmed
                const event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
                const [instance,] = event.args;

                const SalesInstance = await ethers.getContractAt("SalesMock",instance);   

                const fourthPartOfMinimum = useLockedInAmount[0]/FOUR;
                const amountETHSendToContractToBuyBeforeMinimum = prices[0] * fourthPartOfMinimum/BigInt('100000000');
                const amountETHSendToContractToBuyOverMinimum = prices[0] * useLockedInAmount[0]*TWO/BigInt('100000000');
                const amountETHSendToContractToBuyOverMaximum = prices[0] * useLockedInAmount[1]*TWO/BigInt('100000000');

                await ERC20MintableInstance.connect(owner).mint(SalesInstance.target , 1000000n*1000000n*1000000n*ONE_ETH);

                var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);
                // send ETH to Contract
                await accountTwo.sendTransaction({
                    to: SalesInstance.target, 
                    value: amountETHSendToContractToBuyOverMinimum
                });

                var accountTwoBalanceAfter = await ERC20MintableInstance.balanceOf(accountTwo.address);

                expect(accountTwoBalanceBefore).to.be.eq(ZERO);
                expect(accountTwoBalanceAfter - accountTwoBalanceBefore).to.be.eq(useLockedInAmount[0]*TWO);

                // hardcode amount raised for 2nd period to turn on 2nd price
                await SalesInstance.connect(owner).setTotalAmountRaised(amountRaisedEx[1] + BigInt('1'));

                // AccountThree should buy on new price
                var accountThreeBalanceBefore = await ERC20MintableInstance.balanceOf(accountThree.address);

                await accountThree.sendTransaction({
                    to: SalesInstance.target, 
                    value: (prices[1] * fourthPartOfMinimum/BigInt('100000000'))
                });

                var accountThreeBalanceAfter = await ERC20MintableInstance.balanceOf(accountThree.address);

                expect(accountThreeBalanceAfter - accountThreeBalanceBefore).to.be.eq(fourthPartOfMinimum);

                // accountTwo should buy on locked price
                var accountTwoBalance2Before = await ERC20MintableInstance.balanceOf(accountTwo.address);
                // send ETH to Contract to buy 
                await accountTwo.sendTransaction({
                    to: SalesInstance.target, 
                    value: prices[0] * fourthPartOfMinimum/BigInt('100000000')
                });
                var accountTwoBalance2After = await ERC20MintableInstance.balanceOf(accountTwo.address);

                expect(accountTwoBalance2After - accountTwoBalance2Before).to.be.eq(fourthPartOfMinimum);
                
            });

            it('after maximum exceeded,  price should be as expected', async () => {
                const useLockedInAmount = [
                    BigInt(ethers.parseEther('10')),//uint256 minimumLockedInAmount;
                    BigInt(ethers.parseEther('100'))//uint256 maximumLockedInAmount;
                ];
                const {
                    owner,
                    accountTwo,
                    accountThree,
                    prices,
                    amountRaisedEx,
                    priceSettings,
                    lastTime,
                    thresholdBonuses,
                    enumWithdrawOption,
                    dontUseWhitelist,
                    CommonSettings,
                    ERC20MintableInstance,
                    SalesFactory
                } = await loadFixture(deploy);
                
                const tx = await SalesFactory.connect(owner).produce(
                    CommonSettings,
                    priceSettings,
                    thresholdBonuses,
                    enumWithdrawOption.never,
                    dontUseWhitelist,
                    useLockedInAmount
                );

                const rc = await tx.wait(); // 0ms, as tx is already confirmed
                const event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
                const [instance,] = event.args;

                const SalesInstance = await ethers.getContractAt("SalesMock",instance);   

                const fourthPartOfMinimum = useLockedInAmount[0]/FOUR;
                const amountETHSendToContractToBuyBeforeMinimum = prices[0] * fourthPartOfMinimum/BigInt('100000000');
                const amountETHSendToContractToBuyOverMinimum = prices[0] * useLockedInAmount[0]*TWO/BigInt('100000000');
                const amountETHSendToContractToBuyOverMaximum = prices[0] * useLockedInAmount[1]*TWO/BigInt('100000000');

                await ERC20MintableInstance.connect(owner).mint(SalesInstance.target , 1000000n*1000000n*1000000n*ONE_ETH);

                var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);
                // buy to jump over maximum
                await accountTwo.sendTransaction({
                    to: SalesInstance.target, 
                    value: amountETHSendToContractToBuyOverMaximum
                });
                var accountTwoBalanceAfter = await ERC20MintableInstance.balanceOf(accountTwo.address);



                // hardcode amount raised for 2nd period to turn on 2nd price
                await SalesInstance.connect(owner).setTotalAmountRaised(amountRaisedEx[1] + BigInt('1'));

                var accountTwoBalance2Before = await ERC20MintableInstance.balanceOf(accountTwo.address);
                // send ETH to Contract
                await accountTwo.sendTransaction({
                    to: SalesInstance.target, 
                    value: (prices[1] * fourthPartOfMinimum/BigInt('100000000'))
                });

                var accountTwoBalance2After = await ERC20MintableInstance.balanceOf(accountTwo.address);

                // // amount by locked price
                // var tokensBoughtByLockedPrice = useLockedInAmount[1] - useLockedInAmount[0]
                // var amountETHToBuyByLockedPrice = (prices[0] * (useLockedInAmount[1] - useLockedInAmount[0])/BigInt('100000000'));
                // var amountETH2 = useLockedInAmount[0]*TWO - amountETHToBuyByLockedPrice;
                // var tokensBoughtByUsualPrice = amountETH2 * BigInt('100000000') / prices[0];


                // expect(accountTwoBalanceAfter - accountTwoBalanceBefore).to.be.eq(tokensBoughtByUsualPrice + tokensBoughtByLockedPrice);
                expect(accountTwoBalanceAfter - accountTwoBalanceBefore).to.be.eq(useLockedInAmount[1]*TWO);

                expect(accountTwoBalance2After - accountTwoBalance2Before).to.be.eq(fourthPartOfMinimum);
            }); 
        }); 

        describe("test commissions", function () {
            async function deployForTestCommissions() {
                const res = await loadFixture(deploy);
                const {
                    owner,
                    accountOne,
                    accountTwo,
                    accountThree,
                    accountFourth,
                    accountFive,
                    accountEight,
                    accountNine,
                    accountEleven,
                    trustedForwarder,
                    timestamps,
                    prices,
                    amountRaisedEx,
                    priceSettings,
                    lastTime,
                    thresholds,
                    bonuses,

                    enumWithdrawOption,
                    dontUseWhitelist,
                    dontUseLockedInAmount,
                    CommonSettings,
                    SalesFactory,
                    ERC20MintableInstance
                } = res;

                // Example:
                //     thresholds = [10000, 100000, 1000000]
                //     bonuses = [0, 0, 0.5]
                //  set commissions to
                //      accountEight - 10%
                //      accountNine  - 20%;
                //      accountEleven- 10%;    

                let tmp;
                tmp = await ethers.provider.send("eth_blockNumber",[]);
                tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
                const currentBlockTime = BigInt(tmp.timestamp);

                let tx = await SalesFactory.connect(owner).produce(
                    CommonSettings,
                    priceSettings,
                    [
                        [10000n*ONE_ETH, 0n],
                        [100000n*ONE_ETH, 0n],
                        [1000000n*ONE_ETH, 50n],
                    ],
                    //----
                    enumWithdrawOption.never,
                    dontUseWhitelist,
                    dontUseLockedInAmount
                );

                const rc = await tx.wait(); // 0ms, as tx is already confirmed
                const event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
                const [instance,] = event.args;

                const SalesInstance = await ethers.getContractAt("Sales",instance);   

                if (trustedForwardMode) {
                    await SalesInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
                }

                // add commissions
                await SalesInstance.connect(owner).addCommission(1000, accountEight.address);
                await SalesInstance.connect(owner).addCommission(2000, accountNine.address);
                await SalesInstance.connect(owner).addCommission(1000, accountEleven.address);

                await ERC20MintableInstance.connect(owner).mint(SalesInstance.target, MILLION * ONE_ETH);

                const accountOneBalanceBefore = await ERC20MintableInstance.balanceOf(accountOne.address);
                const accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);
                const accountThreeBalanceBefore = await ERC20MintableInstance.balanceOf(accountThree.address);

                const accountOwnerBalanceBefore = (await ethers.provider.getBalance(owner.address));
                const accountEightBalanceBefore = (await ethers.provider.getBalance(accountEight.address));
                const accountNineBalanceBefore = (await ethers.provider.getBalance(accountNine.address));
                const accountElevenBalanceBefore = (await ethers.provider.getBalance(accountEleven.address));

                // buy tokens for 3 ETH
                const totalETHToSend = THREE*ONE_ETH;
                await accountOne.sendTransaction({
                    to: SalesInstance.target, 
                    value: totalETHToSend / 3n,
                    gasLimit: 2000000
                });
                await accountTwo.sendTransaction({
                    to: SalesInstance.target, 
                    value: totalETHToSend / 3n,
                    gasLimit: 2000000
                });
                await accountThree.sendTransaction({
                    to: SalesInstance.target, 
                    value: totalETHToSend / 3n,
                    gasLimit: 2000000
                });

                return {...res, ...{
                    accountOneBalanceBefore,
                    accountTwoBalanceBefore,
                    accountThreeBalanceBefore,
                    accountOwnerBalanceBefore,
                    accountEightBalanceBefore,
                    accountNineBalanceBefore,
                    accountElevenBalanceBefore,

                    totalETHToSend,
                    currentBlockTime,
                    ERC20MintableInstance,
                    SalesInstance
                }};
            }

            //var  currentBlockTime;

            it('claimAll', async () => {
                const {
                    owner,
                    accountOne,
                    accountTwo,
                    accountThree,
                    trustedForwarder,
                    accountOneBalanceBefore,
                    accountTwoBalanceBefore,
                    accountThreeBalanceBefore,
                    accountOwnerBalanceBefore,
                    totalETHToSend,
                    ERC20MintableInstance,
                    SalesInstance
                } = await loadFixture(deployForTestCommissions);

                var ratio_ETH_TOKENS = await SalesInstance.getTokenPrice();
                var expectedTokens = (totalETHToSend/3n) * (ethDenom) / (ratio_ETH_TOKENS);
                var accountOneBalanceAfter = await ERC20MintableInstance.balanceOf(accountOne.address);
                var accountTwoBalanceAfter = await ERC20MintableInstance.balanceOf(accountTwo.address);
                var accountThreeBalanceAfter = await ERC20MintableInstance.balanceOf(accountThree.address);
                
                expect(expectedTokens).not.be.eq(ZERO);
                expect(accountOneBalanceAfter - accountOneBalanceBefore).to.be.eq(expectedTokens);
                expect(accountTwoBalanceAfter - accountTwoBalanceBefore).to.be.eq(expectedTokens);
                expect(accountThreeBalanceAfter - accountThreeBalanceBefore).to.be.eq(expectedTokens);

                const tx1 = await mixedCall(SalesInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), owner, 'claimAll', []);
                const rc1 = await tx1.wait(); 
                
                var txFee= rc1.cumulativeGasUsed * rc1.gasPrice;

                if (trustedForwardMode) {
                    txFee = 0n; // owner didn't spent anything, trusted forwarder payed fee for tx
                }

                var accountOwnerBalanceAfter = (await ethers.provider.getBalance(owner.address));
                

                const ExpectedOwnerETH = totalETHToSend - (totalETHToSend * (1000n+2000n+1000n) / (FRACTION));
                expect(accountOwnerBalanceAfter - accountOwnerBalanceBefore).to.be.eq(ExpectedOwnerETH - txFee);
            });
        
            it('commissions', async () => {

                const {
                    owner,
                    accountFourth,
                    accountEight,
                    accountNine,
                    accountEleven,
                    trustedForwarder,
                    accountEightBalanceBefore,
                    accountNineBalanceBefore,
                    accountElevenBalanceBefore,
                    lastTime,
                    currentBlockTime,
                    totalETHToSend,
                    SalesInstance
                } = await loadFixture(deployForTestCommissions);

                await mixedCall(SalesInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), owner, 'claimAll', []);

                await expect(
                    SalesInstance.connect(accountFourth).sendCommissions()
                ).to.be.revertedWithCustomError(SalesInstance, 'ExchangeTimeShouldBePassed');

                //time
                // go to end time
                await time.increase(parseInt(lastTime-currentBlockTime));

                await SalesInstance.connect(accountFourth).sendCommissions();

                var accountEightBalanceAfter = (await ethers.provider.getBalance(accountEight.address));
                var accountNineBalanceAfter = (await ethers.provider.getBalance(accountNine.address));
                var accountElevenBalanceAfter = (await ethers.provider.getBalance(accountEleven.address));

                expect(accountEightBalanceAfter - accountEightBalanceBefore).to.be.eq(totalETHToSend * 1000n / FRACTION);
                expect(accountNineBalanceAfter - accountNineBalanceBefore).to.be.eq(totalETHToSend * 2000n / FRACTION);
                expect(accountElevenBalanceAfter - accountElevenBalanceBefore).to.be.eq(totalETHToSend * 1000n / FRACTION);

            });

            describe("after continueSale", function () {
                async function deployForTestCommissionsAndAfterContinueSale() {
                    const res = await loadFixture(deployForTestCommissions);
                    const {
                        owner,
                        accountFourth,
                        accountEight,
                        accountNine,
                        accountEleven,
                        trustedForwarder,
                        prices,
                        lastTime,
                        currentBlockTime,
                        SalesInstance
                    } = res;


                    await mixedCall(SalesInstance, (trustedForwardMode ? trustedForwarder : trustedForwardMode), owner, 'claimAll', []);

                    await time.increase(lastTime-currentBlockTime);

                    await SalesInstance.connect(accountFourth).sendCommissions();

                    const accountEightBalanceAfter = (await ethers.provider.getBalance(accountEight.address));
                    const accountNineBalanceAfter = (await ethers.provider.getBalance(accountNine.address));
                    const accountElevenBalanceAfter = (await ethers.provider.getBalance(accountEleven.address));

                    await SalesInstance.connect(owner).continueSale(
                        [lastTime+5n*timePeriod],
                        [prices[0]],
                        [1000000n*1000000n*1000000n*ONE_ETH],//[MILLION.mul(MILLION).mul(MILLION).mul(ONE_ETH)],
                        lastTime+20n*timePeriod
                    );
                    return {...res, ...{
                        accountEightBalanceAfter,
                        accountNineBalanceAfter,
                        accountElevenBalanceAfter,
                    }};
                }
                
                it('still can buy tokens', async () => {
                    const {
                        accountOne,
                        accountTwo,
                        accountThree,
                        totalETHToSend,
                        SalesInstance
                    } = await loadFixture(deployForTestCommissionsAndAfterContinueSale);
                    await accountOne.sendTransaction({  to: SalesInstance.target, value: totalETHToSend / 3n,gasLimit: 2000000});
                    await accountTwo.sendTransaction({  to: SalesInstance.target, value: totalETHToSend / 3n,gasLimit: 2000000});
                    await accountThree.sendTransaction({to: SalesInstance.target, value: totalETHToSend / 3n,gasLimit: 2000000});
                });

                it('buy the same as before and get commissions', async () => {
                    const {
                        accountOne,
                        accountTwo,
                        accountThree,
                        accountFourth,
                        accountEight,
                        accountNine,
                        accountEleven,
                        lastTime,
                        currentBlockTime,
                        accountEightBalanceBefore,
                        accountNineBalanceBefore,
                        accountElevenBalanceBefore,
                        accountEightBalanceAfter,
                        accountNineBalanceAfter,
                        accountElevenBalanceAfter,
                        totalETHToSend,                        

                        SalesInstance
                    } = await loadFixture(deployForTestCommissionsAndAfterContinueSale);
                    await accountOne.sendTransaction({  to: SalesInstance.target, value: totalETHToSend / 3n,gasLimit: 2000000});
                    await accountTwo.sendTransaction({  to: SalesInstance.target, value: totalETHToSend / 3n,gasLimit: 2000000});
                    await accountThree.sendTransaction({to: SalesInstance.target, value: totalETHToSend / 3n,gasLimit: 2000000});

                    // go to end time
                    await time.increase(lastTime + 20n*timePeriod - currentBlockTime);

                    await SalesInstance.connect(accountFourth).sendCommissions();

                    var accountEightBalanceAfter2 = (await ethers.provider.getBalance(accountEight.address));
                    var accountNineBalanceAfter2 = (await ethers.provider.getBalance(accountNine.address));
                    var accountElevenBalanceAfter2 = (await ethers.provider.getBalance(accountEleven.address));

                    // first commissions 
                    expect(accountEightBalanceAfter - accountEightBalanceBefore).to.be.eq(totalETHToSend * 1000n / FRACTION);
                    expect(accountNineBalanceAfter - accountNineBalanceBefore).to.be.eq(totalETHToSend * 2000n / FRACTION);
                    expect(accountElevenBalanceAfter - accountElevenBalanceBefore).to.be.eq(totalETHToSend * 1000n / FRACTION);


                    // after commissions will be the same
                    expect(accountEightBalanceAfter2 - accountEightBalanceAfter).to.be.eq(totalETHToSend * 1000n / FRACTION);
                    expect(accountNineBalanceAfter2 - accountNineBalanceAfter).to.be.eq(totalETHToSend * 2000n / FRACTION);
                    expect(accountElevenBalanceAfter2 - accountElevenBalanceAfter).to.be.eq(totalETHToSend * 1000n / FRACTION);


                });
            });
        });
        
        describe("continueSale", function () {
            
            it('available only for owner', async () => {
                const {
                    owner,
                    accountTwo,
                    timestamps,
                    prices,
                    amountRaisedEx,
                    priceSettings,
                    lastTime,
                    thresholdBonuses,
                    enumWithdrawOption,
                    dontUseWhitelist,
                    dontUseLockedInAmount,
                    CommonSettings,
                    SalesFactory
                } = await loadFixture(deploy);
                
                const tx = await SalesFactory.connect(owner).produce(
                    CommonSettings,
                    priceSettings,
                    thresholdBonuses,
                    enumWithdrawOption.never,
                    dontUseWhitelist,
                    dontUseLockedInAmount
                );

                const rc = await tx.wait(); // 0ms, as tx is already confirmed
                const event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
                const [instance,] = event.args;

                const SalesInstance = await ethers.getContractAt("Sales",instance);   
                
                await expect(
                    SalesInstance.connect(accountTwo).continueSale(timestamps,prices,amountRaisedEx,lastTime)
                ).to.be.revertedWith('Ownable: caller is not the owner');
            });

            it('available only with option EnumWithdrawOption.never', async () => {
                const {
                    owner,
                    timestamps,
                    prices,
                    amountRaisedEx,
                    priceSettings,
                    lastTime,
                    thresholdBonuses,
                    enumWithdrawOption,
                    dontUseWhitelist,
                    dontUseLockedInAmount,
                    CommonSettings,
                    SalesFactory
                } = await loadFixture(deploy);
                
                const tx = await SalesFactory.connect(owner).produce(
                    CommonSettings,
                    priceSettings,
                    thresholdBonuses,
                    enumWithdrawOption.anytime,
                    dontUseWhitelist,
                    dontUseLockedInAmount
                );

                const rc = await tx.wait(); // 0ms, as tx is already confirmed
                const event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
                const [instance,] = event.args;

                const SalesInstance = await ethers.getContractAt("Sales",instance);   
                
                await expect(
                    SalesInstance.connect(owner).continueSale(timestamps,prices,amountRaisedEx,lastTime)
                ).to.be.revertedWithCustomError(SalesInstance, 'NotSupported');
            });

            it('"lastTime" should be more that previous "lastTime"', async () => {

                const {
                    owner,
                    timestamps,
                    prices,
                    amountRaisedEx,
                    priceSettings,
                    lastTime,
                    thresholdBonuses,
                    enumWithdrawOption,
                    dontUseWhitelist,
                    dontUseLockedInAmount,
                    CommonSettings,
                    SalesFactory
                } = await loadFixture(deploy);
                
                const tx = await SalesFactory.connect(owner).produce(
                    CommonSettings,
                    priceSettings,
                    thresholdBonuses,
                    enumWithdrawOption.never,
                    dontUseWhitelist,
                    dontUseLockedInAmount
                );

                const rc = await tx.wait(); // 0ms, as tx is already confirmed
                const event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
                const [instance,] = event.args;

                const SalesInstance = await ethers.getContractAt("Sales",instance);   
                
                await expect(
                    SalesInstance.connect(owner).continueSale(timestamps,prices,amountRaisedEx,lastTime)
                ).to.be.revertedWithCustomError(SalesInstance, 'ExchangeTimeShouldBePassed');
            });

            it('"timestamp" should be more that previous "lastTime"', async () => {
                const {
                    owner,
                    timestamps,
                    prices,
                    amountRaisedEx,
                    priceSettings,
                    lastTime,
                    thresholdBonuses,
                    enumWithdrawOption,
                    dontUseWhitelist,
                    dontUseLockedInAmount,
                    CommonSettings,
                    SalesFactory
                } = await loadFixture(deploy);

                timestamps[1] = 0n;
                var editedCommonSettings = [...CommonSettings];
                editedCommonSettings[4] = lastTime+10n*24n*60n*60n;//lastTime+10n*24n*60n*60n,
                
                const tx = await SalesFactory.connect(owner).produce(
                    editedCommonSettings,
                    priceSettings,
                    thresholdBonuses,
                    enumWithdrawOption.never,
                    dontUseWhitelist,
                    dontUseLockedInAmount
                );

                const rc = await tx.wait(); // 0ms, as tx is already confirmed
                const event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
                const [instance,] = event.args;

                const SalesInstance = await ethers.getContractAt("Sales",instance);   
                
                await expect(
                    SalesInstance.connect(owner).continueSale(timestamps,prices,amountRaisedEx,lastTime+20n*24n*60n*60n)
                ).to.be.revertedWithCustomError(SalesInstance, 'InvalidInput');
            });

            it('shouldnt burn unsold token if ERC20 does not support "burn" method', async () => {
                const {
                    owner,
                    accountOne,
                    accountTwo,
                    priceSettings,
                    lastTime,
                    thresholdBonuses,
                    enumWithdrawOption,
                    dontUseWhitelist,
                    dontUseLockedInAmount,
                    CommonSettings,
                    ERC20MintableInstance,
                    SalesFactory
                } = await loadFixture(deploy);
                
                var editedCommonSettings = [...CommonSettings];
                editedCommonSettings[4] = lastTime+10n*24n*60n*60n;//lastTime+10n*24n*60n*60n,

                const tx = await SalesFactory.connect(owner).produce(
                    editedCommonSettings,
                    priceSettings,
                    thresholdBonuses,
                    enumWithdrawOption.never,
                    dontUseWhitelist,
                    dontUseLockedInAmount
                );

                const rc = await tx.wait(); // 0ms, as tx is already confirmed
                const event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
                const [instance,] = event.args;

                const SalesInstance = await ethers.getContractAt("Sales",instance);   

                await ERC20MintableInstance.connect(owner).mint(SalesInstance.target, 1000000n*1000000n*1000000n*ONE_ETH);
    
                await accountTwo.sendTransaction({
                    to: SalesInstance.target, 
                    value: amountETHSendToContract
                });
                    
                let tmp = await ethers.provider.send("eth_blockNumber",[]);
                tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
                let currentBlockTimeBeforeSend = BigInt(tmp.timestamp);
                
                // go to end time
                await ethers.provider.send('evm_increaseTime', [parseInt(lastTime+20n*timePeriod-currentBlockTimeBeforeSend)]);
                await ethers.provider.send('evm_mine');

                await expect(
                    SalesInstance.connect(accountOne).burnAllUnsoldTokens()
                ).to.be.revertedWithCustomError(SalesInstance, 'TransferError');
            });

            describe("test continueSale", function () {
                async function deployForTestContinueSale() {
                    const res = await loadFixture(deploy);
                    const {
                        owner,
                        accountTwo,
                        trustedForwarder,
                        prices,
                        priceSettings,
                        lastTime,
                        thresholdBonuses,
                        enumWithdrawOption,
                        dontUseWhitelist,
                        dontUseLockedInAmount,
                        CommonSettings,
                        SalesFactory
                    } = res;

                    var ERC20MintableBurnableF = await ethers.getContractFactory("ERC20MintableBurnable");    
                    const ERC20MintableBurnable = await ERC20MintableBurnableF.connect(owner).deploy('t1','t1');

                    var editedCommonSettings = [...CommonSettings];
                    editedCommonSettings[0] = ERC20MintableBurnable.target;
                    editedCommonSettings[4] = lastTime+10n*24n*60n*60n;//lastTime+10n*24n*60n*60n,

                    let tx = await SalesFactory.connect(owner).produce(
                        editedCommonSettings,
                        priceSettings,
                        thresholdBonuses,
                        enumWithdrawOption.never,
                        dontUseWhitelist,
                        dontUseLockedInAmount
                    );

                    const rc = await tx.wait(); // 0ms, as tx is already confirmed
                    const event = rc.logs.find(obj => obj.fragment && obj.fragment.name === 'InstanceCreated');
                    const [instance,] = event.args;

                    const SalesInstance = await ethers.getContractAt("Sales",instance);   

                    if (trustedForwardMode) {
                        await SalesInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
                    }

                    let tmp = await ethers.provider.send("eth_blockNumber",[]);
                    tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
                    const currentBlockTimeBeforeSend = BigInt(tmp.timestamp);

                    //var ratio_ETH_ITR = await SalesInstance.getTokenPrice();

                    await ERC20MintableBurnable.connect(owner).mint(SalesInstance.target , 1000000n*1000000n*1000000n*ONE_ETH);

                    //var accountTwoBalanceBefore = await ERC20MintableBurnable.balanceOf(accountTwo.address);
                    // send ETH to Contract
                    await accountTwo.sendTransaction({
                        to: SalesInstance.target, 
                        value: amountETHSendToContract
                    });

                    // var accountTwoBalanceActual = await ERC20MintableBurnable.balanceOf(accountTwo.address);
                    // var calculatedAmountOfTokens = amountETHSendToContract.mul(ethDenom).div(ratio_ETH_ITR);
                    // var accountTwoBalanceExpected = accountTwoBalanceBefore.add(calculatedAmountOfTokens);
                    
                    // go to end time
                    await ethers.provider.send('evm_increaseTime', [parseInt(lastTime-currentBlockTimeBeforeSend)]);
                    await ethers.provider.send('evm_mine');

                    await SalesInstance.connect(owner).continueSale(
                        [lastTime+5n*timePeriod],
                        [prices[prices.length-1]],
                        [1000000n*1000000n*1000000n*ONE_ETH],
                        lastTime+20n*timePeriod
                    );
                

                    return {...res, ...{
                        currentBlockTimeBeforeSend,
                        ERC20MintableBurnable,
                        SalesInstance
                    }};
                }

                it('any preson can call burnAllUnsoldTokens', async () => {
                    const {
                        accountOne,
                        lastTime,
                        currentBlockTimeBeforeSend,
                        ERC20MintableBurnable,
                        SalesInstance
                    } = await loadFixture(deployForTestContinueSale);

                    var balanceBefore = await ERC20MintableBurnable.balanceOf(SalesInstance.target);

                    await expect(
                        SalesInstance.connect(accountOne).burnAllUnsoldTokens()
                    ).to.be.revertedWithCustomError(SalesInstance, "ExchangeTimeShouldBePassed");

                    // go to end time
                    await ethers.provider.send('evm_increaseTime', [parseInt(lastTime+20n*timePeriod-currentBlockTimeBeforeSend)]);
                    await ethers.provider.send('evm_mine');

                    await SalesInstance.connect(accountOne).burnAllUnsoldTokens();
                    var balanceAfter = await ERC20MintableBurnable.balanceOf(SalesInstance.target);

                    expect(balanceBefore).not.to.be.eq(ZERO);
                    expect(balanceAfter).to.be.eq(ZERO);
                });

                it('still can buy', async () => {
                    const {
                        accountThree,
                        ERC20MintableBurnable,
                        SalesInstance
                    } = await loadFixture(deployForTestContinueSale);

                    var balanceBefore = await ERC20MintableBurnable.balanceOf(accountThree.address);
                    // send ETH to Contract
                    await accountThree.sendTransaction({
                        to: SalesInstance.target, 
                        value: amountETHSendToContract
                    });
                    var balanceAfter = await ERC20MintableBurnable.balanceOf(accountThree.address);

                    expect(balanceBefore).to.be.eq(ZERO);
                    expect(balanceAfter).not.to.be.eq(ZERO);
                });

            });
        });
    });

    }

    describe("DistributeLiquidity", function(){

        // series test from adding eth to DistributeLiquidity and calling addLiquidity method
        it('test', async () => {

            const {
                owner,
                accountFive,
                // timestamps,
                // prices,
                // amountRaisedEx,
                priceSettings,
                //-----
                lastTime,
                // thresholds,
                // bonuses,
                thresholdBonuses,
                //---
                enumWithdrawOption,
                dontUseWhitelist,
                SalesFactory,
                ERC20MintableF,
                ERC20MintableInstance
                
            } = await deploy();

            var liquidityLib,
            token0,
            token1, 
            uniswapRouterFactoryInstance,
            uniswapRouterInstance,
            wrappedNativeTokenAsWETH,
            wrappedNativeTokenAsERC20,
            tmp
        ;
        
            //polygon/mumbai lib
            //0x1eA4C4613a4DfdAEEB95A261d11520c90D5d6252
            var libData = await ethers.getContractFactory("@intercoin/liquidity/contracts/LiquidityLib.sol:LiquidityLib");    
            liquidityLib = await libData.deploy();
            await liquidityLib.waitForDeployment();

            token0 = await ERC20MintableF.deploy("token0", "token0");
            token1 = await ERC20MintableF.deploy("token1", "token1");
            await token0.waitForDeployment();
            await token1.waitForDeployment();
            
            tmp = await liquidityLib.uniswapSettings();
            const UNISWAP_ROUTER = tmp[0];
            const UNISWAP_ROUTER_FACTORY_ADDRESS = tmp[1];
            uniswapRouterFactoryInstance = await ethers.getContractAt("@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol:IUniswapV2Factory",UNISWAP_ROUTER_FACTORY_ADDRESS);
            uniswapRouterInstance = await ethers.getContractAt("@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol:IUniswapV2Router02", UNISWAP_ROUTER);

            let weth = await uniswapRouterInstance.WETH();
            wrappedNativeTokenAsWETH = await ethers.getContractAt("@uniswap/v2-periphery/contracts/interfaces/IWETH.sol:IWETH", weth);
            wrappedNativeTokenAsERC20 = await ethers.getContractAt("ERC20Mintable", weth);
            
            //await uniswapRouterFactoryInstance.createPair(token0.address, weth);
            await uniswapRouterFactoryInstance.createPair(token1.target, weth);
            await uniswapRouterFactoryInstance.createPair(token0.target, token1.target);

            const ts = await time.latest();
            const timeUntil = parseInt(ts)*2;
            const amountToAddLiquidity = 1000n * ONE_ETH;

            await wrappedNativeTokenAsWETH.connect(accountFive).deposit({
                value: amountToAddLiquidity * FIVE // make more WETH
            });

            //token0/wrappedNativeToken
            await token0.mint(accountFive.address, amountToAddLiquidity);
            await token0.connect(accountFive).approve(uniswapRouterInstance.target, amountToAddLiquidity);
            
            //await wrappedNativeToken.mint(accountFive.address, amountToAddLiquidity);
            await wrappedNativeTokenAsERC20.connect(accountFive).approve(uniswapRouterInstance.target, amountToAddLiquidity);
            await uniswapRouterInstance.connect(accountFive).addLiquidity(token0.target, weth, amountToAddLiquidity, amountToAddLiquidity, 0, 0, accountFive.address, timeUntil);

            //token0/token1
            await token0.mint(accountFive.address, amountToAddLiquidity);
            await token0.connect(accountFive).approve(uniswapRouterInstance.target, amountToAddLiquidity);
            await token1.mint(accountFive.address, amountToAddLiquidity);
            await token1.connect(accountFive).approve(uniswapRouterInstance.target, amountToAddLiquidity);
            await uniswapRouterInstance.connect(accountFive).addLiquidity(token0.target, token1.target, amountToAddLiquidity, amountToAddLiquidity, 0, 0, accountFive.address, timeUntil);

            //token1/wrappedNativeToken
            await token1.mint(accountFive.address, amountToAddLiquidity);
            await token1.connect(accountFive).approve(uniswapRouterInstance.target, amountToAddLiquidity);
            //await wrappedNativeToken.mint(accountFive.address, amountToAddLiquidity);
            await wrappedNativeTokenAsERC20.connect(accountFive).approve(uniswapRouterInstance.target, amountToAddLiquidity);
            await uniswapRouterInstance.connect(accountFive).addLiquidity(token1.target, weth, amountToAddLiquidity, amountToAddLiquidity, 0, 0, accountFive.address, timeUntil);


            const MockDistributeLiquidityF = await ethers.getContractFactory("MockDistributeLiquidity");
            
            const MockDistributeLiquidity = await MockDistributeLiquidityF.deploy(
                token0.target, // token0
                token1.target, // token1  
                liquidityLib.target, // liquidityLib
                {
                    gasLimit: 2000000
                }
            );
        
            const amount = ONE_ETH;
            var balanceBefore = (await ethers.provider.getBalance(MockDistributeLiquidity.target));
            await owner.sendTransaction({
                to: MockDistributeLiquidity.target,
                value: amount
            });

            var balanceAfter = (await ethers.provider.getBalance(MockDistributeLiquidity.target));

            await MockDistributeLiquidity.addLiquidity();
            var balanceAfterAddLiquidity = (await ethers.provider.getBalance(MockDistributeLiquidity.target));

            expect(balanceBefore).to.be.eq(ZERO);
            expect(balanceAfter).to.be.eq(amount);
            expect(balanceAfterAddLiquidity).to.be.eq(ZERO);

            expect(await token0.balanceOf(MockDistributeLiquidity.target)).to.be.eq(ZERO);
            expect(await token1.balanceOf(MockDistributeLiquidity.target)).to.be.lt(HUNDRED); // presicion. tokens left can be accommulated on each addLiqauidity
            expect(await wrappedNativeTokenAsERC20.balanceOf(MockDistributeLiquidity.target)).to.be.eq(ZERO);

            //try the same  and watch or price

            var pairAddress = await uniswapRouterFactoryInstance.getPair(token0.target, token1.target);
            var pair = await ethers.getContractAt("@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol:IUniswapV2Pair", pairAddress);

            var before = {
                reserve0: 0,
                reserve1: 0,
            };
            var after = {
                reserve0: 0,
                reserve1: 0,
            };
            var pairToken0 = await pair.token0();
            var token01bool = false;
            if (pairToken0 == token0.target) {
                token01bool = true;
            } else {
                token01bool = false;
            }
            if (token01bool) {
                [before.reserve0, before.reserve1] = await pair.getReserves();
            } else {
                [before.reserve1, before.reserve0] = await pair.getReserves();
            }

            await owner.sendTransaction({
                to: MockDistributeLiquidity.target,
                value: amount
            });
            await MockDistributeLiquidity.addLiquidity();

            if (token01bool) {
                [after.reserve0, after.reserve1] = await pair.getReserves();
            } else {
                [after.reserve1, after.reserve0] = await pair.getReserves();

            }
            
            expect(before.reserve0).to.be.eq(after.reserve0);
            expect(before.reserve1).to.be.lt(after.reserve1);

        });

    });

});
