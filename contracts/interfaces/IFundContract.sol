// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFundContract {
    /**
     * @param _sellingToken address of ITR token
     * @param _timestamps array of timestamps
     * @param _prices price exchange
     * @param _endTime after this time exchange stop
     * @param _thresholds thresholds
     * @param _bonuses bonuses
     * @param _useWhitelist if true than buyer need to be in a whitelist before buy
     * @param _costManager costmanager address
     */
     function init(
        address _sellingToken,
        uint256[] memory _timestamps,
        uint256[] memory _prices,
        uint256 _endTime,
        uint256[] memory _thresholds,
        uint256[] memory _bonuses,
        bool _useWhitelist,
        address _costManager,
        address _producedBy
    ) external;
    
}
