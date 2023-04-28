// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../interfaces/IERC20Mintable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Presale is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20Mintable private immutable _asset;
    address payable private _fundReceiver;
    uint public pairCounter = 0;

    uint public globalAssetCounter = 0;

    mapping(uint => Pair) public pairs;
    mapping(uint => Statistic) public pairStatistic;
    mapping(address => mapping(uint => uint)) public accountContribution;

    // Events
    event FundReceiverUpdated(address previousReceiver, address newReceiver);
    event NewPresalePairCreated(address quoteAsset, uint saleStart, uint saleEnd, uint lotSize, uint lotPrice);
    event NewSell(uint pairId, uint assetAmount, uint quoteAssetAmount);

    // Enums

    // Structs
    struct Pair {
        IERC20Mintable quoteAsset;
        uint minContribution;
        uint maxContribution;
        uint lotSize;
        uint lotPrice;
        uint saleStart;
        uint saleEnd;
        uint saleCap;
        bool isActive;
        bool _exist;
    }

    struct Statistic {
        uint assetTotal;
        uint quoteAssetTotal;
    }

    modifier onlyReceiverExist() {
        require(_fundReceiver != address(0), "Fund receiver doesnt exist");
        _;
    }

    constructor(IERC20Mintable asset_, address payable fundReceiver_) {
        _asset = asset_;
        _setFundReceiver(fundReceiver_);
    }

    /**
     * @dev This function is called for plain Ether transfers, i.e. for every call with empty calldata.
     */
    receive() external payable {
    }

    /**
     * @dev Fallback function is executed if none of the other functions match the function
     * identifier or no data was provided with the function call.
     */
    fallback() external payable {}

    function getAsset() public view returns (address) {
        return address(_asset);
    }

    function _setFundReceiver(address payable fundReceiver_) internal {
        require(fundReceiver_ != address(0), "Zero address not allowed");
        emit FundReceiverUpdated(_fundReceiver, fundReceiver_);
        _fundReceiver = fundReceiver_;
    }

    function setFundReceiver(address payable fundReceiver_) public onlyOwner {
        _setFundReceiver(fundReceiver_);
    }

    function getFundReceiver() public view returns (address) {
        return _fundReceiver;
    }

    function createPair(IERC20Mintable quoteAsset, uint minContribution, uint maxContribution, uint lotSize, uint lotPrice, uint saleStart, uint saleEnd, uint saleCap, bool isActive) public onlyOwner {
        require(address(0) != address(quoteAsset), "Quote asset address can not be zero address");
        require(minContribution < maxContribution, "Max contribution should higher than min contribution");
        require(lotSize > 0, "Lot size should higher than zero");
        require(lotPrice > 0, "Lot price should higher than zero");
        require(saleStart > 0 && saleEnd > 0 && saleStart < saleEnd, "Presale time period is not correct");
        require(saleCap > 0, "Sale cap should higher than zero");

        Pair memory newPair = Pair(quoteAsset, minContribution, maxContribution, lotSize, lotPrice, saleStart, saleEnd, saleCap, isActive, true);
        pairs[pairCounter] = newPair;
        emit NewPresalePairCreated(address(quoteAsset), saleStart, saleEnd, lotSize, lotPrice);
        pairCounter = pairCounter + 1;
    }

    function updatePair(uint pairId, uint minContribution, uint maxContribution, uint lotSize, uint lotPrice, uint saleStart, uint saleEnd, uint saleCap, bool isActive) public onlyOwner {
        require(minContribution < maxContribution, "Max contribution should higher than min contribution");
        require(lotSize > 0, "Lot size should higher than zero");
        require(lotPrice > 0, "Lot price should higher than zero");
        require(saleStart > 0 && saleEnd > 0 && saleStart < saleEnd, "Presale time period is not correct");
        require(saleCap > 0, "Sale cap should higher than zero");

        Pair memory pair = pairs[pairId];
        require(pair._exist == true, "Presale pair does not exist");
        pair.minContribution = minContribution;
        pair.maxContribution = maxContribution;
        pair.lotSize = lotSize;
        pair.lotPrice = lotPrice;
        pair.saleStart = saleStart;
        pair.saleEnd = saleEnd;
        pair.saleCap = saleCap;
        pair.isActive = isActive;

        pairs[pairId] = pair;
    }

    function accountMaxContribution(uint pairId, address account) public view returns (uint) {
        Pair memory pair = pairs[pairId];
        if (pair.maxContribution == 0) {
            return 0;
        }
        uint currentContribution = accountContribution[account][pairId];
        if (currentContribution > pair.maxContribution) {
            return 0;
        }
        return (pair.maxContribution - currentContribution);
    }

    function buyAsset(uint pairId, uint quoteAssetAmount) public onlyReceiverExist nonReentrant {
        Pair memory pair = pairs[pairId];
        Statistic memory pairStats = pairStatistic[pairId];
        uint ts = block.timestamp;
        require(pair._exist == true && pair.isActive == true, "Pair is not exist or disabled");
        require(ts < pair.saleEnd && ts > pair.saleStart, "Pair is not sale period for now");

        uint pMaxContribution = accountMaxContribution(pairId, _msgSender());
        uint processableAmount = (quoteAssetAmount - (quoteAssetAmount % pair.lotPrice));
        uint lotCount = (processableAmount / pair.lotPrice);
        uint assetAmount = (lotCount * pair.lotSize);

        require((pairStats.assetTotal + assetAmount) <= pair.saleCap, "Sale cap exceeds");
        require(processableAmount >= pair.minContribution, "Contribution amount is too low");
        require(processableAmount <= pMaxContribution, "Contribution amount is too high");

        // Transfer quote asset / Mint pre-sale token
        IERC20(address(pair.quoteAsset)).safeTransferFrom(_msgSender(), _fundReceiver, processableAmount);
        _asset.mint(_msgSender(), assetAmount);

        // Update state variables (statistic, maxContribution, etc...)
        globalAssetCounter += assetAmount;
        accountContribution[_msgSender()][pairId] += assetAmount;
        pairStats.assetTotal += assetAmount;
        pairStats.quoteAssetTotal += processableAmount;
        pairStatistic[pairId] = pairStats;

        // Emit NewSell event
        emit NewSell(pairId, assetAmount, processableAmount);
    }
}
