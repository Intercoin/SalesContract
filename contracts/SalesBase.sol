// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/token/ERC777/ERC777Upgradeable.sol"; // interface does not contain transfer method needed for erc20 compatible
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@intercoin/releasemanager/contracts/CostManagerHelperERC2771Support.sol";
import "@intercoin/whitelist/contracts/Whitelist.sol";
import "./interfaces/IPresale.sol";
import "./interfaces/ISalesStructs.sol";
import "./interfaces/IERC20Burnable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/IERC1820RegistryUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC777/IERC777RecipientUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC777/IERC777SenderUpgradeable.sol";

import "@intercoin/liquidity/contracts/interfaces/ILiquidityLib.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "abdk-libraries-solidity/ABDKMathQuad.sol";

abstract contract SalesBase is OwnableUpgradeable, CostManagerHelperERC2771Support, ReentrancyGuardUpgradeable, Whitelist, IPresale, ISalesStructs, IERC777RecipientUpgradeable, IERC777SenderUpgradeable {
    using ABDKMathQuad for *;

    address public sellingToken;
    uint64[] public timestamps;
    uint256[] public prices;
    uint256[] public amountRaised;

    uint256[] public commissionFractions;
    address[] public commissionAddresses;
    uint256 public holdTotalFraction;

    /// total income tokens
    uint256 public totalIncome;

    /// total income tokens payed by sendCommission
    uint256 public holdTotalAlreadyPayed;
    /// total income tokens payed by claim
    uint256 public totalIncomeAlreadyClaimed;

    uint64 public _endTime;

    uint256 public totalAmountRaised;
    
    // true if token0 == uniswapPair.token0()
    bool internal token00; 
    address uniswapV2Pair;
    
    uint256 internal constant maxGasPrice = 1*10**18; 

    uint256 internal constant priceDenom = 100000000;//1*10**8;

    uint256 internal constant FRACTION = 10000;

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

    IERC1820RegistryUpgradeable internal constant _ERC1820_REGISTRY = IERC1820RegistryUpgradeable(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);
    bytes32 private constant _TOKENS_SENDER_INTERFACE_HASH = keccak256("ERC777TokensSender");
    bytes32 private constant _TOKENS_RECIPIENT_INTERFACE_HASH = keccak256("ERC777TokensRecipient");

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

    uint256 minimumLockedInAmount;
    uint256 maximumLockedInAmount;
    struct LockedPrice {
        uint256 price;
        uint256 boughtAmount; // bought by locked price
        uint256 totalAmount; // total bought even if not in locked 
        bool exists;
    }
    mapping(address => LockedPrice) lockedPrice;
    
    mapping(string => Group) groups;
    mapping(address => Participant) participants;
    mapping(address => uint256) totalInvestedGroupOutside;
    
    uint256[] thresholds; // count in ETH
    uint256[] bonuses;// percents mul by 100


    EnumWithdraw public withdrawOption;

    event Exchange(address indexed account, uint256 amountIn, uint256 amountOut);
    event GroupBonusAdded(string indexed groupName, uint256 ethAmount, uint256 tokenPrice);
    event Claimed(uint256 amount, address addr);
    event Withdrawn(uint256 amount, address addr);
    event CommissionsWasSent(uint256 amount, address[] addrs);

    error ForwarderCanNotBeOwner();
    error DeniedForForwarder();
    error NotSupported();
    error WithdrawDisabled();
    error WhitelistError();
    error InvalidInput();
    error AddressInvalid();
    error GroupNameInvalid();
    error InsufficientAmount();
    error TransferError();
    error MaxGasPriceExceeded();
    error ExchangeTimeIsOver();
    error ExchangeTimeShouldBePassed();
    error CantCalculateAmountOfTokens();

    modifier validGasPrice() {
        //require(tx.gasprice <= maxGasPrice, "Transaction gas price cannot exceed maximum gas price.");
        if (tx.gasprice > maxGasPrice) {
            revert MaxGasPriceExceeded();
        }
        _;
    } 

    modifier validateWithdraw() {
        _checkOwner();
        if (
            (withdrawOption == EnumWithdraw.never) ||
            (withdrawOption == EnumWithdraw.afterEndTime && block.timestamp <= _endTime)
        ) {
            revert WithdrawDisabled();
        }

        // (withdrawOption == EnumWithdraw.anytime)

        _;
    }

    function __SalesBase__init(
        CommonSettings memory _commonSettings,
        PriceSettings[] memory _priceSettings,
        ThresholdBonuses[] memory _bonusSettings,
        EnumWithdraw _ownerCanWithdraw,
        WhitelistStruct memory _whitelistData,
        LockedInPrice memory _lockedInPrice,
        address _costManager
    ) 
        internal 
        onlyInitializing
    {
        
        __CostManagerHelper_init(_msgSender(), _costManager);

        __Ownable_init();
        __ReentrancyGuard_init();
        
        if (_commonSettings.sellingToken == address(0)) {
            revert InvalidInput();
        }
        
        sellingToken = _commonSettings.sellingToken;

        // setup swap addresses
        address uniswapRouterFactory;
        (, uniswapRouterFactory) = ILiquidityLib(_commonSettings.liquidityLib).uniswapSettings();
        uniswapV2Pair = IUniswapV2Factory(uniswapRouterFactory).getPair(_commonSettings.token0, _commonSettings.token1);

        if (_commonSettings.token0 == IUniswapV2Pair(uniswapV2Pair).token0()) {
            token00 = true;
        } else {
            token00 = false;
        }

        timestamps = new uint64[](_priceSettings.length);
        prices = new uint256[](_priceSettings.length);
        amountRaised = new uint256[](_priceSettings.length);
        for (uint256 i = 0; i<_priceSettings.length; i++) {
            timestamps[i] = _priceSettings[i].timestamp;
            prices[i] = _priceSettings[i].price;
            amountRaised[i] = _priceSettings[i].amountRaised;
        }
        // timestamps = _timestamps;
        // prices = _prices;
        // amountRaised = _amountRaised;
        _endTime = _commonSettings.endTime;

        thresholds = new uint256[](_bonusSettings.length);
        bonuses = new uint256[](_bonusSettings.length);
        for (uint256 i = 0; i < _bonusSettings.length; i++) {
            thresholds[i] = _bonusSettings[i].threshold;
            bonuses[i] = _bonusSettings[i].bonus;
        }
        // thresholds = _thresholds;
        // bonuses = _bonuses;
        
        withdrawOption = _ownerCanWithdraw;

        whitelistInit(_whitelistData);

        minimumLockedInAmount = _lockedInPrice.minimumLockedInAmount;
        maximumLockedInAmount = _lockedInPrice.maximumLockedInAmount;

        // register interfaces
        _ERC1820_REGISTRY.setInterfaceImplementer(address(this), _TOKENS_SENDER_INTERFACE_HASH, address(this));
        _ERC1820_REGISTRY.setInterfaceImplementer(address(this), _TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
    }

    function tokensToSend(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) external {
        
    }

    function tokensReceived(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) external {
        
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
            uint64[] memory _timestamps,
            uint256[] memory _prices,
            uint256[] memory _amountRaised, 
            uint64 _endTs,
            uint256[] memory _thresholds,
            uint256[] memory _bonuses
        ) 
    {
        _sellingToken = sellingToken;
        _timestamps = timestamps;
        _prices = prices;
        _amountRaised = amountRaised;
        _endTs = _endTime;
        _thresholds = thresholds;
        _bonuses = bonuses;
    }

    function endTime() external view returns (uint64) {
        return _endTime;
    }

    function addCommission(uint256 fraction, address account) public onlyOwner {
        if (fraction == 0 || fraction > FRACTION || account == address(0)) {
            revert InvalidInput();
        }
        commissionFractions.push(fraction);
        commissionAddresses.push(account);

        holdTotalFraction += fraction;
    }

    function _exchange(uint256 inputAmount) internal virtual returns(uint256) {
        address sender = _msgSender();

        if (!whitelisted(sender)) { 
            revert WhitelistError(); 
        }

        if (_endTime <= block.timestamp) {
            revert ExchangeTimeIsOver();
        }
    
        // uint256 tokenPrice = getTokenPrice();
        // uint256 amount2send = _getTokenAmount(inputAmount, tokenPrice);

        uint256 totalAmount2Send;
        uint256[2] memory inputAmounts;
        uint256[2] memory tokenPrices;
        uint256[2] memory tokens2Send;

        (totalAmount2Send, inputAmounts, tokenPrices, tokens2Send) = getTokenAmount(sender, inputAmount);

        if (totalAmount2Send == 0) {
            revert CantCalculateAmountOfTokens();
        }

        totalIncome += inputAmount;
        totalAmountRaised += totalAmount2Send;

        uint256 tokenBalance = IERC777Upgradeable(sellingToken).balanceOf(address(this));
        if (tokenBalance < totalAmount2Send) {
            revert InsufficientAmount();
        }

        bool success = ERC777Upgradeable(sellingToken).transfer(sender, totalAmount2Send);
        if (!success) {
            revert TransferError();
        }
        
        emit Exchange(sender, inputAmount, totalAmount2Send);

        // bonus calculation
        // _addBonus(
        //     sender, 
        //     inputAmount,
        //     tokenPrice,
        //     true
        // );

        //compensations
        _exchangeAdditional(sender, totalAmount2Send);
        //----------

        if (inputAmounts[1] != 0 && tokenPrices[1] != 0) {
            if (!lockedPrice[sender].exists) {
                lockedPrice[sender].exists = true;

                lockedPrice[sender].price = tokenPrices[1];
            }
            lockedPrice[sender].boughtAmount += tokens2Send[1];
            
            // we can't exceed maximumLockedInAmount. we calculated it in getTokenAmount
        }
        lockedPrice[sender].totalAmount += totalAmount2Send;

        for(uint256 i = 0; i < inputAmounts.length;  i++) {
            if (inputAmounts[i] != 0 && tokenPrices[i] != 0) {
                _addBonus(
                    sender, 
                    inputAmounts[i],
                    tokenPrices[i],
                    true
                );
            }
        }

        return totalAmount2Send;
    }

    function _exchangeAdditional(address sender, uint256 amount) internal virtual  {}

    
    /**
     * withdraw some tokens to address
     * @param amount amount of tokens
     * @param addr address to send
     */
    function withdraw(uint256 amount, address addr) public validateWithdraw {
        _sendTokens(amount, addr, true);

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
    function withdrawAll() public validateWithdraw {
        uint256 amount = IERC777Upgradeable(sellingToken).balanceOf(address(this));

        emit Withdrawn(amount, _msgSender());
        _sendTokens(amount, _msgSender(), true);

        _accountForOperation(
            OPERATION_WITHDRAW_ALL << OPERATION_SHIFT_BITS,
            uint256(uint160(_msgSender())),
            amount
        );
    }

    /**
     * @notice adding account into a internal whitelist.  worked only if instance initialized with internal whitelist
     */
    function whitelistAdd(address account) public onlyOwner {
        _validateWhitelistForInternalUse();
        _whitelistAdd(account);
    }

    /**
     * @notice removing account from a internal whitelist.  worked only if instance initialized with internal whitelist
     */
    function whitelistRemove(address account) public onlyOwner {
        _validateWhitelistForInternalUse();
        _whitelistRemove(account);
    }
    
    /**
     * @param amount amount of eth
     * @param addr address to send
     */
    function claim(uint256 amount, address addr) public onlyOwner {
        uint256 amountAvailableToClaim = availableToClaim();
        if (amountAvailableToClaim < amount) {
            revert InsufficientAmount();
        }
        totalIncomeAlreadyClaimed += amount;

        _claim(amount, addr);
        emit Claimed(amount, addr);
        _accountForOperation(
            OPERATION_CLAIM << OPERATION_SHIFT_BITS,
            uint256(uint160(addr)),
            amount
        );
    }

    /**
     * @notice send commission to the addresses `commissionAddresses`
     */
    function sendCommissions() public nonReentrant {
        if (_endTime >= block.timestamp) {
            revert ExchangeTimeShouldBePassed();
        }

        uint256 totalIncomeLeftToPaid = totalIncome - holdTotalAlreadyPayed;
        holdTotalAlreadyPayed += totalIncome;

        uint256 amount2send = (totalIncomeLeftToPaid*holdTotalFraction/FRACTION);

        if (amount2send == 0) {
            revert InsufficientAmount();
        }
        
        for (uint256 i = 0; i<commissionAddresses.length; i++) {
            _claim(
                totalIncomeLeftToPaid * commissionFractions[i] / FRACTION, 
                commissionAddresses[i]
            );
        }

        emit CommissionsWasSent(amount2send, commissionAddresses);
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
        uint256 amount = availableToClaim();
        totalIncomeAlreadyClaimed += amount;
        _claim(amount, _msgSender());
        emit Claimed(amount, _msgSender());

        _accountForOperation(
            OPERATION_CLAIM_ALL << OPERATION_SHIFT_BITS,
            uint256(uint160(_msgSender())),
            amount
        );
    }

    /**
     * burn all unsold tokens. used only if initialised with (withdrawOption == EnumWithdraw.never)
     */
    function burnAllUnsoldTokens() public {
        if (withdrawOption != EnumWithdraw.never) {
            revert NotSupported();
        }
        if (_endTime >= block.timestamp) {
            revert ExchangeTimeShouldBePassed();
        }
        
        uint256 tokenBalance = IERC777Upgradeable(sellingToken).balanceOf(address(this));
        if (tokenBalance > 0) {

             // create a low level call to the token
            (bool lowLevelSuccess, bytes memory returnData) =
                address(sellingToken).call(
                    abi.encodePacked(
                        IERC20Burnable.burn.selector,
                        abi.encode(tokenBalance)
                    )
                );
            bool returnedBool;
            if (lowLevelSuccess) { // transferFrom completed successfully (did not revert)
                (returnedBool) = abi.decode(returnData, (bool));
            }
            if (!returnedBool) {
                revert TransferError();
            }
        }
    }

    function continueSale(
        uint64[] memory _timestamps,
        uint256[] memory _prices,
        uint256[] memory _amountRaised,
        uint64 _endTs
    ) 
        public 
        onlyOwner 
    {
        if (withdrawOption != EnumWithdraw.never) {
            revert NotSupported();
        }

        if (_endTs <= block.timestamp || _endTs <= _endTime) {
            revert ExchangeTimeShouldBePassed();
        }
        
        for(uint256 i = 0; i < _timestamps.length; i++) {
            if (_timestamps[i] < _endTime) {
                revert InvalidInput();
            }
        }
        timestamps = _timestamps;
        prices = _prices;
        amountRaised = _amountRaised;
        _endTime = _endTs;

    }
    
    /**
     * get exchange rate ETH -> sellingToken
     */
    function getTokenPrice() public view returns (uint256 price) {
        uint256 raised = amountRaised[0];
        uint256 ts = timestamps[0];
        price = prices[0];
        for (uint256 i = 0; i < timestamps.length; i++) {
            if (block.timestamp >= timestamps[i] && timestamps[i] >= ts) {
                ts = timestamps[i];
                price = prices[i];
            }

            if (totalAmountRaised >= amountRaised[i] && amountRaised[i] >= raised) {
                raised = amountRaised[i];
                price = prices[i];
            }

        }
        
    }

    function getPrice() internal view virtual returns(bytes16 price_) {
        uint112 reserve0;
        uint112 reserve1;
        
        (reserve0, reserve1, ) = IUniswapV2Pair(uniswapV2Pair).getReserves();
        if (reserve0 == 0 || reserve1 == 0) {
            // Exclude case when reserves are empty
        } else {
            
            if (token00) {
                //price_ = FixedPoint.fraction(reserve0,reserve1);
                price_ = ABDKMathQuad.div(
                    ABDKMathQuad.fromUInt(reserve0),
                    ABDKMathQuad.fromUInt(reserve1)
                );
            } else {
                //price_ = FixedPoint.fraction(reserve1,reserve0);
                price_ = ABDKMathQuad.div(
                    ABDKMathQuad.fromUInt(reserve1),
                    ABDKMathQuad.fromUInt(reserve0)
                );
            }
        
        }

    }
    
    
/*
    struct LockedPrice {
        uint256 price;
        uint256 boughtAmount;
        bool exists;
    }
    mapping(address => LockedPrice) lockedPrice;
*/

        // uint256 totalAmount2Send;
        // uint256[2] inputAmounts;
        // uint256[2] tokenPrices;
                // uint256 tokenPrice = getTokenPrice();
        // uint256 amount2send = _getTokenAmount(inputAmount, tokenPrice);

//(totalAmount2Send, inputAmounts, tokenPrices) = 
    function getTokenAmount(
        address sender,
        uint256 inputAmount
    ) internal view returns (
        uint256 totalAmount2Send,
        uint256[2] memory inputAmounts,
        uint256[2] memory tokenPrices,
        uint256[2] memory tokens2Send
    ) {
        // 0 - main
        // 1 - lockedprice
        uint256 defaultTokenPrice = getTokenPrice();
        uint256 defaultAmount2send = _getTokenAmount(inputAmount, defaultTokenPrice);

        
        if (
            minimumLockedInAmount == 0 || 
            maximumLockedInAmount == 0 ||
            lockedPrice[sender].totalAmount > maximumLockedInAmount
        ) {
            // "minimum locked in price" are off

            totalAmount2Send = defaultAmount2send;
            tokens2Send[0] = defaultAmount2send;
            inputAmounts[0] = inputAmount;
            tokenPrices[0] = defaultTokenPrice;
        } else {
            // "minimum locked in price" are on

            //need to calculate how much user should get by usual price and how much by special
            uint256 leftByLockedPrice;

            if (lockedPrice[sender].exists) {
                    leftByLockedPrice = maximumLockedInAmount - lockedPrice[sender].boughtAmount;
            } else {
                if (
                    //    -----++.+++----------------
                    (lockedPrice[sender].totalAmount + defaultAmount2send) > minimumLockedInAmount &&
                    (lockedPrice[sender].totalAmount + defaultAmount2send) < maximumLockedInAmount
                ) {
                    leftByLockedPrice = (lockedPrice[sender].totalAmount + defaultAmount2send) - minimumLockedInAmount  - lockedPrice[sender].boughtAmount;
                } else if (
                    //    -----+++++---.-------------
                    (lockedPrice[sender].totalAmount + defaultAmount2send) > maximumLockedInAmount
                ) {
                    leftByLockedPrice = maximumLockedInAmount - minimumLockedInAmount  - lockedPrice[sender].boughtAmount;
                }
            }

            if (leftByLockedPrice > 0) { // then available to get tokens with locked price
                //try to calcualte how much available with current price
                uint256 currentLockedPrice;
                if (lockedPrice[sender].exists) {
                    currentLockedPrice = lockedPrice[sender].price;

                } else {
                    currentLockedPrice = defaultTokenPrice;
                }

                if (lockedPrice[sender].exists) {

                    // buy as possible
                    uint256 howMuchUselWillBuyByLockedPrice = _getTokenAmount(inputAmount, currentLockedPrice);

                    if (maximumLockedInAmount < lockedPrice[sender].boughtAmount + howMuchUselWillBuyByLockedPrice) {
                        tokens2Send[1] = maximumLockedInAmount-lockedPrice[sender].boughtAmount;
                        inputAmounts[1] = _getInputAmount(tokens2Send[1], currentLockedPrice);
                        tokenPrices[1] = currentLockedPrice;

                        inputAmounts[0] = inputAmount - inputAmounts[1];
                        tokens2Send[0] = _getTokenAmount(inputAmounts[0], defaultTokenPrice);
                        tokenPrices[0] = defaultTokenPrice;
                    } else {
                        tokens2Send[1] = howMuchUselWillBuyByLockedPrice;
                        inputAmounts[1] = inputAmount;
                        tokenPrices[1] = leftByLockedPrice;

                        tokens2Send[0] = 0;
                        inputAmounts[0] = 0;
                        tokenPrices[0] = 0;
                    }
                } else {
                    tokens2Send[1] = leftByLockedPrice;
                    inputAmounts[1] = _getInputAmount(leftByLockedPrice, currentLockedPrice);
                    tokenPrices[1] = currentLockedPrice;
                    
                    inputAmounts[0] = inputAmount - inputAmounts[1];
                    tokenPrices[0] = defaultTokenPrice;
                    tokens2Send[0] = _getTokenAmount(inputAmounts[0], defaultTokenPrice);
                }

                totalAmount2Send = tokens2Send[0] + tokens2Send[1];
            } else {
                tokens2Send[0] = defaultAmount2send;
                inputAmounts[0] = inputAmount;
                tokenPrices[0] = defaultTokenPrice;
                totalAmount2Send = tokens2Send[0] + tokens2Send[1];
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
    
    function owner(
    ) 
        public 
        view 
        virtual
        override(IPresale,OwnableUpgradeable)
        returns (address) 
    {
        return super.owner();
    }


    function availableToClaim() internal view returns(uint256) {
        return (totalIncome - totalIncome*holdTotalFraction/FRACTION) - totalIncomeAlreadyClaimed;
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
     * @param inputAmount amount in eth that should be converted in tokenAmount
     * @param price token price
     */
    function _getTokenAmount(uint256 inputAmount, uint256 price) internal pure returns (uint256) {
        return inputAmount * priceDenom / price;
    }
    
    /**
     * calculate eth's amount
     * @param tokenAmount amount in token that should be converted in tokenAmount
     * @param price token price
     */
    function _getInputAmount(uint256 tokenAmount, uint256 price) internal pure returns (uint256) {
        return tokenAmount * price / priceDenom;
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
    // function _sendTokens(uint256 amount, address addr) internal {
        
    //     require(amount>0, "Amount can not be zero");
    //     require(addr != address(0), "address can not be empty");
        
    //     uint256 tokenBalance = IERC20Upgradeable(sellingToken).balanceOf(address(this));
    //     require(tokenBalance >= amount, "Amount exceeds allowed balance");
        
    //     bool success = IERC20Upgradeable(sellingToken).transfer(addr, amount);
    //     require(success == true, "Transfer tokens were failed"); 
    // }

    /**
     * @param amount amount of tokens
     * @param addr address to send
     * @param revertWhenError if true - tx will revert if error happens
     * @return success true if all ok. and false - if revertWhenError == false and tx have exceptions
     */
    function _sendTokens(uint256 amount, address addr, bool revertWhenError) internal returns(bool success) {
        //
        success = true;

        //require(amount>0, "Amount can not be zero");
        if (amount == 0) {
            if (revertWhenError) { 
                revert InvalidInput();
            } else {
                success = false;
            }
        }

        //require(addr != address(0), "address can not be empty");
        if (success && addr == address(0)) {
            if (revertWhenError) { 
                revert AddressInvalid();
            } else {
                success = false;
            }
        }

        if (success) {
            uint256 tokenBalance = IERC777Upgradeable(sellingToken).balanceOf(address(this));
            if (tokenBalance < amount) {
                if (revertWhenError) { 
                    revert InsufficientAmount();
                } else {
                    success = false;
                }
            }
        }

        bool lowLevelSuccess;
        bytes memory returnData;
        bool returnedBool;
        if (success) {
            // create a low level call to the token
            //lowLevelSuccess
            (lowLevelSuccess, returnData) =
                address(sellingToken).call(
                    abi.encodePacked(
                        ERC777Upgradeable.transfer.selector,
                        abi.encode(addr, amount)
                    )
                );
            success = lowLevelSuccess;
        }
        if (success) {
            //returnedBool
            (returnedBool) = abi.decode(returnData, (bool));
            success = returnedBool;
        }
        
        // if lowLevelSuccess == false  - it's tx revert
        // if returnedBool == false - tx is ok but method return false
        // but in our case - See {IERC20-transfer}, method will always return true or tx will revert ;)
        if (revertWhenError && !success) {
            revert TransferError();    
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
                    tokenPrice,
                    true
                );
            }
            
        }
    }
    
    /**
     * calculate user bonus tokens and send it to him
     * @param addr Address of participant
     * @param ethAmount amount
     * @param tokenPrice price ratio ETH -> token
     * @param revertIfCantSendTokens revert if tokens are not enough when  contract will try to send bonuses to users
     */
    function _addBonus(
        address addr, 
        uint256 ethAmount,
        uint256 tokenPrice,
        bool revertIfCantSendTokens
    ) 
        internal 
        virtual
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
                  
                    _sendTokens(amount2Send, participantAddr, revertIfCantSendTokens);
                    
                }
            }

            emit GroupBonusAdded(groupName, ethAmount, tokenPrice);
               
        } else {
            totalInvestedGroupOutside[addr] += ethAmount;    
        }
    }

    function _validateWhitelistForInternalUse() internal view {
        if ((!whitelist.useWhitelist) || (whitelist.useWhitelist && (whitelist.contractAddress != address(0)))) {
           revert WhitelistError(); 
        }
    }
    
    function getContractTotalAmount() internal view virtual returns(uint256);
}
