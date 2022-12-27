// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@artman325/releasemanager/contracts/CostManagerHelperERC2771Support.sol";

abstract contract FundContractBase is OwnableUpgradeable, CostManagerHelperERC2771Support, ReentrancyGuardUpgradeable {

    address public sellingToken;
    uint256[] public timestamps;
    uint256[] public prices;
    uint256 public endTime;

    bool public useWhitelist;

    uint256 internal constant maxGasPrice = 1*10**18; 

    uint256 internal constant priceDenom = 100000000;//1*10**8;

    uint8 internal constant OPERATION_SHIFT_BITS = 240;  // 256 - 16
    // Constants representing operations
    uint8 internal constant OPERATION_INITIALIZE = 0x0;
    uint8 internal constant OPERATION_BUY = 0x1;
    uint8 internal constant OPERATION_WITHDRAW = 0x1;
    uint8 internal constant OPERATION_WITHDRAW_ALL = 0x2;
    uint8 internal constant OPERATION_CLAIM = 0x3;
    uint8 internal constant OPERATION_CLAIM_ALL = 0x4;
    uint8 internal constant OPERATION_SETGROUP = 0x5;
    uint8 internal constant OPERATION_SET_TRUSTED_FORWARDER = 0x6;
    uint8 internal constant OPERATION_TRANSFER_OWNERSHIP = 0x7;

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
    mapping(address => uint256) totalInvestedGroupOutside;
    mapping(address => bool) public whitelist;
    
    uint256[] thresholds; // count in ETH
    uint256[] bonuses;// percents mul by 100
    
    event Exchange(address indexed account, uint256 amountIn, uint256 amountOut);
    event GroupBonusAdded(string indexed groupName, uint256 ethAmount, uint256 tokenPrice);
    event Claimed(uint256 amount, address addr);
    event Withdrawn(uint256 amount, address addr);

    error ForwarderCanNotBeOwner();
    error DeniedForForwarder();
    error NotSupported();
    error WhitelistError();
    error TransferTokensFailed();
    error AmountExceededAllowedBalance();
    error AmountInvalid();
    error AddressInvalid();
    error GroupNameInvalid();
    error TransactionGasPriceCanNotExceed(uint256 maxGasPrice);
    error SellingTokenCanNotBeZero();
    error ExchangeTimeIsOver(uint256 time);
    error CantCalculateAmountOfTokens();

    modifier validGasPrice() {
        if (tx.gasprice > maxGasPrice) {
            revert TransactionGasPriceCanNotExceed(maxGasPrice);
        }
        _;
    } 

    function whitelistAdd(
        address account
    ) 
        external
        onlyOwner
    {
        whitelist[account] = true;
    }

    function whitelistRremove(
        address account
    ) 
        external
        onlyOwner
    {
        delete whitelist[account];
    }

    /**
     * data which contract was initialized
     */
    function getConfig(
    ) 
        external 
        view 
        returns ( 
            address _sellingToken, 
            uint256[] memory _timestamps,
            uint256[] memory _prices,
            uint256 _endTime,
            uint256[] memory _thresholds,
            uint256[] memory _bonuses
        ) 
    {
        _sellingToken = sellingToken;
        _timestamps = timestamps;
        _prices = prices;
        _endTime = endTime;
        _thresholds = thresholds;
        _bonuses = bonuses;
    }
    
    /**
     * withdraw some tokens to address
     * @param amount amount of tokens
     * @param addr address to send
     */
    function withdraw(uint256 amount, address addr) public onlyOwner {
        _sendTokens(amount, addr);

        emit Withdrawn(amount, addr);
        _accountForOperation(
            OPERATION_WITHDRAW << OPERATION_SHIFT_BITS,
            uint256(uint160(addr)),
            amount
        );
    }
    
    /**
     * withdraw all tokens to owner
     */
    function withdrawAll() public onlyOwner {
        uint256 amount = IERC20Upgradeable(sellingToken).balanceOf(address(this));

        emit Withdrawn(amount, _msgSender());
        _sendTokens(amount, _msgSender());

        _accountForOperation(
            OPERATION_WITHDRAW_ALL << OPERATION_SHIFT_BITS,
            uint256(uint160(_msgSender())),
            amount
        );
    }
    
    /**
     * @param amount amount of eth
     * @param addr address to send
     */
    function claim(uint256 amount, address addr) public onlyOwner {
        _claim(amount, addr);
        emit Claimed(amount, addr);
        _accountForOperation(
            OPERATION_CLAIM << OPERATION_SHIFT_BITS,
            uint256(uint160(addr)),
            amount
        );
    }
    
    /**
     * @param addresses array of addresses which need to link with group
     * @param groupName group name. if does not exists it will be created
     */
    function setGroup(address[] memory addresses, string memory groupName) public onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            _setGroup(addresses[i], groupName);
        }
        
        _accountForOperation(
            OPERATION_SETGROUP << OPERATION_SHIFT_BITS,
            0,
            0
        );
    }
    
    /**
     * claim all eth to owner(sender)
     */
    function claimAll() public onlyOwner {
        uint256 amount = getContractTotalAmount();
        _claim(amount, _msgSender());

        emit Claimed(amount, _msgSender());

        _accountForOperation(
            OPERATION_CLAIM_ALL << OPERATION_SHIFT_BITS,
            uint256(uint160(_msgSender())),
            amount
        );
    }
    
    /**
     * get exchange rate ETH -> sellingToken
     */
    function getTokenPrice() public view returns (uint256 price) {
        uint256 ts = timestamps[0];
        price = prices[0];
        for (uint256 i = 0; i < timestamps.length; i++) {
            if (block.timestamp >= timestamps[i] && timestamps[i]>=ts) {
                ts = timestamps[i];
                price = prices[i];
            }
        }
        
    }
    
    /**
     * @param groupName group name
     */
    function getGroupBonus(string memory groupName) public view returns(uint256 bonus) {
        return _getGroupBonus(groupName);
    }
    
    function setTrustedForwarder(
        address forwarder
    ) 
        public 
        virtual
        override
        onlyOwner 
    {
        if (owner() == forwarder) {
            revert ForwarderCanNotBeOwner();
        }
        _setTrustedForwarder(forwarder);

        _accountForOperation(
            OPERATION_SET_TRUSTED_FORWARDER << OPERATION_SHIFT_BITS,
            uint256(uint160(_msgSender())),
            uint256(uint160(forwarder))
        );
    }

    function transferOwnership(
        address newOwner
    ) public 
        virtual 
        override 
        onlyOwner 
    {
        if (_isTrustedForwarder(msg.sender)) {
            revert DeniedForForwarder();
        }
        if (_isTrustedForwarder(newOwner)) {
            _setTrustedForwarder(address(0));
        }
        super.transferOwnership(newOwner);
        _accountForOperation(
            OPERATION_TRANSFER_OWNERSHIP << OPERATION_SHIFT_BITS,
            uint256(uint160(_msgSender())),
            uint256(uint160(newOwner))
        );
    }

    function __FundContractBase__init(
        address _sellingToken,
        uint256[] memory _timestamps,
        uint256[] memory _prices,
        uint256 _endTime,
        uint256[] memory _thresholds,
        uint256[] memory _bonuses,
        bool _useWhitelist,
        address _costManager
    ) 
        internal 
        onlyInitializing
    {
        
        __CostManagerHelper_init(_msgSender());
        _setCostManager(_costManager);

        __Ownable_init();
        __ReentrancyGuard_init();
        
        if (_sellingToken == address(0)) {
            revert SellingTokenCanNotBeZero();
        }
        
        sellingToken = _sellingToken;
        timestamps = _timestamps;
        prices = _prices;
        endTime = _endTime;
        thresholds = _thresholds;
        bonuses = _bonuses;
        useWhitelist = _useWhitelist;
    }
    
    function _exchange(uint256 inputAmount) internal {
        address sender = _msgSender();
        
        if (useWhitelist && !whitelist[sender]) {
            revert WhitelistError();
        }

        if (endTime <= block.timestamp) {
            revert ExchangeTimeIsOver(endTime);
        }
        
        uint256 tokenPrice = getTokenPrice();
        
        uint256 amount2send = _getTokenAmount(inputAmount, tokenPrice);
        if (amount2send == 0) {
            revert CantCalculateAmountOfTokens();
        }
                                
        uint256 tokenBalance = IERC20Upgradeable(sellingToken).balanceOf(address(this));
        if (tokenBalance < amount2send) {
            revert AmountExceededAllowedBalance();
        }
        
        bool success = IERC20Upgradeable(sellingToken).transfer(sender, amount2send);
        if (!success) {
            revert TransferTokensFailed();
        }
        
        emit Exchange(sender, inputAmount, amount2send);
        // bonus calculation
        _addBonus(
            _msgSender(), 
            (inputAmount),
            tokenPrice
        );
        
    }
    
    function _msgSender(
    ) 
        internal 
        view 
        virtual
        override(TrustedForwarder, ContextUpgradeable)
        returns (address signer) 
    {
        return TrustedForwarder._msgSender();
        
    }

    function _getGroupBonus(string memory groupName) internal view returns(uint256 bonus) {
        bonus = 0;
        
        if (groups[groupName].exists == true) {
            uint256 groupTotalAmount = groups[groupName].totalAmount;
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
     * calculate token's amount
     * @param amount amount in eth that should be converted in tokenAmount
     * @param price token price
     */
    function _getTokenAmount(uint256 amount, uint256 price) internal pure returns (uint256) {
        return amount * priceDenom / price;
    }
    
    /**
     * @param amount amount of eth
     * @param addr address to send
     */
    function _claim(uint256 amount, address addr) internal virtual;
    // function _claim(uint256 amount, address addr) internal {
        
    //     require(address(this).balance >= amount, "Amount exceeds allowed balance");
    //     require(addr != address(0), "address can not be empty");
        
    //     address payable addr1 = payable(addr); // correct since Solidity >= 0.6.0
    //     bool success = addr1.send(amount);
    //     require(success == true, "Transfer ether was failed"); 
    // }
    
    /**
     * @param amount amount of tokens
     * @param addr address to send
     */
    function _sendTokens(uint256 amount, address addr) internal {

        if (amount == 0) {
            revert AmountInvalid();
        }
        if (addr == address(0)) {
            revert AddressInvalid();
        }
        
        uint256 tokenBalance = IERC20Upgradeable(sellingToken).balanceOf(address(this));
        if (tokenBalance < amount) {
            revert AmountExceededAllowedBalance();
        }
        
        bool success = IERC20Upgradeable(sellingToken).transfer(addr, amount);
        if (!success) {
            revert TransferTokensFailed();
        }
    }
    
    /**
     * @param addr address which need to link with group
     * @param groupName group name. if does not exists it will be created
     */
    function _setGroup(address addr, string memory groupName) internal {
        
        if (addr == address(0)) {
            revert AddressInvalid();
        }
        if (bytes(groupName).length == 0) {
            revert GroupNameInvalid();
        }
        uint256 tokenPrice = getTokenPrice();
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
            
            if (totalInvestedGroupOutside[addr] > 0) {
                _addBonus(
                    addr,
                    totalInvestedGroupOutside[addr],
                    tokenPrice
                );
            }
            
        }
    }
    
    /**
     * calculate user bonus tokens and send it to him
     * @param addr Address of participant
     * @param ethAmount amount
     * @param tokenPrice price ratio ETH -> token
     */
    function _addBonus(
        address addr, 
        uint256 ethAmount,
        uint256 tokenPrice
    ) 
        internal 
    {

        if (participants[addr].exists == true) {
            
            string memory groupName = participants[addr].groupName;
            
            groups[groupName].totalAmount +=  ethAmount;
            participants[addr].totalAmount += ethAmount;    
            
            //// send tokens
            uint256 groupBonus = _getGroupBonus(groupName);
            address participantAddr;
            uint256 participantTotalBonusTokens;
            for (uint256 i = 0; i < groups[groupName].participants.length; i++) {
                participantAddr = groups[groupName].participants[i];

                participantTotalBonusTokens = _getTokenAmount(
                                                                participants[participantAddr].totalAmount, 
                                                                tokenPrice
                                                            ) * groupBonus / 1e2;

                if (participantTotalBonusTokens > participants[participantAddr].contributed) {
                    uint256 amount2Send = participantTotalBonusTokens - participants[participantAddr].contributed;
                    participants[participantAddr].contributed = participantTotalBonusTokens;
                  
                    _sendTokens(amount2Send, participantAddr);
                    
                }
            }

            emit GroupBonusAdded(groupName, ethAmount, tokenPrice);
               
        } else {
            totalInvestedGroupOutside[addr] += ethAmount;    
        }
    }
    
    function getContractTotalAmount() internal view virtual returns(uint256);
}
