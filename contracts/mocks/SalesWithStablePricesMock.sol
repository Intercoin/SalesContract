// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "../SalesWithStablePrices.sol";

contract SalesWithStablePricesMock is SalesWithStablePrices {
    function setTotalAmountRaised(uint256 input) public {
        totalAmountRaised = input;
    }

    bytes16 mockPrice; // ABDKMathQuad
    bool useCustomPrice;
    function setPrice(uint112 num, uint112 den) public {
        //mockPrice = FixedPoint.fraction(num, den);
        useCustomPrice = true;
        mockPrice = ABDKMathQuad.mul(
            ABDKMathQuad.fromUInt(num),
            ABDKMathQuad.fromUInt(den)
        );
    }
    function setupUsingMockPrice(bool b) public {
        useCustomPrice = b;
    }

    function getPrice() internal view override returns(bytes16) {
        return useCustomPrice ? mockPrice : super.getPrice();
    }

    function getCustomTwoPrices() public view returns(bytes16, bytes16) {
        return (mockPrice, super.getPrice());
    }
}