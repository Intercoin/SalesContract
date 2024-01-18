// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IERC20Burnable.sol";

contract MockTransferContract {
    function sendTokens(address token, address to, uint256 amount) external {
        IERC20(token).transfer(to, amount);
    }

    function burnOwnTokens(address token, uint256 amount) external {
        IERC20Burnable(token).burn(amount);
    }

}