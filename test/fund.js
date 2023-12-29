const { ethers, waffle } = require('hardhat');
const { BigNumber } = require('ethers');
const { expect } = require('chai');
const chai = require('chai');
const { time } = require('@openzeppelin/test-helpers');
const mixedCall = require('../js/mixedCall.js');

const ZERO = BigNumber.from('0');
const ONE = BigNumber.from('1');
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

//const TOTALSUPPLY = ethers.utils.parseEther('1000000000');    
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const NO_COSTMANAGER = ZERO_ADDRESS;


const FRACTION = 10000;

const EnumWithdrawOption = {
    never: 0,
    afterEndTime: 1,
    anytime: 2
}

const DontUseWhitelist = [
    ZERO_ADDRESS, // 
    "0x00000000", // bytes4
    0, 
    false // use whitelist
];

describe("Fund", function () {
    const accounts = waffle.provider.getWallets();
    
    // Setup accounts.
    const owner = accounts[0];                     
    const accountOne = accounts[1];  
    const accountTwo = accounts[2];
    const accountThree= accounts[3];
    const accountFourth = accounts[4];
    const accountFive = accounts[5];
    const accountSix = accounts[6];
    const accountSeven = accounts[7];
    const accountEight = accounts[8];
    const accountNine = accounts[9];
    const accountEleven = accounts[11];
    const trustedForwarder = accounts[12];
    
    // setup useful vars
    var FundContractMockF;
    var FundContractTokenF;
    var FundContractAggregatorF;
    var AggregatorF;
    var ERC20MintableF;
    var FundFactoryF
    
    var FundFactory;

    var ReleaseManagerFactoryF;
    var ReleaseManagerF;

    // var ControlContractFactory;
    // var ControlContract;
    // var CommunityMock;
    
    // predefined init params
    var timestamps;
    var prices;
    var lastTime;
    const thresholds = [// count in eth (10/25/50)
        TEN.mul(ONE_ETH), 
        FIVE.mul(FIVE).mul(ONE_ETH), 
        FIVE.mul(TEN).mul(ONE_ETH)
    ];

    
    const amountRaisedEx = [
        0, 
        MILLION.mul(ONE_ETH), 
        TWO.mul(MILLION).mul(ONE_ETH), 

    ];
    const bonuses = [TEN, TEN.mul(TWO), TEN.mul(FIVE)];  //[10, 20, 50]; // [0.1, 0.2, 0.5] mul by 100
    const ethDenom = HUNDRED.mul(MILLION); //BigNumber(1_00000000);
      
    const amountETHSendToContract = TEN.mul(ONE_ETH); // 10ETH
    const amountTokenSendToContract = TEN.mul(ONE_ETH); // 10token

    var blockTime;
    beforeEach("deploying", async() => {

        // make snapshot before time manipulations
        snapId = await ethers.provider.send('evm_snapshot', []);

        // predefined init params
        let tmp;
        tmp = await ethers.provider.send("eth_blockNumber",[]);
        
        tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
        
        blockTime = parseInt(tmp.timestamp);
        let timePeriod = 60*24*60*60;
        timestamps = [blockTime+(2*timePeriod), blockTime+(4*timePeriod), blockTime+(6*timePeriod)];
        prices = [100000, 150000, 180000]; // (0.0010/0.0015/0.0018)  mul by 1e8. 0.001 means that for 1 eth got 1000 tokens    //_00000000
        lastTime = parseInt(blockTime)+(8*timePeriod);

        FundContractMockF = await ethers.getContractFactory("FundContractMock");    
        FundContractTokenF = await ethers.getContractFactory("FundContractTokenMock");
        FundContractAggregatorF = await ethers.getContractFactory("FundContractAggregator");

        ERC20MintableF = await ethers.getContractFactory("ERC20Mintable");
        
        AggregatorF = await ethers.getContractFactory("Aggregator");    

        FundFactoryF = await ethers.getContractFactory("FundFactory");

        ReleaseManagerFactoryF= await ethers.getContractFactory("MockReleaseManagerFactory")
        ReleaseManagerF = await ethers.getContractFactory("MockReleaseManager");
        let implementationReleaseManager    = await ReleaseManagerF.deploy();
        let releaseManagerFactory   = await ReleaseManagerFactoryF.connect(owner).deploy(implementationReleaseManager.address);
        let tx,rc,event,instance,instancesCount;
        //
        tx = await releaseManagerFactory.connect(owner).produce();
        rc = await tx.wait(); // 0ms, as tx is already confirmed
        event = rc.events.find(event => event.event === 'InstanceProduced');
        [instance, instancesCount] = event.args;
        let releaseManager = await ethers.getContractAt("MockReleaseManager",instance);

        let fundContractInstance = await FundContractMockF.deploy();
        let fundContractTokenInstance = await FundContractTokenF.deploy();
        let fundContractAggregatorInstance = await FundContractAggregatorF.deploy();

        FundFactory = await FundFactoryF.connect(owner).deploy(
            fundContractInstance.address,
            fundContractTokenInstance.address,
            fundContractAggregatorInstance.address,
            NO_COSTMANAGER,
            releaseManager.address
        );

        // 
        const factoriesList = [FundFactory.address];
        const factoryInfo = [
            [
                1,//uint8 factoryIndex; 
                1,//uint16 releaseTag; 
                "0x53696c766572000000000000000000000000000000000000"//bytes24 factoryChangeNotes;
            ]
        ]

        await releaseManager.connect(owner).newRelease(factoriesList, factoryInfo);


    });
    
    afterEach("deploying", async() => { 
        // restore snapshot
        await ethers.provider.send('evm_revert', [snapId]);
        //console.log(`afterEach("deploying"`);
    });

    
    describe("TrustedForwarder", function () {
        var FundContractTokenInstance;
        beforeEach("deploying", async() => {
            var ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');
            var Token2PayInstance = await ERC20MintableF.connect(owner).deploy('token2','token2');
            
            let tx = await FundFactory.connect(owner).produceToken(
                Token2PayInstance.address,
                ERC20MintableInstance.address,
                timestamps,
                prices,
                amountRaisedEx,
                lastTime,
                thresholds,
                bonuses,
                EnumWithdrawOption.anytime,
                DontUseWhitelist
            );

            const rc = await tx.wait(); // 0ms, as tx is already confirmed
            const event = rc.events.find(event => event.event === 'InstanceCreated');
            const [instance,] = event.args;

            FundContractTokenInstance = await ethers.getContractAt("FundContractToken",instance);   
        })
        it("should be empty after init", async() => {
            expect(await FundContractTokenInstance.connect(accountOne).isTrustedForwarder(ZERO_ADDRESS)).to.be.true;
        });

        it("should be setup by owner", async() => {
            await expect(FundContractTokenInstance.connect(accountOne).setTrustedForwarder(accountTwo.address)).to.be.revertedWith("Ownable: caller is not the owner");
            expect(await FundContractTokenInstance.connect(accountOne).isTrustedForwarder(ZERO_ADDRESS)).to.be.true;
            await FundContractTokenInstance.connect(owner).setTrustedForwarder(accountTwo.address);
            expect(await FundContractTokenInstance.connect(accountOne).isTrustedForwarder(accountTwo.address)).to.be.true;
        });
        
        it("should drop trusted forward if trusted forward become owner ", async() => {
            await FundContractTokenInstance.connect(owner).setTrustedForwarder(accountTwo.address);
            expect(await FundContractTokenInstance.connect(accountOne).isTrustedForwarder(accountTwo.address)).to.be.true;
            await FundContractTokenInstance.connect(owner).transferOwnership(accountTwo.address);
            expect(await FundContractTokenInstance.connect(accountOne).isTrustedForwarder(ZERO_ADDRESS)).to.be.true;
        });

        it("shouldnt become owner and trusted forwarder", async() => {
            await expect(FundContractTokenInstance.connect(owner).setTrustedForwarder(owner.address)).to.be.revertedWith(`ForwarderCanNotBeOwner`);
        });

        it("shouldnt withdraw by owner if setup option `_ownerCanWithdraw` eq `never` ", async() => {

            var ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');

            let txFee;
            let tx = await FundFactory.connect(owner).produce(
                ERC20MintableInstance.address,
                timestamps,
                prices,
                amountRaisedEx,
                lastTime,
                thresholds,
                bonuses,
                EnumWithdrawOption.never, 
                DontUseWhitelist
            );

            let rc = await tx.wait(); // 0ms, as tx is already confirmed
            let event = rc.events.find(event => event.event === 'InstanceCreated');
            let [instance,] = event.args;

            var FundContractInstance = await ethers.getContractAt("FundContract",instance);   

            let tmp = await ethers.provider.send("eth_blockNumber",[]);
            tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
            let currentBlockTime = parseInt(tmp.timestamp);

            // send ETH to Contract, but it should be revert with message "Amount exceeds allowed balance"
            const amountSellingTokensSendToContract = MILLION.mul(ONE_ETH);
            await ERC20MintableInstance.connect(owner).mint(FundContractInstance.address,amountSellingTokensSendToContract);

            //
            await expect(
                FundContractInstance.connect(owner).withdraw(amountSellingTokensSendToContract, accountFive.address)
            ).to.be.revertedWith("WithdrawDisabled");
            
            // go to end time
            await ethers.provider.send('evm_increaseTime', [parseInt(lastTime-currentBlockTime)]);
            await ethers.provider.send('evm_mine');

            await expect(
                FundContractInstance.connect(owner).withdraw(amountSellingTokensSendToContract, accountFive.address)
            ).to.be.revertedWith("WithdrawDisabled");


        });

        it("should withdraw by owner after endTime is passed if setup option `_ownerCanWithdraw` eq `afterEndTime` ", async() => {

            var ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');

            let txFee;
            let tx = await FundFactory.connect(owner).produce(
                ERC20MintableInstance.address,
                timestamps,
                prices,
                amountRaisedEx,
                lastTime,
                thresholds,
                bonuses,
                EnumWithdrawOption.afterEndTime, 
                DontUseWhitelist
            );

            let rc = await tx.wait(); // 0ms, as tx is already confirmed
            let event = rc.events.find(event => event.event === 'InstanceCreated');
            let [instance,] = event.args;

            var FundContractInstance = await ethers.getContractAt("FundContract",instance);   

            let tmp = await ethers.provider.send("eth_blockNumber",[]);
            tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
            let currentBlockTime = parseInt(tmp.timestamp);

            const amountSellingTokensSendToContract = MILLION.mul(ONE_ETH);
            await ERC20MintableInstance.connect(owner).mint(FundContractInstance.address, amountSellingTokensSendToContract);

            //
            await expect(
                FundContractInstance.connect(owner).withdraw(amountSellingTokensSendToContract, accountFive.address)
            ).to.be.revertedWith("WithdrawDisabled");
            
            // go to end time
            await ethers.provider.send('evm_increaseTime', [parseInt(lastTime-currentBlockTime)]);
            await ethers.provider.send('evm_mine');

            let sellingTokensBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive.address);

            await FundContractInstance.connect(owner).withdraw(amountSellingTokensSendToContract, accountFive.address);
            let sellingTokensBalanceAfter = await ERC20MintableInstance.balanceOf(accountFive.address);

            expect(sellingTokensBalanceAfter.sub(sellingTokensBalanceBefore)).to.be.eq(amountSellingTokensSendToContract);



        });

        it("should withdraw by owner anytime if setup option `_ownerCanWithdraw` eq `anytime` ", async() => {
            var ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');

            let txFee;
            let tx = await FundFactory.connect(owner).produce(
                ERC20MintableInstance.address,
                timestamps,
                prices,
                amountRaisedEx,
                lastTime,
                thresholds,
                bonuses,
                EnumWithdrawOption.anytime,
                DontUseWhitelist
            );

            let rc = await tx.wait(); // 0ms, as tx is already confirmed
            let event = rc.events.find(event => event.event === 'InstanceCreated');
            let [instance,] = event.args;

            var FundContractInstance = await ethers.getContractAt("FundContract",instance);   

            let tmp = await ethers.provider.send("eth_blockNumber",[]);
            tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
            let currentBlockTime = parseInt(tmp.timestamp);

            const amountSellingTokensSendToContract = MILLION.mul(ONE_ETH);
            await ERC20MintableInstance.connect(owner).mint(FundContractInstance.address, amountSellingTokensSendToContract);


            let sellingTokensBalanceBefore,sellingTokensBalanceAfter,tmpSnapId;

            // make snapshot before time manipulations
            tmpSnapId = await ethers.provider.send('evm_snapshot', []);  
            sellingTokensBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive.address);
            await FundContractInstance.connect(owner).withdraw(amountSellingTokensSendToContract, accountFive.address);
            sellingTokensBalanceAfter = await ERC20MintableInstance.balanceOf(accountFive.address);
            expect(sellingTokensBalanceAfter.sub(sellingTokensBalanceBefore)).to.be.eq(amountSellingTokensSendToContract);
            // restore snapshot
            await ethers.provider.send('evm_revert', [tmpSnapId]);

            // or go to end time
            await ethers.provider.send('evm_increaseTime', [parseInt(lastTime-currentBlockTime)]);
            await ethers.provider.send('evm_mine');

            // make snapshot before time manipulations
            tmpSnapId = await ethers.provider.send('evm_snapshot', []);  
            sellingTokensBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive.address);
            await FundContractInstance.connect(owner).withdraw(amountSellingTokensSendToContract, accountFive.address);
            sellingTokensBalanceAfter = await ERC20MintableInstance.balanceOf(accountFive.address);
            expect(sellingTokensBalanceAfter.sub(sellingTokensBalanceBefore)).to.be.eq(amountSellingTokensSendToContract);
            // restore snapshot
            await ethers.provider.send('evm_revert', [tmpSnapId]);

        });
    });

    for (const trustedForwardMode of [false,trustedForwarder]) {

    describe(`${trustedForwardMode ? '[with trusted forwarder]' : ''} tests`, function () {  
         

        it('common test(token)', async () => {

            var ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');
            var Token2PayInstance = await ERC20MintableF.connect(owner).deploy('token2','token2');
            
            let tx = await FundFactory.connect(owner).produceToken(
                Token2PayInstance.address,
                ERC20MintableInstance.address,
                timestamps,
                prices,
                amountRaisedEx,
                lastTime,
                thresholds,
                bonuses,
                EnumWithdrawOption.anytime,
                DontUseWhitelist
            );

            const rc = await tx.wait(); // 0ms, as tx is already confirmed
            const event = rc.events.find(event => event.event === 'InstanceCreated');
            const [instance,] = event.args;

            FundContractTokenInstance = await ethers.getContractAt("FundContractTokenMock",instance);   

            if (trustedForwardMode) {
                await FundContractTokenInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
            }

            // send ETH to Contract
            await expect(accountTwo.sendTransaction({
                to: FundContractTokenInstance.address, 
                value: ONE_ETH,
                gasLimit: 150000
            })
            ).to.be.revertedWith(`NotSupported`);

            await Token2PayInstance.connect(owner).mint(accountTwo.address, amountTokenSendToContract);
            var ratio_TOKEN2_ITR = await FundContractTokenInstance.connect(owner).getTokenPrice();

            // send t2 to Contract, but it should be revert with message "Amount exceeds allowed balance"
            await mixedCall(FundContractTokenInstance, trustedForwardMode, accountTwo, 'buy(uint256)', [amountTokenSendToContract], "ERC20: insufficient allowance");
            
            await ERC20MintableInstance.connect(owner).mint(FundContractTokenInstance.address, MILLION.mul(ONE_ETH));

            var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);
            // set approve before
            await Token2PayInstance.connect(accountTwo).approve(FundContractTokenInstance.address, amountTokenSendToContract);
            // send Token2 to Contract 
            await mixedCall(FundContractTokenInstance, trustedForwardMode, accountTwo, 'buy(uint256)', [amountTokenSendToContract]);

            var accountTwoBalanceActual = await ERC20MintableInstance.balanceOf(accountTwo.address);
            var calculatedAmountOfTokens = amountTokenSendToContract.mul(ethDenom).div(ratio_TOKEN2_ITR);
            var accountTwoBalanceExpected = accountTwoBalanceBefore.add(calculatedAmountOfTokens);

            expect(accountTwoBalanceActual).to.be.eq(accountTwoBalanceExpected);

            let tmp;
            tmp = await ethers.provider.send("eth_blockNumber",[]);
            tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
            currentBlockTime = parseInt(tmp.timestamp);

            // go to end time
            await ethers.provider.send('evm_increaseTime', [parseInt(lastTime-currentBlockTime)]);
            await ethers.provider.send('evm_mine');

            

            let tmpSnapId;
            //---------------------------------
            // Make claim to accountFourth

            // make snapshot before time manipulations
            tmpSnapId = await ethers.provider.send('evm_snapshot', []);  

            var accountFourthBalanceBefore = await Token2PayInstance.balanceOf(accountFourth.address);
            await mixedCall(FundContractTokenInstance, trustedForwardMode, owner, 'claim(uint256,address)', [amountETHSendToContract, accountFourth.address]);
            var accountFourthBalanceAfter = await Token2PayInstance.balanceOf(accountFourth.address);
            expect(accountFourthBalanceAfter.sub(accountFourthBalanceBefore)).to.be.eq(amountETHSendToContract);

            // restore snapshot
            await ethers.provider.send('evm_revert', [tmpSnapId]);
            //---------------------------------end
            //---------------------------------
            // Make claimAll

            // make snapshot before time manipulations
            tmpSnapId = await ethers.provider.send('evm_snapshot', []);  

            var accountOwnerBalanceBefore = await Token2PayInstance.balanceOf(owner.address);
            let amountETHHoldOnContract = await FundContractTokenInstance.getHoldedAmount();
            await mixedCall(FundContractTokenInstance, trustedForwardMode, owner, 'claimAll', []);
            var accountOwnerBalanceAfter = await Token2PayInstance.balanceOf(owner.address);
            expect(accountOwnerBalanceAfter.sub(accountOwnerBalanceBefore)).to.be.eq(amountETHHoldOnContract);

            // restore snapshot
            await ethers.provider.send('evm_revert', [tmpSnapId]);
            //---------------------------------end

            var accountFiveBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive.address);
            await mixedCall(FundContractTokenInstance, trustedForwardMode, owner, 'withdraw(uint256,address)', [calculatedAmountOfTokens, accountFive.address]);
            var accountFiveBalanceActual = await ERC20MintableInstance.balanceOf(accountFive.address);
            var accountFiveBalanceExpected = accountFiveBalanceBefore.add(calculatedAmountOfTokens);

            expect(accountFiveBalanceActual).to.be.eq(accountFiveBalanceExpected);

        });
    
        it('common test(eth)', async () => {

            var ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');

            let txFee;
            let tx = await FundFactory.connect(owner).produce(
                ERC20MintableInstance.address,
                timestamps,
                prices,
                amountRaisedEx,
                lastTime,
                thresholds,
                bonuses,
                EnumWithdrawOption.anytime,
                DontUseWhitelist
            );

            let rc = await tx.wait(); // 0ms, as tx is already confirmed
            let event = rc.events.find(event => event.event === 'InstanceCreated');
            let [instance,] = event.args;

            var FundContractInstance = await ethers.getContractAt("FundContract",instance);   

            if (trustedForwardMode) {
                await FundContractInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
            }

            let tmp = await ethers.provider.send("eth_blockNumber",[]);
            tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
            let currentBlockTime = parseInt(tmp.timestamp);

            var ratio_ETH_ITR = await FundContractInstance.getTokenPrice();
        
            // send ETH to Contract, but it should be revert with message "Amount exceeds allowed balance"
            await expect(
                accountTwo.sendTransaction({
                    to: FundContractInstance.address, 
                    value: amountETHSendToContract
                })
            ).to.be.revertedWith("Amount exceeds allowed balance");
            
            await ERC20MintableInstance.connect(owner).mint(FundContractInstance.address, MILLION.mul(ONE_ETH));

            var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);
            // send ETH to Contract
            await accountTwo.sendTransaction({
                to: FundContractInstance.address, 
                value: amountETHSendToContract,
                gasLimit: 180000
            });

            var accountTwoBalanceActual = await ERC20MintableInstance.balanceOf(accountTwo.address);
            var calculatedAmountOfTokens = amountETHSendToContract.mul(ethDenom).div(ratio_ETH_ITR);
            var accountTwoBalanceExpected = accountTwoBalanceBefore.add(calculatedAmountOfTokens);

            expect(accountTwoBalanceActual).to.be.eq(accountTwoBalanceExpected);
            
            // go to end time
            await ethers.provider.send('evm_increaseTime', [parseInt(lastTime-currentBlockTime)]);
            await ethers.provider.send('evm_mine');
            /*          

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
            await mixedCall(FundContractTokenInstance, trustedForwardMode, owner, 'claim(uint256,address)', [amountETHSendToContract, accountFourth.address]);
            var accountFourthBalanceAfter = (await ethers.provider.getBalance(accountFourth.address));
            expect(accountFourthBalanceAfter.sub(accountFourthBalanceBefore)).to.be.eq(amountETHSendToContract);
            
            // restore snapshot
            await ethers.provider.send('evm_revert', [tmpSnapId]);
            //---------------------------------end
            //---------------------------------
            // Make claimAll

            var accountOwnerBalanceBefore = (await ethers.provider.getBalance(owner.address));
            let amountETHHoldOnContract = await FundContractTokenInstance.getHoldedAmount();
            tx = await mixedCall(FundContractTokenInstance, trustedForwardMode, owner, 'claimAll', []);
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
            await mixedCall(FundContractTokenInstance, trustedForwardMode, owner, 'withdraw(uint256,address)', [calculatedAmountOfTokens, accountFive.address]);
            var accountFiveBalanceActual = await ERC20MintableInstance.balanceOf(accountFive.address);
            var accountFiveBalanceExpected = accountFiveBalanceBefore.add(calculatedAmountOfTokens);

            expect(accountFiveBalanceActual).to.be.eq(accountFiveBalanceExpected);

            // restore snapshot
            await ethers.provider.send('evm_revert', [tmpSnapId]);
            */
        });
    
    
        it('common test(token) with Whitelist', async () => {
            let MockWhitelistF = await ethers.getContractFactory("MockWhitelist");    
            let MockWhitelist = await MockWhitelistF.deploy();
            await MockWhitelist.setupSuccess(true);
            const UseExternalWhitelist = [
                MockWhitelist.address,
                "0x00000000",
                55,
                true
            ];

            var ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');
            var Token2PayInstance = await ERC20MintableF.connect(owner).deploy('token2','token2');
            
            let tx = await FundFactory.connect(owner).produceToken(
                Token2PayInstance.address,
                ERC20MintableInstance.address,
                timestamps,
                prices,
                amountRaisedEx,
                lastTime,
                thresholds,
                bonuses,
                EnumWithdrawOption.anytime,
                UseExternalWhitelist
            );

            const rc = await tx.wait(); // 0ms, as tx is already confirmed
            const event = rc.events.find(event => event.event === 'InstanceCreated');
            const [instance,] = event.args;

            FundContractTokenInstance = await ethers.getContractAt("FundContractTokenMock",instance);   

            if (trustedForwardMode) {
                await FundContractTokenInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
            }

            // send ETH to Contract
            await expect(accountTwo.sendTransaction({
                to: FundContractTokenInstance.address, 
                value: ONE_ETH,
                gasLimit: 150000
            })
            ).to.be.revertedWith(`NotSupported`);

            await Token2PayInstance.connect(owner).mint(accountTwo.address, amountTokenSendToContract);
            var ratio_TOKEN2_ITR = await FundContractTokenInstance.connect(owner).getTokenPrice();

            // send t2 to Contract, but it should be revert with message "Amount exceeds allowed balance"
            await mixedCall(FundContractTokenInstance, trustedForwardMode, accountTwo, 'buy(uint256)', [amountTokenSendToContract], "ERC20: insufficient allowance");
            
            await ERC20MintableInstance.connect(owner).mint(FundContractTokenInstance.address, MILLION.mul(ONE_ETH));

            var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);
            // set approve before
            await Token2PayInstance.connect(accountTwo).approve(FundContractTokenInstance.address, amountTokenSendToContract);
            // send Token2 to Contract 
            await mixedCall(FundContractTokenInstance, trustedForwardMode, accountTwo, 'buy(uint256)', [amountTokenSendToContract]);

            var accountTwoBalanceActual = await ERC20MintableInstance.balanceOf(accountTwo.address);
            var calculatedAmountOfTokens = amountTokenSendToContract.mul(ethDenom).div(ratio_TOKEN2_ITR);
            var accountTwoBalanceExpected = accountTwoBalanceBefore.add(calculatedAmountOfTokens);

            expect(accountTwoBalanceActual).to.be.eq(accountTwoBalanceExpected);

            let tmp;
            tmp = await ethers.provider.send("eth_blockNumber",[]);
            tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
            currentBlockTime = parseInt(tmp.timestamp);

            // go to end time
            await ethers.provider.send('evm_increaseTime', [parseInt(lastTime-currentBlockTime)]);
            await ethers.provider.send('evm_mine');

            

            let tmpSnapId;
            //---------------------------------
            // Make claim to accountFourth

            // make snapshot before time manipulations
            tmpSnapId = await ethers.provider.send('evm_snapshot', []);  

            var accountFourthBalanceBefore = await Token2PayInstance.balanceOf(accountFourth.address);
            await mixedCall(FundContractTokenInstance, trustedForwardMode, owner, 'claim(uint256,address)', [amountETHSendToContract, accountFourth.address]);
            var accountFourthBalanceAfter = await Token2PayInstance.balanceOf(accountFourth.address);
            expect(accountFourthBalanceAfter.sub(accountFourthBalanceBefore)).to.be.eq(amountETHSendToContract);

            // restore snapshot
            await ethers.provider.send('evm_revert', [tmpSnapId]);
            //---------------------------------end
            //---------------------------------
            // Make claimAll

            // make snapshot before time manipulations
            tmpSnapId = await ethers.provider.send('evm_snapshot', []);  

            var accountOwnerBalanceBefore = await Token2PayInstance.balanceOf(owner.address);
            let amountETHHoldOnContract = await FundContractTokenInstance.getHoldedAmount();
            await mixedCall(FundContractTokenInstance, trustedForwardMode, owner, 'claimAll', []);
            var accountOwnerBalanceAfter = await Token2PayInstance.balanceOf(owner.address);
            expect(accountOwnerBalanceAfter.sub(accountOwnerBalanceBefore)).to.be.eq(amountETHHoldOnContract);

            // restore snapshot
            await ethers.provider.send('evm_revert', [tmpSnapId]);
            //---------------------------------end

            var accountFiveBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive.address);
            await mixedCall(FundContractTokenInstance, trustedForwardMode, owner, 'withdraw(uint256,address)', [calculatedAmountOfTokens, accountFive.address]);
            var accountFiveBalanceActual = await ERC20MintableInstance.balanceOf(accountFive.address);
            var accountFiveBalanceExpected = accountFiveBalanceBefore.add(calculatedAmountOfTokens);

            expect(accountFiveBalanceActual).to.be.eq(accountFiveBalanceExpected);

        });

        it('common test(token) with Bad Whitelist contract', async () => {
            let MockWhitelistF = await ethers.getContractFactory("MockWhitelist");    
            let MockWhitelist = await MockWhitelistF.deploy();
            const UseExternalWhitelist = [
                MockWhitelist.address,
                "0x00000000",
                55,
                true
            ];

            var ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');
            var Token2PayInstance = await ERC20MintableF.connect(owner).deploy('token2','token2');
            
            let tx = await FundFactory.connect(owner).produceToken(
                Token2PayInstance.address,
                ERC20MintableInstance.address,
                timestamps,
                prices,
                amountRaisedEx,
                lastTime,
                thresholds,
                bonuses,
                EnumWithdrawOption.anytime,
                UseExternalWhitelist
            );

            const rc = await tx.wait(); // 0ms, as tx is already confirmed
            const event = rc.events.find(event => event.event === 'InstanceCreated');
            const [instance,] = event.args;

            FundContractTokenInstance = await ethers.getContractAt("FundContractTokenMock",instance);   

            if (trustedForwardMode) {
                await FundContractTokenInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
            }

            // send ETH to Contract
            await expect(accountTwo.sendTransaction({
                to: FundContractTokenInstance.address, 
                value: ONE_ETH,
                gasLimit: 150000
            })
            ).to.be.revertedWith(`NotSupported`);

            await Token2PayInstance.connect(owner).mint(accountTwo.address, amountTokenSendToContract);
            var ratio_TOKEN2_ITR = await FundContractTokenInstance.connect(owner).getTokenPrice();

            // send t2 to Contract, but it should be revert with message "Amount exceeds allowed balance"
            await mixedCall(FundContractTokenInstance, trustedForwardMode, accountTwo, 'buy(uint256)', [amountTokenSendToContract], "ERC20: insufficient allowance");
            
            await ERC20MintableInstance.connect(owner).mint(FundContractTokenInstance.address, MILLION.mul(ONE_ETH));

            var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);
            // set approve before
            await Token2PayInstance.connect(accountTwo).approve(FundContractTokenInstance.address, amountTokenSendToContract);
            // send Token2 to Contract 
            await mixedCall(FundContractTokenInstance, trustedForwardMode, accountTwo, 'buy(uint256)', [amountTokenSendToContract], "WhitelistError");

        });
    
        it('test tokenPrice', async () => {
            var amountRaisedCustom = [0, 100, 500];
            // Example:
            //     thresholds = [10000, 25000, 50000]
            //     bonuses = [0.1, 0.2, 0.5]
            //     amountRaised = [0, 100, 500]
            var ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');

            let tx = await FundFactory.connect(owner).produce(
                ERC20MintableInstance.address,
                timestamps,
                prices,
                amountRaisedCustom,
                lastTime,
                thresholds,
                bonuses,
                EnumWithdrawOption.anytime,
                DontUseWhitelist
            );

            const rc = await tx.wait(); // 0ms, as tx is already confirmed
            const event = rc.events.find(event => event.event === 'InstanceCreated');
            const [instance,] = event.args;

            var FundContractInstance = await ethers.getContractAt("FundContractMock",instance);   

            if (trustedForwardMode) {
                await FundContractInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
            }
            var tokenPrice;

            var setAmountTotalRaisedValues = [0,150,600];
            for (let i in setAmountTotalRaisedValues) {
                await FundContractInstance.connect(owner).setTotalAmountRaised(setAmountTotalRaisedValues[i]);
                tokenPrice = await FundContractInstance.getTokenPrice();
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
    
            var ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');

            let tx = await FundFactory.connect(owner).produce(
                ERC20MintableInstance.address,
                timestamps,
                prices,
                amountRaisedEx,
                lastTime,
                thresholds,
                bonuses,
                EnumWithdrawOption.anytime,
                DontUseWhitelist
            );

            const rc = await tx.wait(); // 0ms, as tx is already confirmed
            const event = rc.events.find(event => event.event === 'InstanceCreated');
            const [instance,] = event.args;

            var FundContractInstance = await ethers.getContractAt("FundContract",instance);   

            if (trustedForwardMode) {
                await FundContractInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
            }

            var ratio_ETH_ITR = await FundContractInstance.getTokenPrice();
            
            // equivalent thresholds[0]
            var ethAmount1 = BigNumber.from(thresholds[0].toString());
            // equivalent thresholds[1]
            var ethAmount2 = BigNumber.from(thresholds[1].toString());

            await ERC20MintableInstance.connect(owner).mint(FundContractInstance.address, MILLION.mul(ONE_ETH));
            
            await mixedCall(FundContractInstance, trustedForwardMode, owner, 'setGroup(address[],string)', [[accountOne.address,accountTwo.address],'TestGroupName']);
        
            var accountOneBalanceBefore = await ERC20MintableInstance.balanceOf(accountOne.address);
            var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);

            await accountOne.sendTransaction({
                to: FundContractInstance.address, 
                value: ethAmount1,
                gasLimit: 2000000
            });
    
            var accountOneBalanceMiddle = await ERC20MintableInstance.balanceOf(accountOne.address);

            await accountTwo.sendTransaction({
                to: FundContractInstance.address, 
                value: ethAmount2,
                gasLimit: 2000000
            });

            var accountOneBalanceAfter = await ERC20MintableInstance.balanceOf(accountOne.address);
            var accountTwoBalanceAfter = await ERC20MintableInstance.balanceOf(accountTwo.address);
            
            var base = ethAmount1.mul(ethDenom).div(ratio_ETH_ITR);

            expect(accountOneBalanceMiddle).to.be.eq(base.add(base.mul(10).div(100)));
            expect(accountOneBalanceAfter).to.be.eq(base.add(base.mul(20).div(100)));
        });

        it('test commissions', async () => {
            // Example:
            //     thresholds = [10000, 100000, 1000000]
            //     bonuses = [0, 0, 0.5]
            //  set commissions to
            //      accountEight - 10%
            //      accountNine  - 20%;
            //      accountEleven- 10%;    

            var ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');


            let tmp = await ethers.provider.send("eth_blockNumber",[]);
            tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
            let currentBlockTime = parseInt(tmp.timestamp);

            let tx = await FundFactory.connect(owner).produce(
                ERC20MintableInstance.address,
                timestamps,
                prices, //prices = [100000, 150000, 180000]; // (0.0010/0.0015/0.0018)  mul by 1e8. 0.001 means that for 1 eth got 1000 tokens    //_00000000
                amountRaisedEx,
                lastTime,
                [
                    TEN.mul(THOUSAND).mul(ONE_ETH), 
                    HUNDRED.mul(THOUSAND).mul(ONE_ETH), 
                    THOUSAND.mul(THOUSAND).mul(ONE_ETH)
                ],
                [
                    ZERO,
                    ZERO,
                    TEN.mul(FIVE)
                ],
                EnumWithdrawOption.anytime,
                DontUseWhitelist
            );

            const rc = await tx.wait(); // 0ms, as tx is already confirmed
            const event = rc.events.find(event => event.event === 'InstanceCreated');
            const [instance,] = event.args;

            var FundContractInstance = await ethers.getContractAt("FundContract",instance);   

            if (trustedForwardMode) {
                await FundContractInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
            }

            // add commissions
            await FundContractInstance.connect(owner).addCommission(1000, accountEight.address);
            await FundContractInstance.connect(owner).addCommission(2000, accountNine.address);
            await FundContractInstance.connect(owner).addCommission(1000, accountEleven.address);

            await ERC20MintableInstance.connect(owner).mint(FundContractInstance.address, MILLION.mul(ONE_ETH));
            
            var accountOneBalanceBefore = await ERC20MintableInstance.balanceOf(accountOne.address);
            var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);
            var accountThreeBalanceBefore = await ERC20MintableInstance.balanceOf(accountThree.address);

            var accountOwnerBalanceBefore = (await ethers.provider.getBalance(owner.address));
            var accountEightBalanceBefore = (await ethers.provider.getBalance(accountEight.address));
            var accountNineBalanceBefore = (await ethers.provider.getBalance(accountNine.address));
            var accountElevenBalanceBefore = (await ethers.provider.getBalance(accountEleven.address));

            // buy tokens for 3 ETH
            const TotalETHToSend = THREE.mul(ONE_ETH);
            await accountOne.sendTransaction({
                to: FundContractInstance.address, 
                value: TotalETHToSend.div(3),
                gasLimit: 2000000
            });
            await accountTwo.sendTransaction({
                to: FundContractInstance.address, 
                value: TotalETHToSend.div(3),
                gasLimit: 2000000
            });
            await accountThree.sendTransaction({
                to: FundContractInstance.address, 
                value: TotalETHToSend.div(3),
                gasLimit: 2000000
            });

            var ratio_ETH_TOKENS = await FundContractInstance.getTokenPrice();
            var expectedTokens = (TotalETHToSend.div(3)).mul(ethDenom).div(ratio_ETH_TOKENS);
            var accountOneBalanceAfter = await ERC20MintableInstance.balanceOf(accountOne.address);
            var accountTwoBalanceAfter = await ERC20MintableInstance.balanceOf(accountTwo.address);
            var accountThreeBalanceAfter = await ERC20MintableInstance.balanceOf(accountThree.address);
            
            expect(expectedTokens).not.be.eq(ZERO);
            expect(accountOneBalanceAfter.sub(accountOneBalanceBefore)).to.be.eq(expectedTokens);
            expect(accountTwoBalanceAfter.sub(accountTwoBalanceBefore)).to.be.eq(expectedTokens);
            expect(accountThreeBalanceAfter.sub(accountThreeBalanceBefore)).to.be.eq(expectedTokens);


            const tx1 = await mixedCall(FundContractInstance, trustedForwardMode, owner, 'claimAll', []);
            const rc1 = await tx1.wait(); 
            var txFee= rc1.cumulativeGasUsed.mul(rc1.effectiveGasPrice);

            if (trustedForwardMode) {
                txFee = 0; // owner didn't spent anything, trusted forwarder payed fee for tx
            }

            var accountOwnerBalanceAfter = (await ethers.provider.getBalance(owner.address));
            

            const ExpectedOwnerETH = TotalETHToSend.sub(TotalETHToSend.mul(BigNumber.from(1000+2000+1000)).div(FRACTION));
            expect(accountOwnerBalanceAfter.sub(accountOwnerBalanceBefore)).to.be.eq(ExpectedOwnerETH.sub(txFee));

            await expect(
                FundContractInstance.connect(accountFourth).sendCommissions()
            ).to.be.revertedWith('FundContract: Exchange time should be passed');

            //time
            // go to end time
            await time.increase(parseInt(lastTime-currentBlockTime));

            await FundContractInstance.connect(accountFourth).sendCommissions();

            var accountEightBalanceAfter = (await ethers.provider.getBalance(accountEight.address));
            var accountNineBalanceAfter = (await ethers.provider.getBalance(accountNine.address));
            var accountElevenBalanceAfter = (await ethers.provider.getBalance(accountEleven.address));

            expect(accountEightBalanceAfter.sub(accountEightBalanceBefore)).to.be.eq(TotalETHToSend.mul(BigNumber.from(1000)).div(FRACTION));
            expect(accountNineBalanceAfter.sub(accountNineBalanceBefore)).to.be.eq(TotalETHToSend.mul(BigNumber.from(2000)).div(FRACTION));
            expect(accountElevenBalanceAfter.sub(accountElevenBalanceBefore)).to.be.eq(TotalETHToSend.mul(BigNumber.from(1000)).div(FRACTION));

        });
    });

    

    }

    describe("DistributeLiquidity", function(){
        var liquidityLib,
            token0,
            token1, 
            uniswapRouterFactoryInstance,
            uniswapRouterInstance,
            wrappedNativeTokenAsWETH,
            wrappedNativeTokenAsERC20,
            tmp
        ;
        beforeEach("prepare", async() => {
            //polygon/mumbai lib
            //0x1eA4C4613a4DfdAEEB95A261d11520c90D5d6252
            var libData = await ethers.getContractFactory("@intercoin/liquidity/contracts/LiquidityLib.sol:LiquidityLib");    
            liquidityLib = await libData.deploy();

            const ERC20MintableF = await ethers.getContractFactory("ERC20Mintable");    
            token0 = await ERC20MintableF.deploy("token0", "token0");
            token1 = await ERC20MintableF.deploy("token1", "token1");

            tmp = await liquidityLib.uniswapSettings();
            const UNISWAP_ROUTER = tmp[0];
            const UNISWAP_ROUTER_FACTORY_ADDRESS = tmp[1];
            uniswapRouterFactoryInstance = await ethers.getContractAt("@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol:IUniswapV2Factory",UNISWAP_ROUTER_FACTORY_ADDRESS);
            uniswapRouterInstance = await ethers.getContractAt("@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol:IUniswapV2Router02", UNISWAP_ROUTER);

            let weth = await uniswapRouterInstance.WETH();
            wrappedNativeTokenAsWETH = await ethers.getContractAt("@uniswap/v2-periphery/contracts/interfaces/IWETH.sol:IWETH", weth);
            wrappedNativeTokenAsERC20 = await ethers.getContractAt("ERC20Mintable", weth);
            
            await uniswapRouterFactoryInstance.createPair(token0.address, weth);
            await uniswapRouterFactoryInstance.createPair(token1.address, weth);
            await uniswapRouterFactoryInstance.createPair(token0.address, token1.address);

            const ts = await time.latest();
            const timeUntil = parseInt(ts)*2;
            const amountToAddLiquidity = ONE_ETH.mul(THOUSAND);

            await wrappedNativeTokenAsWETH.connect(accountFive).deposit({
                value: amountToAddLiquidity.mul(FIVE), // make more WETH
                //gasLimit: 180000
            });

            //token0/wrappedNativeToken
            await token0.mint(accountFive.address, amountToAddLiquidity);
            await token0.connect(accountFive).approve(uniswapRouterInstance.address, amountToAddLiquidity);
            //await wrappedNativeToken.mint(accountFive.address, amountToAddLiquidity);
            await wrappedNativeTokenAsERC20.connect(accountFive).approve(uniswapRouterInstance.address, amountToAddLiquidity);
            await uniswapRouterInstance.connect(accountFive).addLiquidity(token0.address, weth, amountToAddLiquidity, amountToAddLiquidity, 0, 0, accountFive.address, timeUntil);

            //token0/token1
            await token0.mint(accountFive.address, amountToAddLiquidity);
            await token0.connect(accountFive).approve(uniswapRouterInstance.address, amountToAddLiquidity);
            await token1.mint(accountFive.address, amountToAddLiquidity);
            await token1.connect(accountFive).approve(uniswapRouterInstance.address, amountToAddLiquidity);
            await uniswapRouterInstance.connect(accountFive).addLiquidity(token0.address, token1.address, amountToAddLiquidity, amountToAddLiquidity, 0, 0, accountFive.address, timeUntil);

            //token1/wrappedNativeToken
            await token1.mint(accountFive.address, amountToAddLiquidity);
            await token1.connect(accountFive).approve(uniswapRouterInstance.address, amountToAddLiquidity);
            //await wrappedNativeToken.mint(accountFive.address, amountToAddLiquidity);
            await wrappedNativeTokenAsERC20.connect(accountFive).approve(uniswapRouterInstance.address, amountToAddLiquidity);
            await uniswapRouterInstance.connect(accountFive).addLiquidity(token1.address, weth, amountToAddLiquidity, amountToAddLiquidity, 0, 0, accountFive.address, timeUntil);

        });

        // series test from adding eth to DistributeLiquidity and calling addLiquidity method
        it('test', async () => {

            const MockDistributeLiquidityF = await ethers.getContractFactory("MockDistributeLiquidity");
            
            const MockDistributeLiquidity = await MockDistributeLiquidityF.deploy(
                token0.address, // token0
                token1.address, // token1  
                liquidityLib.address, // liquidityLib
                {
                    gasLimit: 2000000
                }
            );
        
            const amount = ONE_ETH;
            var balanceBefore = (await ethers.provider.getBalance(MockDistributeLiquidity.address));
            await owner.sendTransaction({
                to: MockDistributeLiquidity.address,
                value: amount,
                gasLimit: 180000
            });

            var balanceAfter = (await ethers.provider.getBalance(MockDistributeLiquidity.address));

            await MockDistributeLiquidity.addLiquidity();
            var balanceAfterAddLiquidity = (await ethers.provider.getBalance(MockDistributeLiquidity.address));

            expect(balanceBefore).to.be.eq(ZERO);
            expect(balanceAfter).to.be.eq(amount);
            expect(balanceAfterAddLiquidity).to.be.eq(ZERO);

            expect(await token0.balanceOf(MockDistributeLiquidity.address)).to.be.eq(ZERO);
            expect(await token1.balanceOf(MockDistributeLiquidity.address)).to.be.lt(HUNDRED); // presicion. tokens left can be accommulated on each addLiqauidity
            expect(await wrappedNativeTokenAsERC20.balanceOf(MockDistributeLiquidity.address)).to.be.eq(ZERO);

            //try the same  and watch or price

            var pairAddress = await uniswapRouterFactoryInstance.getPair(token0.address, token1.address);
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
            if (pairToken0 == token0.address) {
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
                to: MockDistributeLiquidity.address,
                value: amount,
                gasLimit: 180000
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
