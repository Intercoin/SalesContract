

// const { ethers, waffle } = require('hardhat');
// const { BigNumber } = require('ethers');
// const { expect } = require('chai');
// const chai = require('chai');
// const { time } = require('@openzeppelin/test-helpers');
// const mixedCall = require('../js/mixedCall.js');

const { expect } = require("chai");
const hre = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
require("@nomicfoundation/hardhat-chai-matchers");

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

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

describe("ITR", function () {
    async function deploy() {
        const [
            owner, 
            accountOne, 
            accountTwo, 
            accountThree
        ] = await ethers.getSigners();

        const initialSupply = ethers.parseEther('100000000');
        const lockedUpInterval = 40n; // 40 days
        var tokenF = await ethers.getContractFactory("Token");    
        const Token = await tokenF.connect(owner).deploy('ITR','ITR', initialSupply);
        await Token.waitForDeployment();

        return {
            owner, 
            accountOne, 
            accountTwo, 
            accountThree, 
            initialSupply,
            lockedUpInterval,
            Token
        }
    }
    
    it("The owner can to add lockups to anyone", async() => {
        const {
            owner, 
            accountOne, 
            accountTwo, 
            lockedUpInterval,
            Token
        } = await loadFixture(deploy);

        await expect(
            Token.connect(accountTwo).addLockup(accountOne.address, lockedUpInterval)
        ).to.be.revertedWith('Ownable: caller is not the owner');

        expect(
            await Token.lockups(accountOne.address)
        ).to.be.eq(0);

        await Token.connect(owner).addLockup(accountOne.address, lockedUpInterval);

        expect(
            await Token.lockups(accountOne.address)
        ).to.be.eq(lockedUpInterval);
        
    });

    it("The owner can to add different lockup for different users", async() => {
        const {
            owner, 
            accountOne, 
            accountTwo, 
            Token
        } = await loadFixture(deploy);

        await Token.connect(owner).addLockup(accountOne.address, 1n);
        await Token.connect(owner).addLockup(accountTwo.address, 2n);
        expect(
            await Token.lockups(accountOne.address)
        ).to.be.eq(1n);
        expect(
            await Token.lockups(accountTwo.address)
        ).to.be.eq(2n);
    });
    
    it("shouldnt add lockup again", async() => {
        
        const {
            owner, 
            accountOne, 
            lockedUpInterval,
            Token
        } = await loadFixture(deploy);

        await Token.connect(owner).addLockup(accountOne.address, lockedUpInterval);
        await expect(
            Token.connect(owner).addLockup(accountOne.address, lockedUpInterval)
        ).to.be.revertedWithCustomError(Token, 'AlreadyExists').withArgs(accountOne.address);
    });

    it("`lockedUpInterval` can not be ZERO", async() => {
        
        const {
            owner, 
            accountOne, 
            Token
        } = await loadFixture(deploy);

        await expect(
            Token.connect(owner).addLockup(accountOne.address, ZERO)
        ).to.be.revertedWithCustomError(Token, 'InvalidInput');
    });

    it("The owner should have all tokens after deploy", async() => {
        
        const {
            owner, 
            initialSupply,
            Token
        } = await loadFixture(deploy);
        
        expect(
            await Token.balanceOf(owner.address)
        ).to.be.eq(initialSupply);
    });

    it("The owner can transfer tokens without lockups", async() => {
        
        const {
            owner, 
            accountOne, 
            initialSupply,
            Token
        } = await loadFixture(deploy);
        
        var amountToTransfer = ethers.parseEther('100');
        await Token.connect(owner).transfer(accountOne.address, amountToTransfer);

        expect(
            await Token.balanceOf(accountOne.address)
        ).to.be.eq(amountToTransfer);

        expect(
            await Token.balanceOf(owner.address)
        ).to.be.eq(initialSupply - amountToTransfer);
    });

    it("The owner can transfer tokens with lockups without adding himself to the group personally.", async() => {
        
        const {
            owner, 
            accountOne, 
            accountTwo, 
            initialSupply,
            lockedUpInterval,
            Token
        } = await loadFixture(deploy);
        
        var amountToTransfer = ethers.parseEther('100');

        await expect(
            Token.connect(accountOne).transferWithLockup(accountTwo.address, amountToTransfer, lockedUpInterval)
        ).to.be.revertedWith('Ownable: caller is not the owner');

        await Token.connect(owner).transferWithLockup(accountOne.address, amountToTransfer, lockedUpInterval);

        expect(
            await Token.balanceOf(accountOne.address)
        ).to.be.eq(amountToTransfer);

        expect(
            await Token.balanceOf(owner.address)
        ).to.be.eq(initialSupply - amountToTransfer);

        // now accountOne can't send  until interval passed
        await expect(
            Token.connect(accountOne).transfer(accountTwo.address, amountToTransfer)
        ).to.be.revertedWith("ERC20: insufficient allowance");

    });

    it("anyone can transfer tokens without lockups if wasn't before", async() => {
        
        const {
            owner, 
            accountOne, 
            accountTwo, 
            Token
        } = await loadFixture(deploy);
        
        var amountToTransfer = ethers.parseEther('100');

        await Token.connect(owner).transfer(accountOne.address, amountToTransfer);
        await Token.connect(accountOne).transfer(accountTwo.address, amountToTransfer);

        expect(
            await Token.balanceOf(accountOne.address)
        ).to.be.eq(ZERO);

        expect(
            await Token.balanceOf(accountTwo.address)
        ).to.be.eq(amountToTransfer);
    });

    it("tokens should locked up if transfered EOA from `Group` person", async() => {
        
        const {
            owner, 
            accountOne, 
            accountTwo, 
            accountThree, 
            lockedUpInterval,
            Token
        } = await loadFixture(deploy);
        
        
        var amountToTransfer = ethers.parseEther('100');

        await Token.connect(owner).addLockup(accountOne.address, lockedUpInterval);
        await Token.connect(owner).transfer(accountOne.address, amountToTransfer);
        await Token.connect(accountOne).transfer(accountTwo.address, amountToTransfer);
        await expect(
            Token.connect(accountTwo).transfer(accountThree.address, amountToTransfer)
        ).to.be.revertedWith("ERC20: insufficient allowance");
        
    });

    it("tokens should locked up if transfered contract from `Group` person" , async() => {
        
        const {
            owner, 
            accountTwo, 
            accountThree, 
            lockedUpInterval,
            Token
        } = await loadFixture(deploy);
        
        var amountToTransfer = ethers.parseEther('100');

        var salesF = await ethers.getContractFactory("MockTransferContract");    
        var sales = await salesF.connect(owner).deploy();
        await sales.waitForDeployment();

        await Token.connect(owner).addLockup(sales.target, lockedUpInterval);
        await Token.connect(owner).transfer(sales.target, amountToTransfer);

        // accountTwo buy some tokens from Sales contract
        await sales.sendTokens(Token.target, accountTwo.address, amountToTransfer);

        // now accountTwo can't send  until interval passed
        await expect(
            Token.connect(accountTwo).transfer(accountThree.address, amountToTransfer)
        ).to.be.revertedWith("ERC20: insufficient allowance");
    });
    
    it("tokens should unlocked after interval passed", async() => {
        
        const {
            owner, 
            accountTwo, 
            accountThree, 
            lockedUpInterval,
            Token
        } = await loadFixture(deploy);
        
        var amountToTransfer = ethers.parseEther('100');

        var salesF = await ethers.getContractFactory("MockTransferContract");    
        var sales = await salesF.connect(owner).deploy();
        await sales.waitForDeployment();

        await Token.connect(owner).addLockup(sales.target, lockedUpInterval);
        await Token.connect(owner).transfer(sales.target, amountToTransfer);

        expect(
            await Token.balanceOf(sales.target)
        ).to.be.eq(amountToTransfer);

        // accountTwo buy some tokens from Sales contract
        await sales.sendTokens(Token.target, accountTwo.address, amountToTransfer)

        expect(await Token.balanceOf(sales.target)).to.be.eq(ZERO);
        expect(await Token.balanceOf(accountTwo.address)).to.be.eq(amountToTransfer);

        // now accountTwo can't send  until interval passed
        await expect(
            Token.connect(accountTwo).transfer(accountThree.address, amountToTransfer)
        ).to.be.revertedWith("ERC20: insufficient allowance");

        //passed time
        await time.increase(lockedUpInterval*86400n);

        await Token.connect(accountTwo).transfer(accountThree.address, amountToTransfer);

        expect(await Token.balanceOf(sales.target)).to.be.eq(ZERO);
        expect(await Token.balanceOf(accountTwo.address)).to.be.eq(ZERO);
        expect(await Token.balanceOf(accountThree.address)).to.be.eq(amountToTransfer);
    });

    it("user can burn own tokens", async() => {
        
        const {
            owner, 
            accountOne, 
            initialSupply,
            Token
        } = await loadFixture(deploy);

        var amountToBurn = ethers.parseEther('100');

        expect(await Token.balanceOf(accountOne.address)).to.be.eq(ZERO);

        await Token.connect(owner).transfer(accountOne.address, amountToBurn);

        expect(await Token.balanceOf(accountOne.address)).to.be.eq(amountToBurn);
        expect(await Token.totalSupply()).to.be.eq(initialSupply);

        await Token.connect(accountOne).burn(amountToBurn);

        expect(await Token.balanceOf(accountOne.address)).to.be.eq(ZERO);
        expect(await Token.totalSupply()).to.be.eq(initialSupply - amountToBurn);

    });

    it("contract can burn own tokens", async() => {
        
        const {
            owner, 
            initialSupply,
            Token
        } = await loadFixture(deploy);
        
        var amountToBurn = ethers.parseEther('100');

        var salesF = await ethers.getContractFactory("MockTransferContract");    
        var sales = await salesF.connect(owner).deploy();
        await sales.waitForDeployment();

        expect(await Token.balanceOf(sales.target)).to.be.eq(ZERO);

        await Token.connect(owner).transfer(sales.target, amountToBurn);

        expect(await Token.balanceOf(sales.target)).to.be.eq(amountToBurn);
        expect(await Token.totalSupply()).to.be.eq(initialSupply);

        await sales.burnOwnTokens(Token.target, amountToBurn);

        expect(await Token.balanceOf(sales.target)).to.be.eq(ZERO);
        expect(await Token.totalSupply()).to.be.eq(initialSupply - amountToBurn);
    });

});