// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";

import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";

contract FundContract is OwnableUpgradeSafe, ReentrancyGuardUpgradeSafe {
    using SafeMath for uint256;
    
    AggregatorV3Interface internal priceFeed;
    
    address internal sellingToken;
    address internal chainLink;
    uint256[] internal timestamps;
    uint256[]  internal prices;
    uint256 internal endTime;
    
    uint256 internal maxGasPrice;

    modifier validGasPrice() {
        require(tx.gasprice <= maxGasPrice, "Transaction gas price cannot exceed maximum gas price.");
        _;
    } 
    
    /**
     * Network: Mainnet
     * Aggregator: ETH/USD
     * Address: 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
     * @param _sellingToken address of ITR token
     * @param _chainLink aggregator's address
     * @param _timestamps array of times
     * @param _prices price exchange
     * @param _endTime aftert this time withdraw should be enable and exchange stop
     */
    constructor(
        address _sellingToken,
        address _chainLink, 
        uint256[] memory _timestamps,
        uint256[] memory _prices,
        uint256 _endTime
    ) 
        public 
    {
        
        __Ownable_init();
        __ReentrancyGuard_init();
        
        require(_sellingToken != address(0), 'token can not be zero');
        require(_chainLink != address(0), 'token can not be zero');
        
        maxGasPrice = 1*10**18; 
        sellingToken = _sellingToken;
        chainLink = _chainLink;
        timestamps = _timestamps;
        prices = _prices;
        endTime = _endTime;
        
        
        priceFeed = AggregatorV3Interface(_chainLink);
        
    }
    
    
    /**
     * Returns the latest price
     */
    function getLatestPrice() public view returns (int) {
        (
            uint80 roundID, 
            int price,
            uint startedAt,
            uint timeStamp,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        return price;
    }
    
    /**
     * data which contract was initialized
     */
    function getConfig(
    ) 
        public 
        view returns ( 
            address _sellingToken,
            address _chainLink, 
            uint256[] memory _timestamps,
            uint256[] memory _prices,
            uint256 _endTime
        ) 
    {
        _sellingToken = sellingToken;
        _chainLink = chainLink;
        _timestamps = timestamps;
        _prices = prices;
        _endTime = endTime;
    }
    
    /**
     * exchange eth to token via ratios ETH/USD andd USD/<token>
     */
    receive() external payable validGasPrice nonReentrant() {
        
        require(endTime > now, 'exchange time is over');
        
        int256 latestPrice = getLatestPrice(); // mul 1e8
        require(latestPrice > 0, 'latestPrice need to be more than zero');
        //msg.value
        
        // usd -> itr
        uint256 amount2send = (msg.value).
                                        mul(uint256(latestPrice)).
                                        div(getExchangePriceUSD())
                                        ;
                                        // pass mul(1e8).div(1e8) 
                                        // it's multipliers for latestPrice and exchangeRateUSD(1e8*1e8)
                                        
        require(amount2send > 0 , 'can not calculate amount of tokens');                                       
        uint256 tokenBalance = IERC20(sellingToken).balanceOf(address(this));
        require(tokenBalance >= amount2send, 'Amount exceeds allowed balance');
        
        bool success = IERC20(sellingToken).transfer(_msgSender(), amount2send);
        require(success == true, 'Transfer tokens were failed'); 
    }

    /**
     * withdaw some tokens to address
     * @param amount amount of tokens
     * @param addr address to send
     */
    function withdraw(uint256 amount, address addr) public onlyOwner {
        _withdraw(amount, addr);
    }
    
    /**
     * withdaw all tokens to owner
     */
    function withdraw() public onlyOwner {
        _withdraw(IERC20(sellingToken).balanceOf(address(this)), _msgSender());
    }
    
    /**
     * @param amount amount of eth
     * @param addr address to send
     */
    function claim(uint256 amount, address addr) public onlyOwner {

        require(address(this).balance >= amount, 'Amount exceeds allowed balance');
        require(addr != address(0), 'address can not be empty');
        
        address payable addr1 = payable(addr); // correct since Solidity >= 0.6.0
        bool success = addr1.send(amount);
        require(success == true, 'Transfer ether was failed'); 
    }
    
    
    /**
     * get exchange rate USD -> sellingToken
     */
    function getExchangePriceUSD() public view returns (uint256 price) {
        uint256 ts = timestamps[0];
        price = prices[0];
        for (uint256 i = 0; i < timestamps.length; i++) {
            if (now >= timestamps[i]) {
                ts = timestamps[i];
                price = prices[i];
            }
        }
        
    }
    
    /**
     * @param amount amount of tokens
     * @param addr address to send
     */
    function _withdraw(uint256 amount, address addr) internal {
        require(endTime <= now, 'withdraw available after `endTime` expired');
        uint256 tokenBalance = IERC20(sellingToken).balanceOf(address(this));
        require(tokenBalance >= amount, 'Amount exceeds allowed balance');
        
        require(addr != address(0), 'address can not be empty');
        
        bool success = IERC20(sellingToken).transfer(addr, amount);
        require(success == true, 'Transfer tokens were failed'); 
    }
    
    
}
