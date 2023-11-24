// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@intercoin/community/contracts/interfaces/ICommunity.sol";
// mock community contract.
// we will bot implemented all methods. we just need to have hasRole only. and such method will return always `true`
contract MockWhitelist is ICommunity {
    bool success;
    function initialize(address hook, address invitedHook, address costManager, address authorizedInviteManager, string memory name, string memory symbol, string memory contractUri) external {}
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



    //empty stubs
    function getRolesWhichAccountCanGrant(address accountWhichWillGrant,string[] memory roleNames) external view returns (uint8[] memory x) {}
    function grantRoles(address[] memory accounts,uint8[] memory roleIndexes) external {}
    function revokeRoles(address[] memory accounts,uint8[] memory roleIndexes) external {}

}
