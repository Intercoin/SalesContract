const helperUsdc = require('./usdcAddress.js');
const helperWrapper = require('./wrapperAddress.js');
function getArguments(){
    return [
        // * @param _commonSettings CommonSettings data struct
        // *  address sellingToken address of ITR token
        // *  address token0 USD Coin
        // *  address token1 Wrapped token (WETH,WBNB,...)
        // *  address liquidityLib liquidityLib address(see intercoin/liquidity pkg)
        // *  uint64 endTime after this time exchange stop
        [
            "0x1117d11930a11d2e36eff79e47ac92d25551b155",
            helperUsdc.getUSDCAddress(),//"0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
            helperWrapper.getWrapperAddress(),//"0x55d398326f99059ff775485246999027b3197955",
            "0x1ea4c4613a4dfdaeeb95a261d11520c90d5d6252",
            1798761600  // 1 Jan 2027
        ],
        // * @param _priceSettings PriceSettings struct's array
        // *  uint64 timestamp timestamp
        // *  uint256 price price exchange
        // *  uint256 amountRaised raised amount 
        [
            //0.05$ - first 10 mil
            //0.10$ - 10-20 mil
            //0.20$ - 20-30 mil
            //0.40$ - 30-40 mil
            //1.00$ - 40-50 mil
            [1719792000, 500000000, "0"],
            [0, 1000000000, "0x845951614014880000000"],
            [0, 2000000000, "0x108b2a2c28029100000000"],
            [0, 4000000000, "0x18d0bf423c03d900000000"],
            [0, 10000000000, "0x2116545850052200000000"]
        ],
        // * @param _bonusSettings ThresholdBonuses struct's array
        // *  uint256 threshold thresholds
        // *  uint256 bonus bonuses
        [[0,0],["0x2b5e3af16b1880000",25],["0x56bc75e2d63100000",50],["0x56bc75e2d63100000",75],["0x15af1d78b58c400000",100]],
        // * @param _ownerCanWithdraw enum option where:
        // *  0 -owner can not withdraw tokens
        // *  1 -owner can withdraw tokens only after endTimePassed
        // *  2 -owner can withdraw tokens anytime
            2,
        // * @param _whitelistData whitelist data struct
        // *  address contractAddress;
        // *	bytes4 method;
        // *	uint8 role;
        ["0x0000000000000000000000000000000000000000","0x00000000",0,true],
        // * @param _lockedInPrice lockedInPrice struct
        // *  uint256 _minimumLockedInAmount Minimum amount required to buy and hold the price.
        // *  uint256 _maximumLockedInAmount Maximum amount available to buy at the held price.
        // Well, in that case let’s make it 100,000 tokens and 3 million tokens
        ["0x152d02c7e14af6000000","0x27b46536c66c8e0000000"],
        // * @param _compensationSettings compensationSettings data struct		
        // *  uint64 endTime after this time receiving compensation tokens will be disabled
        [   // 1 July 2025
            1751328000
        ]
    ];
}
module.exports = {
    getArguments
}