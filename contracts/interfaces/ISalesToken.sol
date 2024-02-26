// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ISalesStructs.sol";
import "@intercoin/whitelist/contracts/interfaces/IWhitelist.sol";

interface ISalesToken is ISalesStructs {
    /**
     * @param _payToken address of token's pay
     * @param _sellingToken address of ITR token
     * @param _priceSettings PriceSettings struct's array
     *  uint64 timestamp timestamp
     *  uint256 price price exchange
     *  uint256 amountRaised raised amount
     * @param _endTime after this time exchange stop
     * @param _bonusSettings ThresholdBonuses struct's array
     *  uint256 threshold thresholds
     *  uint256 bonus bonuses
     * @param _ownerCanWithdraw enum option where:
     *  0 -owner can not withdraw tokens
     *  1 -owner can withdraw tokens only after endTimePassed
     *  2 -owner can withdraw tokens anytime
     * @param _whitelistData whitelist data struct
     *  address contractAddress;
	 *	bytes4 method;
	 *	uint8 role;
     *  bool useWhitelist;
     * @param _lockedInPrice lockedInPrice struct
     *  uint256 minimumLockedInAmount Minimum amount required to buy and hold the price.
     *  uint256 maximumLockedInAmount Maximum amount available to buy at the held price.
     * @param _costManager costmanager address
     */
     function init(
        address _payToken,
        address _sellingToken,
        PriceSettings[] memory _priceSettings,
        uint64 _endTime,
        ThresholdBonuses[] memory _bonusSettings,
        EnumWithdraw _ownerCanWithdraw,
        IWhitelist.WhitelistStruct memory _whitelistData,
        LockedInPrice memory _lockedInPrice,
        address _costManager,
        address _producedBy
    ) external;
    
}
