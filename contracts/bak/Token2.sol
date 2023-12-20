// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "../interfaces/IOnTransfer.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Token2 is ERC20BurnableUpgradeable, OwnableUpgradeable {
    
    
    address public hook;
    event HookUpdated(address hook);
   
    function initialize(
        string memory name, 
        string memory symbol,
        uint256 initialSupply,
        address owner,
        address hook_
    ) 
        public 
        virtual 
        initializer 
    {
        __Token_init(name, symbol, initialSupply*10**decimals(), owner, hook_);
    }
    
     /**
     * @dev Mints `initialSupply` amount of token and transfers them to `owner`.
     *
     * See {ERC20-constructor}.
     */
    function __Token_init(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address owner,
        address hook_
    ) internal initializer {
        __Context_init_unchained();
        __ERC20_init_unchained(name, symbol);
        __ERC20Burnable_init_unchained();
        __Ownable_init();
        
        __Token_init_unchained(initialSupply, owner, hook_);
    }

    function __Token_init_unchained(
        uint256 initialSupply,
        address owner,
        address hook_
    ) internal initializer {
        transferOwnership(owner);
        _updateHook(hook_);
        _mint(owner, initialSupply);
    }
    
    
    function transfer(
        address recipient, 
        uint256 amount
    ) 
        public 
        virtual 
        override 
        returns (bool) 
    {
        super.transfer(recipient, amount);
        
         if (address(hook) != address(0)) {
            IOnTransfer(hook).onTransfer(_msgSender(), recipient, amount);
        }
        
        return true;
    }
    
    /**
     * set restriction for every transfer
     * @param _hook address of Hook contract
     * @return bool
     */
    function updateHook(
        address _hook
    ) 
        public 
        onlyOwner
        returns (bool) 
    {
        return _updateHook(_hook);    
        
    }
    
    
    function _updateHook(
        address _hook
    ) 
        private 
        returns (bool) 
    {

        if (_hook != hook) {
            hook = _hook;
            emit HookUpdated(_hook);
        }
        
        return true;
    }
    
    uint256[50] private __gap;
}
