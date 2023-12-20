// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "@intercoin/minimums/contracts/MinimumsBase.sol";

contract Token is ERC20, Ownable, MinimumsBase {
    using EnumerableSet for EnumerableSet.AddressSet;

    uint256 intervalLockedUp;// 40 days; days not 40 days in seconds

    // addressSet. Tokens obtained from suich users will be locked up for 40 days
    EnumerableSet.AddressSet private groupSet;
    

    constructor (
        string memory name, 
        string memory symbol,
        uint256 initialSupply,
        uint256 intervalCount
    ) 
        Ownable()
        ERC20(name, symbol) 
        MinimumsBase(86400) // interval = 1 day
    {
        intervalLockedUp = intervalCount;
        _mint(owner(), initialSupply);
    }
   

    function groupAdd(address account) public onlyOwner {
        groupSet.add(account);
    }

    function groupView(address account) public view returns(bool) {
        return groupSet.contains(account);
    }

    function transferWithLockedUp(address to, uint256 amount) public onlyOwner {
        super.transfer(to, amount);
        _minimumsAdd(
            to,                 //address addr,
            amount,             //uint256 amount, 
            intervalLockedUp,   //uint256 intervalCount,
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
        if (groupSet.contains(from) && owner() != _msgSender()) {
            _minimumsAdd(
                to,                 //address addr,
                amount,             //uint256 amount, 
                intervalLockedUp,   //uint256 intervalCount,
                false               //bool gradual
            );
        }
    }
    
}
