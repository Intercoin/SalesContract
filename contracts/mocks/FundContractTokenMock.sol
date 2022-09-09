// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "../FundContractToken.sol";

contract FundContractTokenMock is FundContractToken {
    
    
    /**
     * Network: Rinkeby
     * Aggregator: ETH/USD
     * Address: 0x8A753747A1Fa494EC906cE90E9f37563A8AF630e
     */
    
    function getGroupData(string memory groupName) public view returns(Group memory) {
        return groups[groupName];
    }
    function getParticipantData(address addr) public view returns(Participant memory) {
        return participants[addr];
    }


    function getHoldedAmount() public view returns(uint256) {
        return getContractTotalAmount();

    }

}
