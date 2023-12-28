// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "@intercoin/minimums/contracts/MinimumsBase.sol";
/**
 * @title Token with the ability to lock up tokens after transfer for specific users.
 */
contract Token is ERC20, Ownable, MinimumsBase {
    using EnumerableSet for EnumerableSet.AddressSet;
    uint32 constant interval = 86400; // 1 day

    // Tokens obtained from such users will be locked up for period in days
    mapping(address => uint256) public lockups;

    error AlreadyExists(address user);
    error InvalidInput();

    constructor (
        string memory name, 
        string memory symbol,
        uint256 initialSupply
    ) 
        Ownable()
        ERC20(name, symbol) 
        MinimumsBase(interval)
    {
        _mint(owner(), initialSupply);
    }
   
    /*
    * @notice add lockup for user.
    * @params account tokens obtained from such user address  will be locked up for `intervalCount` count of interval
    * @params intervalCount houw much `intervalCount` of `interval` tokens will be locked up
    *  for `interval` = "86400",  `intervalCount` = "2" means that tokens will be locked up for 2 days
    */
    function addLockup(address account, uint256 intervalCount) public onlyOwner {
        if (intervalCount == 0) {
            revert InvalidInput();
        }
        if (lockups[account] != 0) {
            revert AlreadyExists(account);
        }
        lockups[account] = intervalCount;
    }

    /**
    * @notice the way for owner to locked up tokens after off-chain trade
    */
    function transferWithLockup(address to, uint256 amount, uint256 intervalCount) public onlyOwner {
        super.transfer(to, amount);
        _minimumsAdd(
            to,                 //address addr,
            amount,             //uint256 amount, 
            intervalCount,      //uint256 intervalCount,
            false               //bool gradual
        );
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        if (from != address(0)) {
            require(
                (balanceOf(from) - _getMinimum(from) >= amount),
                "ERC20: insufficient allowance"
            );
            
        }
        if (lockups[from] != 0) {
            _minimumsAdd(
                to,                 //address addr,
                amount,             //uint256 amount, 
                lockups[from],      //uint256 intervalCount,
                false               //bool gradual
            );
        }
    }
    
}
