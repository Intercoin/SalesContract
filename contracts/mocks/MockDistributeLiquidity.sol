// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../DistributeLiquidity.sol";

contract MockDistributeLiquidity is DistributeLiquidity {
    
    constructor (
        address token0, 
        address token1,
        address liquidityLib
    ) 
        DistributeLiquidity(token0, token1, liquidityLib) 
    {
    }

    // function getLiquidityLibAddress() internal view virtual override returns(address) {
    //     return address(0);
    // }

}
