const BigNumber = require('bignumber.js');
const util = require('util');
const FundContractMock = artifacts.require("FundContractMock");
const Aggregator = artifacts.require("Aggregator");
const ERC20Mintable = artifacts.require("ERC20Mintable");

const truffleAssert = require('truffle-assertions');
const helper = require("../helpers/truffleTestHelper");

contract('IntercoinContract', (accounts) => {
    
    // it("should assert true", async function(done) {
    //     await TestExample.deployed();
    //     assert.isTrue(true);
    //     done();
    //   });
    
    // Setup accounts.
    const accountOne = accounts[0];
    const accountTwo = accounts[1];  
    const accountThree = accounts[2];
    const accountFourth= accounts[3];
    const accountFive = accounts[4];
    const accountSix = accounts[5];
    const accountSeven = accounts[6];
    const accountEight = accounts[7];
    const accountNine = accounts[8];
    const accountTen = accounts[9];
    const accountEleven = accounts[10];
    const accountTwelwe = accounts[11];
    
    const zeroAddr = '0x0000000000000000000000000000000000000000';
    
    const amountETHSendToContract = 10*10**18; // 10ETH
    
    it('test', async () => {
        var ERC20MintableInstance = await ERC20Mintable.new('t1','t1', {from: accountTen});
        var AggregatorInstance = await Aggregator.new({from: accountTen});
        var FundContractInstance = await FundContractMock.new(
            ERC20MintableInstance.address,
            AggregatorInstance.address,
            [1609459200, 1614556800, 1619827200],
            [12000000, 15000000, 18000000],
            1630454400,
            {from: accountTen}
        );
        
        var ratio_USD_ITR = await FundContractInstance.getExchangePriceUSD({from: accountTen});
    
        // send ETH to Contract, but it should be revert with message "Amount exceeds allowed balance"
        await truffleAssert.reverts(
            web3.eth.sendTransaction({
                from:accountTwo,
                to: FundContractInstance.address, 
                value: amountETHSendToContract
            }), 
            "Amount exceeds allowed balance"
        );
        
        await ERC20MintableInstance.mint(FundContractInstance.address, BigNumber(1000000*1e18), {from: accountTen})
        
        var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo);
        // send ETH to Contract
        await web3.eth.sendTransaction({
            from:accountTwo,
            to: FundContractInstance.address, 
            value: amountETHSendToContract
        });
        var tmp = await AggregatorInstance.latestRoundData({from: accountTen});
        var ratio_ETH_USD = tmp[1];
        
        var accountTwoBalanceActual = await ERC20MintableInstance.balanceOf(accountTwo);
        var calculatedAmountOfTokens = (BigNumber(amountETHSendToContract).times(BigNumber(ratio_ETH_USD)).div(BigNumber(ratio_USD_ITR))).integerValue();
        var accountTwoBalanceExpected = BigNumber(accountTwoBalanceBefore).plus(calculatedAmountOfTokens);

        
        assert.equal(
            (accountTwoBalanceActual).toString(10),
            (accountTwoBalanceExpected.integerValue()).toString(10),
            'Balance are wrong'
        );
        
        await truffleAssert.reverts(
            FundContractInstance.claim(BigNumber(amountETHSendToContract).integerValue(), accountFourth, {from: accountTen}),
            'claim available after `endTime` expired'
        );
        await truffleAssert.reverts(
            FundContractInstance.withdraw(BigNumber(calculatedAmountOfTokens).integerValue(), accountFive, {from: accountTen}),
            'withdraw available after `endTime` expired'
        );
        
        
        // console.log('1=',(await FundContractInstance.getExchangePriceUSD({from: accountTen})).toString());
        // helper.advanceTimeAndBlock(60*24*60*60);
        // console.log('2=',(await FundContractInstance.getExchangePriceUSD({from: accountTen})).toString());
        // helper.advanceTimeAndBlock(60*24*60*60);
        // console.log('3=',(await FundContractInstance.getExchangePriceUSD({from: accountTen})).toString());
        
        // go to end time
        helper.advanceTimeAndBlock(1630454400);
        
        var accountFourthBalanceBefore = (await web3.eth.getBalance(accountFourth));
        await FundContractInstance.claim(BigNumber(amountETHSendToContract).integerValue(), accountFourth, {from: accountTen});
        var accountFourthBalanceAfter = (await web3.eth.getBalance(accountFourth));
        assert.equal(
            (
                BigNumber(accountFourthBalanceAfter).minus(BigNumber(accountFourthBalanceBefore))
            ).toString(10),
            (amountETHSendToContract).toString(10),
            'after claim balance are wrong'
        );
        
        var accountFiveBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive);
        await FundContractInstance.withdraw(BigNumber(calculatedAmountOfTokens).integerValue(), accountFive, {from: accountTen});
        var accountFiveBalanceActual = await ERC20MintableInstance.balanceOf(accountFive);
        var accountFiveBalanceExpected = BigNumber(accountFiveBalanceBefore).plus(calculatedAmountOfTokens);

        
        assert.equal(
            (accountFiveBalanceActual).toString(10),
            (accountFiveBalanceExpected.integerValue()).toString(10),
            'after withdraw balance are wrong'
        );
        
    });
    
});