// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "../FundContract.sol";

contract FundContractMock is FundContract {
    
    
    /**
     * Network: Rinkeby
     * Aggregator: ETH/USD
     * Address: 0x8A753747A1Fa494EC906cE90E9f37563A8AF630e
     */
    // constructor() public {
    //     __Ownable_init();
    //     priceFeed = AggregatorV3Interface(0x8A753747A1Fa494EC906cE90E9f37563A8AF630e);
    // }
    
    
    constructor(
        address _sellingToken,
        address _chainLink, 
        uint256[] memory _timestamps,
        uint256[] memory _prices,
        uint256 _endTime,
        uint256[] memory _thresholds,
        uint256[] memory _bonuses
    ) public FundContract(_sellingToken, _chainLink, _timestamps,_prices,_endTime, _thresholds, _bonuses) {
        
    }
    
    function getGroupData(string memory groupName) public view returns(Group memory) {
        return groups[groupName];
    }
    function getParticipantData(address addr) public view returns(Participant memory) {
        return participants[addr];
    }
}