// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./ERC20Mintable.sol";
import "../interfaces/IERC20Burnable.sol";

contract ERC20MintableBurnable is ERC20Mintable, IERC20Burnable {
    
    /**
     * @param name Token name
     * @param symbol Token symbol
     * 
     */
    constructor (
        string memory name, 
        string memory symbol
    ) 
    ERC20Mintable(name, symbol)
    {

    }
    
    function burn(uint256 amount) public virtual returns(bool success) {
        _burn(msg.sender, amount);
        return true;
    }
    
}