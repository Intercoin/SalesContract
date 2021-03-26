// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract Aggregator {
    
    function latestRoundData(
    )
        public
        view
        returns (
          uint80 roundId,
          int256 answer,
          uint256 startedAt,
          uint256 updatedAt,
          uint80 answeredInRound
        )
    {
        roundId = 0;
        //answer = 100e8;
        
        answer = 123429e6; //1234,29 * 1e8
        startedAt = 0;
        updatedAt = 0;
        answeredInRound = 0;
    }

}