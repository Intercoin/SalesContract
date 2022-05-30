const { ethers, waffle } = require('hardhat');
const { BigNumber } = require('ethers');
const { expect } = require('chai');
const chai = require('chai');
const { time } = require('@openzeppelin/test-helpers');

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
    const accountTwelwe = accounts[12];
    
    // setup useful vars
    var FundContractMockF;
    var FundContractTokenF;
    var AggregatorF;
    var ERC20MintableF;
    

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
        

    });

    it('common test(token)', async () => {
        
        // make snapshot before time manipulations
        let snapId = await ethers.provider.send('evm_snapshot', []);

        var ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');

        var Token2PayInstance = await ERC20MintableF.connect(owner).deploy('token2','token2');
        
        var FundContractTokenInstance = await FundContractTokenF.connect(owner).deploy();

        await FundContractTokenInstance.connect(owner).init(
            Token2PayInstance.address,
            ERC20MintableInstance.address,
            timestamps,
            prices,
            lastTime,
            thresholds,
            bonuses
        );

        await Token2PayInstance.connect(owner).mint(accountTwo.address, amountTokenSendToContract);
        var ratio_TOKEN2_ITR = await FundContractTokenInstance.connect(owner).getTokenPrice();
    
        // send t2 to Contract, but it should be revert with message "Amount exceeds allowed balance"
        await expect(
            FundContractTokenInstance.connect(accountTwo).buy(amountTokenSendToContract), 
        ).to.be.revertedWith("ERC20: insufficient allowance");
        
        await ERC20MintableInstance.connect(owner).mint(FundContractTokenInstance.address, MILLION.mul(ONE_ETH));

        var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);
        // set approve before
        await Token2PayInstance.connect(accountTwo).approve(FundContractTokenInstance.address, amountTokenSendToContract);
        // send Token2 to Contract 
        await FundContractTokenInstance.connect(accountTwo).buy(amountTokenSendToContract);

        var accountTwoBalanceActual = await ERC20MintableInstance.balanceOf(accountTwo.address);
        var calculatedAmountOfTokens = amountTokenSendToContract.mul(ethDenom).div(ratio_TOKEN2_ITR);
        var accountTwoBalanceExpected = accountTwoBalanceBefore.add(calculatedAmountOfTokens);

        
        // assert.equal(
        //     (accountTwoBalanceActual).toString(10),
        //     (accountTwoBalanceExpected.integerValue(BigNumber.ROUND_DOWN)).toString(10),
        //     'Balance are wrong'
        // );
        expect(accountTwoBalanceActual).to.be.eq(accountTwoBalanceExpected);
        

        let tmp;
        tmp = await ethers.provider.send("eth_blockNumber",[]);
        tmp = await ethers.provider.send("eth_getBlockByNumber",[tmp, true]);
        currentBlockTime = parseInt(tmp.timestamp);

        // go to end time
        await ethers.provider.send('evm_increaseTime', [parseInt(lastTime-currentBlockTime)]);
        await ethers.provider.send('evm_mine');

        var accountFourthBalanceBefore = await Token2PayInstance.balanceOf(accountFourth.address);
    
        await FundContractTokenInstance.connect(owner).claim(amountETHSendToContract, accountFourth.address);
        var accountFourthBalanceAfter = await Token2PayInstance.balanceOf(accountFourth.address);

        
        // assert.equal(
        //     (
        //         BigNumber(accountFourthBalanceAfter).minus(BigNumber(accountFourthBalanceBefore))
        //     ).toString(10),
        //     (amountETHSendToContract).toString(10),
        //     'after claim balance are wrong'
        // );
        expect(accountFourthBalanceAfter.sub(accountFourthBalanceBefore)).to.be.eq(amountETHSendToContract);
        
        var accountFiveBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive.address);
        await FundContractTokenInstance.connect(owner).withdraw(calculatedAmountOfTokens, accountFive.address);
        var accountFiveBalanceActual = await ERC20MintableInstance.balanceOf(accountFive.address);
        var accountFiveBalanceExpected = accountFiveBalanceBefore.add(calculatedAmountOfTokens);

        
        // assert.equal(
        //     (accountFiveBalanceActual).toString(10),
        //     (accountFiveBalanceExpected.integerValue()).toString(10),
        //     'after withdraw balance are wrong'
        // );
        expect(accountFiveBalanceActual).to.be.eq(accountFiveBalanceExpected);

        // restore snapshot
        await ethers.provider.send('evm_revert', [snapId]);

    });
   
    it('common test(eth)', async () => {
        // make snapshot before time manipulations
        let snapId = await ethers.provider.send('evm_snapshot', []);

        var ERC20MintableInstance = await ERC20MintableF.connect(owner).deploy('t1','t1');
        var FundContractInstance = await FundContractMockF.connect(owner).deploy();
        
        await FundContractInstance.connect(owner).init(
            ERC20MintableInstance.address,
            timestamps,
            prices,
            lastTime,
            thresholds,
            bonuses,
        );

        var ratio_ETH_ITR = await FundContractInstance.getTokenPrice();
    
        // send ETH to Contract, but it should be revert with message "Amount exceeds allowed balance"
        // await truffleAssert.reverts(
        //     web3.eth.sendTransaction({
        //         from:accountTwo,
        //         to: FundContractInstance.address, 
        //         value: amountETHSendToContract
        //     }), 
        //     "Amount exceeds allowed balance"
        // );
        await expect(
            accountTwo.sendTransaction({
                to: FundContractInstance.address, 
                value: amountETHSendToContract
            })
        ).to.be.revertedWith("Amount exceeds allowed balance");
        
        await ERC20MintableInstance.connect(owner).mint(FundContractInstance.address, MILLION.mul(ONE_ETH));

        var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo.address);
        // send ETH to Contract
        // await web3.eth.sendTransaction({
        //     from:accountTwo,
        //     to: FundContractInstance.address, 
        //     value: amountETHSendToContract,
        //     gas: 150000
        // });
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
             
        await FundContractInstance.connect(owner).claim(amountETHSendToContract, accountFourth.address);
        var accountFourthBalanceAfter = (await ethers.provider.getBalance(accountFourth.address));

        expect(accountFourthBalanceAfter.sub(accountFourthBalanceBefore)).to.be.eq(amountETHSendToContract);
        
        var accountFiveBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive.address);
        await FundContractInstance.connect(owner).withdraw(calculatedAmountOfTokens, accountFive.address);
        var accountFiveBalanceActual = await ERC20MintableInstance.balanceOf(accountFive.address);
        var accountFiveBalanceExpected = accountFiveBalanceBefore.add(calculatedAmountOfTokens);

        expect(accountFiveBalanceActual).to.be.eq(accountFiveBalanceExpected);

        // restore snapshot
        await ethers.provider.send('evm_revert', [snapId]);
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

        var ratio_ETH_ITR = await FundContractInstance.getTokenPrice();
        
        // equivalent thresholds[0]
        var ethAmount1 = BigNumber.from(thresholds[0].toString());
        // equivalent thresholds[1]
        var ethAmount2 = BigNumber.from(thresholds[1].toString());

        await ERC20MintableInstance.connect(owner).mint(FundContractInstance.address, MILLION.mul(ONE_ETH));
        
        await FundContractInstance.connect(owner).setGroup([accountOne.address,accountTwo.address], 'TestGroupName');
       
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
        
        // assert.equal(
        //     BigNumber(accountOneBalanceMiddle).toFixed(0),
        //     BigNumber(base.plus(base.times(BigNumber(0.1)))).toFixed(0),
        //     'accountOneBalanceMiddle wrong'
        // );
        expect(accountOneBalanceMiddle).to.be.eq(base.add(base.div(10)));
        
        // assert.equal(
        //     BigNumber(accountOneBalanceAfter).toFixed(0),
        //     BigNumber(base.plus(base.times(BigNumber(0.2)))).toFixed(0),
        //     'accountOneBalanceAfter wrong'
        // );
        expect(accountOneBalanceAfter).to.be.eq(base.add(base.div(20)));
        
    });
    /*   
*/
});
