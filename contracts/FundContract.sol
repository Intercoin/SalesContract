// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./interfaces/IFundContract.sol";
import "./FundContractBase.sol";

contract FundContract is FundContractBase, IFundContract {
        
    /**
     * @param _sellingToken address of ITR token
     * @param _timestamps array of timestamps
     * @param _prices price exchange
     * @param _endTime after this time exchange stop
     * @param _thresholds thresholds
     * @param _bonuses bonuses
     */
     function init(
        address _sellingToken,
        uint256[] memory _timestamps,
        uint256[] memory _prices,
        uint256 _endTime,
        uint256[] memory _thresholds,
        uint256[] memory _bonuses
    ) 
        public
        virtual
        override
        initializer
    {
        __FundContract__init(
            _sellingToken, 
            _timestamps,
            _prices,
            _endTime,
            _thresholds,
            _bonuses
        );
    }
    
    function __FundContract__init(
        address _sellingToken,
        uint256[] memory _timestamps,
        uint256[] memory _prices,
        uint256 _endTime,
        uint256[] memory _thresholds,
        uint256[] memory _bonuses
    ) 
        internal 
        initializer
    {
        
        __FundContractBase__init(
            _sellingToken, 
            _timestamps,
            _prices,
            _endTime,
            _thresholds,
            _bonuses
        );
        
    }
    
    /**
     * exchange eth to token via ratios ETH/<token>
     */
    receive() external payable virtual validGasPrice nonReentrant() {
        
       _exchange(msg.value);
        
    }
    
    /**
     * @param amount amount of eth
     * @param addr address to send
     */
    function _claim(uint256 amount, address addr) internal override {
        
        require(address(this).balance >= amount, 'Amount exceeds allowed balance');
        require(addr != address(0), 'address can not be empty');
        
        address payable addr1 = payable(addr); // correct since Solidity >= 0.6.0
        bool success = addr1.send(amount);
        require(success == true, 'Transfer ether was failed'); 
    }
    
    function getContractTotalAmount() internal virtual override returns(uint256) {
        return address(this).balance;
    }
    
}
