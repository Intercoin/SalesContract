pragma solidity ^0.8.0;
import "./SalesBase.sol";
abstract contract SalesBaseWithCompensation is SalesBase {
    
    struct Compensation{
        uint256 nextCounter;
        uint256[] sent;
        bytes16 [] price; // ABDKMathQuad value
        uint256 claimedCounter;
    }
    mapping(address => Compensation) compensations;
    
    uint64 public _compensationEndTime;

    error CompensationTimeShouldBePassed();
    error CompensationTimeExpired();
    error CompensationNotFound();


    function __SalesBaseWithCompensation__init(
        CommonSettings memory _commonSettings,
        PriceSettings[] memory _priceSettings,
        ThresholdBonuses[] memory _bonusSettings,
        EnumWithdraw _ownerCanWithdraw,
        WhitelistStruct memory _whitelistData,
        LockedInPrice memory _lockedInPrice,
        CompensationSettings memory _compensationSettings,
        address _costManager
    ) 
        internal 
        onlyInitializing
    {
        __SalesBase__init(
            _commonSettings,
            _priceSettings,
            _bonusSettings,
            _ownerCanWithdraw,
            _whitelistData,
            _lockedInPrice,
            _costManager
        );

        _compensationEndTime = _compensationSettings.endTime;
    }
    
    function compensation() public {
        
        if (_endTime > block.timestamp) {
            revert CompensationTimeShouldBePassed();
        }
        if (_compensationEndTime < block.timestamp) {
            revert CompensationTimeExpired();        
        }

        address sender = msg.sender;
        Compensation storage compensationData = compensations[sender];

        if (compensationData.nextCounter <= compensationData.claimedCounter) {
            revert CompensationNotFound();
        }


        bytes16 currentPrice = getPrice(); // ABDKMathQuad memory
        uint256 compensationAmount = 0;
        for(uint256 i = compensationData.claimedCounter; i < compensationData.nextCounter; ++i) {
            // compensate =  [was sent] / ([oldPrice]/[newPrice]), where newPrice > oldPrice

            if (ABDKMathQuad.toUInt(compensationData.price[i]) < ABDKMathQuad.toUInt(currentPrice)) {

                compensationAmount += (
                    ABDKMathQuad.toUInt(
                        ABDKMathQuad.div(
                            ABDKMathQuad.fromUInt(compensationData.sent[i]), // not more than 1e15 tokens
                            ABDKMathQuad.div(
                                compensationData.price[i],
                                currentPrice
                            )
                        )
                    )
                );
            }
        }

        compensationData.claimedCounter = compensationData.nextCounter;

        if (compensationAmount > 0) {
            bool success = ERC777Upgradeable(sellingToken).transfer(sender, compensationAmount);
            if (!success) {
                revert TransferError();
            }
        }

    }

    function _exchangeAdditional(address sender, uint256 amount) internal override  {

        //compensations
        Compensation storage compensationData = compensations[sender];
        compensationData.nextCounter +=1;
        compensationData.sent.push(amount);
        compensationData.price.push(getPrice());
        //----------

    }
}