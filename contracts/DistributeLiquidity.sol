
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

// import "@intercoin/minimums/contracts/MinimumsBase.sol";

import "@intercoin/liquidity/contracts/interfaces/ILiquidityLib.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";


import "hardhat/console.sol";

contract DistributeLiquidity {
    address public immutable token0;
    address public immutable token1;

    ILiquidityLib liquidityLib;

    address public immutable uniswapV2Router;
    address public immutable uniswapV2Factory;

    address internal immutable uniswapWrappedNative;
    address internal immutable uniswapPair;

    bool immutable token01;

    receive() payable external{

    }

    constructor (
        address token0_, 
        address token1_,
        address liquidityLib_
    ) {
        require(liquidityLib_ != address(0), "zero address");

        liquidityLib = ILiquidityLib(liquidityLib_);

        (uniswapV2Router, uniswapV2Factory) = liquidityLib.uniswapSettings();
        
        token0 = token0_;
        token1 = token1_;
        
        uniswapWrappedNative = IUniswapV2Router02(uniswapV2Router).WETH();
        uniswapPair = IUniswapV2Factory(uniswapV2Factory).getPair(token0, token1);
        token01 = IUniswapV2Pair(uniswapPair).token0() == token0 ? true : false;

    }

    

    function addLiquidity() public {
        // getting all native coin on address(this)
        uint256 balanceNative = address(this).balance;

        address[] memory path = new address[](2);    
        path[0] = uniswapWrappedNative;
        path[1] = token1;

        uint[] memory amounts = IUniswapV2Router02(uniswapV2Router).swapExactETHForTokens{value: balanceNative}(
            0,              //uint amountOutMin, 
            path,           //address[] calldata path, 
            address(this),  //address to, 
            block.timestamp //uint deadline
        );

        uint256 token1ToSwap;
        uint256 token1ToLiq;
        uint256 token0ToLiq;

        uint256 reserve0;
        uint256 reserve1;
        
        (reserve0, reserve1,) = IUniswapV2Pair(uniswapPair).getReserves();
        if (token01) {
            // means reserve0 is amount of token0
        } else {
            (reserve0, reserve1)= (reserve1, reserve0);
        }
        
        uint256 input1 = amounts[0];
        (token1ToSwap, token1ToLiq, token0ToLiq) = liquidityLib.calculateSellTradedAndLiquidity(reserve1, reserve0, input1);

        address[] memory path2 = new address[](2);  
        path2[0] = token1;
        path2[1] = token0;
console.log("path[0]", path2[0]);
console.log("path[1]", path2[1]);
        IUniswapV2Pair(token1).approve(uniswapV2Router, token1ToSwap);
        IUniswapV2Router02(uniswapV2Router).swapExactTokensForTokens(
            token1ToSwap,   //uint amountIn,
            0,              //uint amountOutMin, 
            path2,          //address[] calldata path, 
            address(this),  //address to, 
            block.timestamp //uint deadline
        );
// balances need to be checked here
        IUniswapV2Pair(token0).approve(uniswapV2Router, token0ToLiq);
        IUniswapV2Pair(token1).approve(uniswapV2Router, token1ToLiq);
        IUniswapV2Router02(uniswapV2Router).addLiquidity(
            token0,         // address tokenA,
            token1,         // address tokenB,
            token0ToLiq,    // uint amountADesired,
            token1ToLiq,    // uint amountBDesired,
            0,              // uint amountAMin,
            0,              // uint amountBMin,
            address(this),  // address to,
            block.timestamp // uint deadline
        );// external returns (uint amountA, uint amountB, uint liquidity);



        //returns (uint[] memory amounts);
        // convert into the wrappedNativeCoin_
//uint256 tmp = liquidityLib.
    }

}