// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./interfaces/IFundContractToken.sol";
import "./FundContractBase.sol";

contract FundContractToken is FundContractBase, IFundContractToken {
    address internal payToken;
    
    /**
     * @param _payToken address of ITR token
     * @param _sellingToken address of ITR token
     * @param _timestamps array of timestamps
     * @param _prices price exchange
     * @param _endTime after this time exchange stop
     * @param _thresholds thresholds
     * @param _bonuses bonuses
     */
     function init(
        address _payToken,
        address _sellingToken,
        uint256[] memory _timestamps,
        uint256[] memory _prices,
        uint256 _endTime,
        uint256[] memory _thresholds,
        uint256[] memory _bonuses
    ) 
        public
        initializer
        override
    {
        __FundContractBase__init(
            _sellingToken, 
            _timestamps,
            _prices,
            _endTime,
            _thresholds,
            _bonuses
        );
        
        __FundContractToken__init(_payToken);
    }
    
    function __FundContractToken__init(
        address _payToken
    ) 
        internal 
        initializer
    {
        
        require(_payToken != address(0), 'FundContractToken: _payToken can not be zero');
        payToken = _payToken;
        
    }
    
    /**
     * exchange eth to token via ratios ETH/<token>
     */
    receive() external payable validGasPrice nonReentrant() {
        revert("not support");
       _exchange(msg.value);
        
    }
    
    function buy(uint256 amount) public {
        
        bool success = IERC20Upgradeable(payToken).transferFrom(_msgSender(), address(this), amount); 
        require(success == true, 'Transfer tokens were failed'); 
        
        _exchange(amount); 
    }
    /**
     * @param amount amount of eth
     * @param addr address to send
     */
    function _claim(uint256 amount, address addr) internal override {
        
        require(IERC20Upgradeable(payToken).balanceOf(address(this)) >= amount, 'Amount exceeds allowed balance');
        require(addr != address(0), 'address can not be empty');
        
        bool success = IERC20Upgradeable(payToken).transfer(addr, amount); 
        require(success == true, 'Transfer tokens were failed'); 
        
    }
    
    function getContractTotalAmount() internal virtual override returns(uint256) {
        return IERC20Upgradeable(payToken).balanceOf(address(this));
    }
    
}
