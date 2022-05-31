// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./FundContract.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "./libs/FixedPoint.sol";

contract FundContractAggregator is FundContract {
    using FixedPoint for *;
    
    uint256 internal ethDenom;
    
    address immutable token0 = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address immutable token1 = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address immutable factory = 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;
    address uniswapV2Pair;
    
    uint256 price;
    
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
        
        __FundContractAggregator__init();
    }
    
    function __FundContractAggregator__init(
    ) 
        internal 
        initializer
    {
        ethDenom = 1*10**18;
        
        uniswapV2Pair = IUniswapV2Factory(factory).getPair(token0, token1);
         // (10**18*(r0<<112)/r1)>>112
        // pair 0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc
        // usdt eth 
        // 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
        // 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
        
    }
    /**
     * exchange eth to token via ratios ETH/<token>
     */
    receive() external payable override validGasPrice nonReentrant() {
        _exchange(getUSDFromETH(msg.value));
    }
    
    function getPrice() internal view returns(FixedPoint.uq112x112 memory price_) {
        uint112 reserve0;
        uint112 reserve1;
        
        (reserve0, reserve1, ) = IUniswapV2Pair(uniswapV2Pair).getReserves();
        if (reserve0 == 0 || reserve1 == 0) {
            // Exclude case when reserves are empty
        } else {
            
            if (token0 == IUniswapV2Pair(uniswapV2Pair).token0()) {
                price_ = FixedPoint.fraction(reserve0,reserve1);
            } else {
                price_ = FixedPoint.fraction(reserve1,reserve0);
            }
        
        }

    }
    
    function getUSDFromETH(uint256 amount) internal view returns(uint256 convertedAmount) {
        
        convertedAmount = 1e2*(getPrice().mul(amount)).decode144();
        
    }
 
}
