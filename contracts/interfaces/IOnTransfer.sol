// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

interface IOnTransfer {
    
    function onTransfer(address from, address to, uint256 amount) external returns(bool);
    
}
