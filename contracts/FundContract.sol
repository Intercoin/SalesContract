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
    uint256[] internal prices;
    uint256 internal endTime;
    
    uint256 internal maxGasPrice;
    
    uint256 internal ethDenom;

    struct Participant {
        string groupName;
        uint256 totalAmount;
        uint256 contributed;
        bool exists;
    }
    
    struct Group {
        string name;
        uint256 totalAmount;
        address[] participants;
        bool exists;
    }
    
    mapping(string => Group) groups;
    mapping(address => Participant) participants;
    
    
    uint256[] thresholds; // count in usd (mul by 1e8)
    uint256[] bonuses;// percents mul by 100
    
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
     * @param _timestamps array of timestamps
     * @param _prices price exchange
     * @param _endTime after this time exchange stop
     * @param _thresholds thresholds
     * @param _bonuses bonuses
     */
    constructor(
        address _sellingToken,
        address _chainLink, 
        uint256[] memory _timestamps,
        uint256[] memory _prices,
        uint256 _endTime,
        uint256[] memory _thresholds,
        uint256[] memory _bonuses
    ) 
        public 
    {
        
        __Ownable_init();
        __ReentrancyGuard_init();
        
        require(_sellingToken != address(0), 'token can not be zero');
        require(_chainLink != address(0), 'token can not be zero');
        
        maxGasPrice = 1*10**18; 
        
        ethDenom = 1*10**18;
        
        sellingToken = _sellingToken;
        chainLink = _chainLink;
        timestamps = _timestamps;
        prices = _prices;
        endTime = _endTime;
        thresholds = _thresholds;
        bonuses = _bonuses;
        
        
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
        view 
        returns ( 
            address _sellingToken,
            address _chainLink, 
            uint256[] memory _timestamps,
            uint256[] memory _prices,
            uint256 _endTime,
            uint256[] memory _thresholds,
            uint256[] memory _bonuses
        ) 
    {
        _sellingToken = sellingToken;
        _chainLink = chainLink;
        _timestamps = timestamps;
        _prices = prices;
        _endTime = endTime;
        _thresholds = thresholds;
        _bonuses = bonuses;
    }
    
    /**
     * exchange eth to token via ratios ETH/USD andd USD/<token>
     */
    receive() external payable validGasPrice nonReentrant() {
        
        require(endTime > now, 'exchange time is over');
        
        int256 latestPrice = getLatestPrice(); // mul 1e8
        require(latestPrice > 0, 'latestPrice need to be more than zero');
        //msg.value
        uint256 tokenPrice = getTokenPrice();
        
        // usd -> itr
        uint256 convertedPrice = (msg.value).mul(uint256(latestPrice));
        uint256 amount2send = convertedPrice.div(tokenPrice);

        require(amount2send > 0 , 'can not calculate amount of tokens');                                       
        uint256 tokenBalance = IERC20(sellingToken).balanceOf(address(this));
        require(tokenBalance >= amount2send, 'Amount exceeds allowed balance');
        
        bool success = IERC20(sellingToken).transfer(_msgSender(), amount2send);
        require(success == true, 'Transfer tokens were failed'); 
        
        // bonus calculation
        _addBonus(
            _msgSender(), 
            convertedPrice,
            tokenPrice
        );
        
    }

    /**
     * withdraw some tokens to address
     * @param amount amount of tokens
     * @param addr address to send
     */
    function withdraw(uint256 amount, address addr) public onlyOwner {
        _sendTokens(amount, addr);
    }
    
    /**
     * withdraw all tokens to owner
     */
    function withdrawAll() public onlyOwner {
        _sendTokens(IERC20(sellingToken).balanceOf(address(this)), _msgSender());
    }
    
    /**
     * @param amount amount of eth
     * @param addr address to send
     */
    function claim(uint256 amount, address addr) public onlyOwner {
        _claim(amount, addr);
        
    }
    
    /**
     * @param addresses array of addresses which need to link with group
     * @param groupName group name. if does not exists it will be created
     */
    function setGroup(address[] memory addresses, string memory groupName) public onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            _setGroup(addresses[i], groupName);
        }
    }
    
    /**
     * claim all eth to owner(sender)
     */
    function claimAll() public onlyOwner {
        _claim(address(this).balance, _msgSender());
    }
    
    /**
     * get exchange rate USD -> sellingToken
     */
    function getTokenPrice() public view returns (uint256 price) {
        uint256 ts = timestamps[0];
        price = prices[0];
        for (uint256 i = 0; i < timestamps.length; i++) {
            if (now >= timestamps[i] && timestamps[i]>=ts) {
                ts = timestamps[i];
                price = prices[i];
            }
        }
        
    }
    
    /**
     * @param groupName group name
     */
    function getGroupBonus(string memory groupName) public view returns(uint256 bonus) {
        bonus = 0;
        
        if (groups[groupName].exists == true) {
            uint256 groupTotalAmount = groups[groupName].totalAmount.div(ethDenom);
            uint256 tmp = 0;
            for (uint256 i = 0; i < thresholds.length; i++) {
                if (groupTotalAmount >= thresholds[i] && thresholds[i] >= tmp) {
                    tmp = thresholds[i];
                    bonus = bonuses[i];
                }
            }
        }
    }
    
    /**
     * @param amount amount of eth
     * @param addr address to send
     */
    function _claim(uint256 amount, address addr) internal {
        
        require(address(this).balance >= amount, 'Amount exceeds allowed balance');
        require(addr != address(0), 'address can not be empty');
        
        address payable addr1 = payable(addr); // correct since Solidity >= 0.6.0
        bool success = addr1.send(amount);
        require(success == true, 'Transfer ether was failed'); 
    }
    
    /**
     * @param amount amount of tokens
     * @param addr address to send
     */
    function _sendTokens(uint256 amount, address addr) internal {
        
        require(amount>0, 'Amount can not be zero');
        require(addr != address(0), 'address can not be empty');
        
        uint256 tokenBalance = IERC20(sellingToken).balanceOf(address(this));
        require(tokenBalance >= amount, 'Amount exceeds allowed balance');
        
        bool success = IERC20(sellingToken).transfer(addr, amount);
        require(success == true, 'Transfer tokens were failed'); 
    }
    
    /**
     * @param addr address which need to link with group
     * @param groupName group name. if does not exists it will be created
     */
    function _setGroup(address addr, string memory groupName) internal {
        require(addr != address(0), 'address can not be empty');
        require(bytes(groupName).length != 0, 'groupName can not be empty');
        if (participants[addr].exists == false) {
            participants[addr].exists = true;
            participants[addr].contributed = 0;
            participants[addr].groupName = groupName;
            
            if (groups[groupName].exists == false) {
                groups[groupName].exists = true;
                groups[groupName].name = groupName;
                groups[groupName].totalAmount = 0;
            } 
            
            groups[groupName].participants.push(addr);
        }
    }
    
    /**
     * calculate user bonus tokens and send it to him
     * @param addr Address of participant
     * @param convertedPrice eth.mul(latestPrice) i.e. equivalent in usd (multiplied by ie8(latestPrice) and 1e18(eth denom))
     * @param tokenPrice price ratio usd -> token
     */
    function _addBonus(
        address addr, 
        uint256 convertedPrice,
        uint256 tokenPrice
    ) 
        internal 
    {
        if (participants[addr].exists == true) {
            
            string memory groupName = participants[addr].groupName;
            
            groups[groupName].totalAmount = groups[groupName].totalAmount.add(convertedPrice);
            participants[addr].totalAmount = participants[addr].totalAmount.add(convertedPrice);
            
            //// send tokens
            uint256 groupBonus = getGroupBonus(groupName);
            address participantAddr;
            uint256 bonus2Send;
            uint256 participantTotalBonusTokens;
            for (uint256 i = 0; i < groups[groupName].participants.length; i++) {
                participantAddr = groups[groupName].participants[i];

                participantTotalBonusTokens = participants[participantAddr].totalAmount.
                                                                                mul(groupBonus).
                                                                                div(tokenPrice).
                                                                                div(1e2);

                bonus2Send = participantTotalBonusTokens.sub(participants[participantAddr].contributed);
                if (bonus2Send > 0) {
                    participants[participantAddr].contributed = participantTotalBonusTokens;
                    
                    _sendTokens(bonus2Send, participantAddr);
                }
            }
               
        }
    }
    
}
