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

describe("Community", function () {
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
    var AggregatorF;
    var ERC20MintableF;
    var FundFactoryF
    
    var FundFactory;

    // var ControlContractFactory;
    // var ControlContract;
    // var CommunityMock;
    
    // predefined init params
    var timestamps;
    var prices;
    var lastTime;
    const thresholds = [TEN.mul(ONE_ETH), FIVE.mul(FIVE).mul(ONE_ETH), FIVE.mul(TEN).mul(ONE_ETH)];// count in eth (10/25/50)
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

        FundContractTokenF = await ethers.getContractFactory("FundContractToken");    
        ERC20MintableF = await ethers.getContractFactory("ERC20Mintable");
        FundContractMockF = await ethers.getContractFactory("FundContractMock");    
        AggregatorF = await ethers.getContractFactory("Aggregator");    

        FundFactoryF = await ethers.getContractFactory("FundFactory");

        FundFactory = await FundFactoryF.connect(owner).deploy();

    });
    
    afterEach("deploying", async() => { 
        // restore snapshot
        await ethers.provider.send('evm_revert', [snapId]);
        //console.log(`afterEach("deploying"`);
    });

    for (const trustedForwardMode of [false,trustedForwarder]) {

    describe(`${trustedForwardMode ? '[trusted forwarder]' : ''} tests`, function () {  
        
        it('common test(token)', async () => {

            var ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');
            var Token2PayInstance = await ERC20MintableF.connect(owner).deploy('token2','token2');
            
            let tx = await FundFactory.connect(owner).produceToken(
                Token2PayInstance.address,
                ERC20MintableInstance.address,
                timestamps,
                prices,
                lastTime,
                thresholds,
                bonuses
            );

            const rc = await tx.wait(); // 0ms, as tx is already confirmed
            const event = rc.events.find(event => event.event === 'InstanceCreated');
            const [instance,] = event.args;

            FundContractTokenInstance = await ethers.getContractAt("FundContractToken",instance);   

            if (trustedForwardMode) {
                await FundContractTokenInstance.connect(owner).setTrustedForwarder(trustedForwarder.address);
            }

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

            var accountFourthBalanceBefore = await Token2PayInstance.balanceOf(accountFourth.address);
        
            await mixedCall(FundContractTokenInstance, trustedForwardMode, owner, 'claim(uint256,address)', [amountETHSendToContract, accountFourth.address]);
            var accountFourthBalanceAfter = await Token2PayInstance.balanceOf(accountFourth.address);

            expect(accountFourthBalanceAfter.sub(accountFourthBalanceBefore)).to.be.eq(amountETHSendToContract);
            
            var accountFiveBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive.address);
            await mixedCall(FundContractTokenInstance, trustedForwardMode, owner, 'withdraw(uint256,address)', [calculatedAmountOfTokens, accountFive.address]);
            var accountFiveBalanceActual = await ERC20MintableInstance.balanceOf(accountFive.address);
            var accountFiveBalanceExpected = accountFiveBalanceBefore.add(calculatedAmountOfTokens);

            expect(accountFiveBalanceActual).to.be.eq(accountFiveBalanceExpected);

        });
    
        it('common test(eth)', async () => {

            var ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');

            let tx = await FundFactory.connect(owner).produce(
                ERC20MintableInstance.address,
                timestamps,
                prices,
                lastTime,
                thresholds,
                bonuses,
            );

            const rc = await tx.wait(); // 0ms, as tx is already confirmed
            const event = rc.events.find(event => event.event === 'InstanceCreated');
            const [instance,] = event.args;

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
                gasLimit: 150000
            });

            var accountTwoBalanceActual = await ERC20MintableInstance.balanceOf(accountTwo.address);
            var calculatedAmountOfTokens = amountETHSendToContract.mul(ethDenom).div(ratio_ETH_ITR);
            var accountTwoBalanceExpected = accountTwoBalanceBefore.add(calculatedAmountOfTokens);

            expect(accountTwoBalanceActual).to.be.eq(accountTwoBalanceExpected);
            
            // go to end time
            await ethers.provider.send('evm_increaseTime', [parseInt(lastTime-currentBlockTime)]);
            await ethers.provider.send('evm_mine');
            
            var accountFourthBalanceBefore = (await ethers.provider.getBalance(accountFourth.address));
                
            await mixedCall(FundContractTokenInstance, trustedForwardMode, owner, 'claim(uint256,address)', [amountETHSendToContract, accountFourth.address]);
            
            var accountFourthBalanceAfter = (await ethers.provider.getBalance(accountFourth.address));

            expect(accountFourthBalanceAfter.sub(accountFourthBalanceBefore)).to.be.eq(amountETHSendToContract);
            
            var accountFiveBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive.address);
            await mixedCall(FundContractTokenInstance, trustedForwardMode, owner, 'withdraw(uint256,address)', [calculatedAmountOfTokens, accountFive.address]);
            var accountFiveBalanceActual = await ERC20MintableInstance.balanceOf(accountFive.address);
            var accountFiveBalanceExpected = accountFiveBalanceBefore.add(calculatedAmountOfTokens);

            expect(accountFiveBalanceActual).to.be.eq(accountFiveBalanceExpected);

        });
    
        
        it('test bonuses', async () => {
            
            // Example:
            //     thresholds = [10000, 25000, 50000]
            //     bonuses = [0.1, 0.2, 0.5]
            //     First person contributed $10,000 and got 0.1 bonus which is $1,000
            //     Second person in same group contributed $20,000 so total of group if $30,000 and so second person gets 20% of $20,000 = $4000 while first person gets 10% of $10,000 which is another $1,000.
            
            var ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');

            var AggregatorInstance = await AggregatorF.connect(owner).deploy();
            var FundContractInstance = await FundContractMockF.connect(owner).deploy();
            
            await FundContractInstance.connect(owner).init(
                ERC20MintableInstance.address,
                timestamps,
                prices,
                lastTime,
                thresholds,
                bonuses,
            );

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
                lastTime,
                thresholds,
                bonuses
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
            await expect(FundContractTokenInstance.connect(owner).setTrustedForwarder(owner.address)).to.be.revertedWith("FORWARDER_CAN_NOT_BE_OWNER");
        });
        
    });

    }

});
