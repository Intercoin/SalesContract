// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISalesStructs {
    enum EnumWithdraw {
        never,
        afterEndTime,
        anytime
    }

    struct CommonSettings {
        address sellingToken;
        address token0;
        address token1;
        address liquidityLib;
        uint64 endTime;
        
    }

    struct CompensationSettings {
        uint64 endTime;
    }
    
    struct PriceSettings {
        uint64 timestamp;
        uint256 price;
        uint256 amountRaised;
    }

    struct ThresholdBonuses {
        uint256 threshold;
        uint256 bonus;
    }

    struct LockedInPrice {
        uint256 minimumLockedInAmount;
        uint256 maximumLockedInAmount;
    }

}