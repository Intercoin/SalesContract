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

describe("ITR", function () {
    const accounts = waffle.provider.getWallets();
    
    // Setup accounts.
    const owner = accounts[0];                     
    const accountOne = accounts[1];  
    const accountTwo = accounts[2];
    const accountThree= accounts[3];
    // const accountFourth = accounts[4];
    // const accountFive = accounts[5];
    // const accountSix = accounts[6];
    // const accountSeven = accounts[7];
    // const accountEight = accounts[8];
    // const accountNine = accounts[9];
    // const accountEleven = accounts[11];
    // const trustedForwarder = accounts[12];


    var token;
    const InitialSupply = HUNDRED.mul(MILLION).mul(ONE_ETH);
    const LockedUpInterval = 40; // 40 days

    beforeEach("deploying", async() => {
        var tokenF = await ethers.getContractFactory("Token");    
        token = await tokenF.connect(owner).deploy('ITR','ITR', InitialSupply);
    });

    it("The owner can to add lockups to anyone", async() => {
        await expect(
            token.connect(accountTwo).addLockup(accountOne.address, LockedUpInterval)
        ).to.be.revertedWith('Ownable: caller is not the owner');

        expect(
            await token.lockups(accountOne.address)
        ).to.be.eq(0);

        await token.connect(owner).addLockup(accountOne.address, LockedUpInterval);

        expect(
            await token.lockups(accountOne.address)
        ).to.be.eq(LockedUpInterval);
        
    });

    it("The owner can to add different lockup for different users", async() => {
        await token.connect(owner).addLockup(accountOne.address, ONE);
        await token.connect(owner).addLockup(accountTwo.address, TWO);
        expect(
            await token.lockups(accountOne.address)
        ).to.be.eq(ONE);
        expect(
            await token.lockups(accountTwo.address)
        ).to.be.eq(TWO);
    });
    
    it("shouldnt add lockup again", async() => {
        await token.connect(owner).addLockup(accountOne.address, LockedUpInterval);
        await expect(
            token.connect(owner).addLockup(accountOne.address, LockedUpInterval)
        ).to.be.revertedWith('AlreadyExists').withArgs(accountOne.address);
    });

    it("`LockedUpInterval` can not be ZERO", async() => {
        await expect(
            token.connect(owner).addLockup(accountOne.address, ZERO)
        ).to.be.revertedWith('InvalidInput');
    });

    it("The owner should have all tokens after deploy", async() => {
        expect(
            await token.balanceOf(owner.address)
        ).to.be.eq(InitialSupply);
    });

    it("The owner can transfer tokens without lockups", async() => {
        var amountToTransfer = HUNDRED.mul(ONE_ETH);
        await token.connect(owner).transfer(accountOne.address, amountToTransfer);

        expect(
            await token.balanceOf(accountOne.address)
        ).to.be.eq(amountToTransfer);

        expect(
            await token.balanceOf(owner.address)
        ).to.be.eq(InitialSupply.sub(amountToTransfer));
    });

    it("The owner can transfer tokens with lockups without adding himself to the group personally.", async() => {
        var amountToTransfer = HUNDRED.mul(ONE_ETH);

        await expect(
            token.connect(accountOne).transferWithLockup(accountTwo.address, amountToTransfer, LockedUpInterval)
        ).to.be.revertedWith('Ownable: caller is not the owner');

        await token.connect(owner).transferWithLockup(accountOne.address, amountToTransfer, LockedUpInterval);

        expect(
            await token.balanceOf(accountOne.address)
        ).to.be.eq(amountToTransfer);

        expect(
            await token.balanceOf(owner.address)
        ).to.be.eq(InitialSupply.sub(amountToTransfer));

        // now accountOne can't send  until interval passed
        await expect(
            token.connect(accountOne).transfer(accountTwo.address, amountToTransfer)
        ).to.be.revertedWith("ERC20: insufficient allowance");

    });

    it("anyone can transfer tokens without lockups if wasn't before", async() => {
        var amountToTransfer = HUNDRED.mul(ONE_ETH);
        await token.connect(owner).transfer(accountOne.address, amountToTransfer);
        await token.connect(accountOne).transfer(accountTwo.address, amountToTransfer);

        expect(
            await token.balanceOf(accountOne.address)
        ).to.be.eq(ZERO);

        expect(
            await token.balanceOf(accountTwo.address)
        ).to.be.eq(amountToTransfer);
    });

    it("tokens should locked up if transfered EOA from `Group` person", async() => {
        var amountToTransfer = HUNDRED.mul(ONE_ETH);

        await token.connect(owner).addLockup(accountOne.address, LockedUpInterval);
        await token.connect(owner).transfer(accountOne.address, amountToTransfer);
        await token.connect(accountOne).transfer(accountTwo.address, amountToTransfer);
        await expect(
            token.connect(accountTwo).transfer(accountThree.address, amountToTransfer)
        ).to.be.revertedWith("ERC20: insufficient allowance");
        
    });

    it("tokens should locked up if transfered contract from `Group` person" , async() => {
        var amountToTransfer = HUNDRED.mul(ONE_ETH);

        var salesF = await ethers.getContractFactory("MockTransferContract");    
        var sales = await salesF.connect(owner).deploy();

        await token.connect(owner).addLockup(sales.address, LockedUpInterval);
        await token.connect(owner).transfer(sales.address, amountToTransfer);

        // accountTwo buy some tokens from Sales contract
        await sales.sendTokens(token.address, accountTwo.address, amountToTransfer);

        // now accountTwo can't send  until interval passed
        await expect(
            token.connect(accountTwo).transfer(accountThree.address, amountToTransfer)
        ).to.be.revertedWith("ERC20: insufficient allowance");
    });
    
    it("tokens should unlocked after interval passed", async() => {
        var amountToTransfer = HUNDRED.mul(ONE_ETH);

        var salesF = await ethers.getContractFactory("MockTransferContract");    
        var sales = await salesF.connect(owner).deploy();

        await token.connect(owner).addLockup(sales.address, LockedUpInterval);
        await token.connect(owner).transfer(sales.address, amountToTransfer);

        expect(
            await token.balanceOf(sales.address)
        ).to.be.eq(amountToTransfer);

        // accountTwo buy some tokens from Sales contract
        await sales.sendTokens(token.address, accountTwo.address, amountToTransfer)

        expect(await token.balanceOf(sales.address)).to.be.eq(ZERO);
        expect(await token.balanceOf(accountTwo.address)).to.be.eq(amountToTransfer);

        // now accountTwo can't send  until interval passed
        await expect(
            token.connect(accountTwo).transfer(accountThree.address, amountToTransfer)
        ).to.be.revertedWith("ERC20: insufficient allowance");

        //passed time
        await time.increase(LockedUpInterval*86400);

        await token.connect(accountTwo).transfer(accountThree.address, amountToTransfer);

        expect(await token.balanceOf(sales.address)).to.be.eq(ZERO);
        expect(await token.balanceOf(accountTwo.address)).to.be.eq(ZERO);
        expect(await token.balanceOf(accountThree.address)).to.be.eq(amountToTransfer);
    });

    it("user can burn own tokens", async() => {

        var amountToBurn = HUNDRED.mul(ONE_ETH);

        expect(await token.balanceOf(accountOne.address)).to.be.eq(ZERO);

        await token.connect(owner).transfer(accountOne.address, amountToBurn);

        expect(await token.balanceOf(accountOne.address)).to.be.eq(amountToBurn);
        expect(await token.totalSupply()).to.be.eq(InitialSupply);

        await token.connect(accountOne).burn(amountToBurn);

        expect(await token.balanceOf(accountOne.address)).to.be.eq(ZERO);
        expect(await token.totalSupply()).to.be.eq(InitialSupply.sub(amountToBurn));

    });

    it("contract can burn own tokens", async() => {
        var amountToBurn = HUNDRED.mul(ONE_ETH);

        var salesF = await ethers.getContractFactory("MockTransferContract");    
        var sales = await salesF.connect(owner).deploy();

        expect(await token.balanceOf(sales.address)).to.be.eq(ZERO);

        await token.connect(owner).transfer(sales.address, amountToBurn);

        expect(await token.balanceOf(sales.address)).to.be.eq(amountToBurn);
        expect(await token.totalSupply()).to.be.eq(InitialSupply);

        await sales.burnOwnTokens(token.address, amountToBurn);

        expect(await token.balanceOf(sales.address)).to.be.eq(ZERO);
        expect(await token.totalSupply()).to.be.eq(InitialSupply.sub(amountToBurn));
    });

});