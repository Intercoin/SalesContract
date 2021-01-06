// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.7.0;
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
        answer = 100e8;
        startedAt = 0;
        updatedAt = 0;
        answeredInRound = 0;
    }


}