// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@artman325/community/contracts/interfaces/ICommunity.sol";
// mock community contract.
// we will bot implemented all methods. we just need to have hasRole only. and such method will return always `true`
contract MockWhitelist is ICommunity {
    bool success;
    function initialize(address implState, address implView, address hook, address costManager, string memory name, string memory symbol) external {}
    function addressesCount(uint8 roleIndex) external view returns(uint256 x) {}
    function getRoles(address[] calldata accounts)external view returns(uint8[][] memory x2) {}
    function getAddresses(uint8[] calldata rolesIndexes) external view returns(address[][] memory x3) {}

    function hasRole(address account, uint8 roleIndex) external view returns(bool) {
        account;
        roleIndex;
        
        return success;
    }

    function setupSuccess(bool _success) public {
        success = _success;
    }
}
