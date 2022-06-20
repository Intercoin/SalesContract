// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./FundContractToken.sol";
import "./FundContract.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract FundFactory is Ownable, ReentrancyGuard {
    using Clones for address;

    FundContract immutable contractInstance;
    FundContractToken immutable contractTokenInstance;
    
    address[] public instances;
    event InstanceCreated(address instance, uint instancesCount);
  
    constructor() {
        contractInstance = new FundContract();
        contractTokenInstance = new FundContractToken();
    }
    ////////////////////////////////////////////////////////////////////////
    // external section ////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////

    /**
    * @dev view amount of created instances
    * @return amount amount instances
    * @custom:shortd view amount of created instances
    */
    function instancesCount()
        external 
        view 
        returns (uint256 amount) 
    {
        amount = instances.length;
    }
    
    /**
     * @param _sellingToken address of erc20 token
     * @param _timestamps array of timestamps
     * @param _prices price exchange
     * @param _endTime after this time exchange stop
     * @param _thresholds thresholds
     * @param _bonuses bonuses
     */
    function produce(
        address _sellingToken,
        uint256[] memory _timestamps,
        uint256[] memory _prices,
        uint256 _endTime,
        uint256[] memory _thresholds,
        uint256[] memory _bonuses
    ) 
        public 
        nonReentrant
        returns(address) 
    {
        address instance = address(contractInstance).clone();
        
        IFundContract(instance).init(
            _sellingToken,
            _timestamps,
            _prices,
            _endTime,
            _thresholds,
            _bonuses
        );

        instances.push(instance);
        emit InstanceCreated(instance, instances.length);
        
        Ownable(instance).transferOwnership(msg.sender);
        
        return instance;
    }
    
    /**
     * @param _payToken address of token"s pay
     * @param _sellingToken address of erc20 token
     * @param _timestamps array of timestamps
     * @param _prices price exchange
     * @param _endTime after this time exchange stop
     * @param _thresholds thresholds
     * @param _bonuses bonuses
     */
    function produceToken(
        address _payToken,
        address _sellingToken,
        uint256[] memory _timestamps,
        uint256[] memory _prices,
        uint256 _endTime,
        uint256[] memory _thresholds,
        uint256[] memory _bonuses
    ) 
        public 
        nonReentrant
        returns(address) 
    {

        address instance = address(contractTokenInstance).clone();
        
        IFundContractToken(instance).init(
            _payToken,
            _sellingToken,
            _timestamps,
            _prices,
            _endTime,
            _thresholds,
            _bonuses
        );

        instances.push(instance);
        emit InstanceCreated(instance, instances.length);
        
        Ownable(instance).transferOwnership(msg.sender);
        
        return instance;
    }
    
}
