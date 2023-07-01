// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MNGBSwap
 * @dev This contract facilitates swapping of ERC20 tokens based on predefined lot sizes.
 */
contract MNGBSwap is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint constant MAX_UINT = (2 ** 256) - 1;

    struct SwapStats {
        uint tokenIn;
        uint tokenOut;
        uint swapCounter;
    }

    event Swap(address indexed account, uint amountIn, uint amountOut);
    event ExcludeStateChange(address indexed account, bool state);

    IERC20 public immutable tokenIn;
    IERC20 public immutable tokenOut;

    uint256 public immutable tokenInLotSize;
    uint256 public immutable tokenOutLotSize;

    address public tokenInReceiver;

    SwapStats public stats;

    mapping(address => SwapStats) public accountStats;
    mapping(address => uint256) public swapLimit;
    mapping(address => bool) public excludedFromSwapLimit;

    /**
     * @dev Initializes the MNGBSwap contract.
     * @param tokenIn_ The input ERC20 token.
     * @param tokenOut_ The output ERC20 token.
     * @param tokenInLotSize_ The lot size for the input token.
     * @param tokenOutLotSize_ The lot size for the output token.
     */
    constructor(IERC20 tokenIn_, IERC20 tokenOut_, uint tokenInLotSize_, uint tokenOutLotSize_, address tokenInReceiver_) {
        require(tokenInLotSize_ > 0, "Token-in lot size should be higher than zero");
        require(tokenOutLotSize_ > 0, "Token-out lot size should be higher than zero");
        tokenIn = tokenIn_;
        tokenOut = tokenOut_;
        tokenInLotSize = tokenInLotSize_;
        tokenOutLotSize = tokenOutLotSize_;
        tokenInReceiver = tokenInReceiver_;
    }

    /**
     * @dev Fallback function to receive Ether.
     */
    receive() external payable {}

    /**
     * @dev Fallback function to receive Ether.
     */
    fallback() external payable {}

    /**
     * @dev Sets token-in receiver address
     * @param receiver The token-in receiver address
     */
    function setTokenInReceiver(address receiver) public onlyOwner {
        require(receiver != address(0), "Token-in receiver cant be zero address");
        tokenInReceiver = receiver;
    }

    /**
     * @dev Sets the swap limit for a multiple accounts.
     * @param accounts[] The account addresses.
     * @param limits[] The swap limits for the accounts.
     */
    function setMultipleAccountSwapLimits(address[] calldata accounts, uint256[] calldata limits) public onlyOwner {
        uint count = accounts.length;
        require(limits.length == count, "Length does not match");

        for (uint256 i = 0; i < count; i++) {
            address account = accounts[i];
            uint256 limit = limits[i];

            swapLimit[account] = limit;
        }
    }

    /**
     * @dev Sets the exclude status of an account.
     * @param account The account address.
     * @param state The exclude status to set.
     *              - If true, the account will be excluded from swap limits.
     *              - If false, the account will be subject to swap limits.
     *
     * Requirements:
     * - The account address cannot be the zero address.
     *
     * Emits an `ExcludeStateChange` event if the exclude status of the account is updated.
     */
    function setExcludeStatusOfAccount(address account, bool state) public onlyOwner {
        require(account != address(0), "Account cannot be the zero address");
        if (excludedFromSwapLimit[account] != state) {
            excludedFromSwapLimit[account] = state;
            emit ExcludeStateChange(account, state);
        }
    }


    /**
     * @dev Sets the swap limit for a specific account.
     * @param account The account address.
     * @param limit The swap limit for the account.
     */
    function setAccountSwapLimit(address account, uint256 limit) external onlyOwner {
        swapLimit[account] = limit;
    }

    /**
     * @dev Allows the owner to withdraw tokens from the contract.
     * @param token The address of the token to withdraw.
     * @param amount The amount of tokens to withdraw.
     */
    function withdraw(IERC20 token, uint256 amount) external nonReentrant onlyOwner {
        SafeERC20.safeTransfer(token, _msgSender(), amount);
    }

    /**
     * @dev Retrieves the maximum swap limit for an account.
     * @param account The account address.
     * @return The maximum swap limit for the account.
     */
    function getMaxSwapLimit(address account) public view returns (uint256) {
        if (excludedFromSwapLimit[account] == true) {
            return MAX_UINT;
        }
        return swapLimit[account];
    }

    /**
     * @dev Calculates the input and output token amounts based on the input amount.
     * @param amountIn_ The input token amount.
     * @return The calculated input and output amounts.
     */
    function calculateInOut(uint256 amountIn_) public view returns (uint256, uint256) {
        uint256 lotCount = (amountIn_ / tokenInLotSize);
        uint256 amountIn = (lotCount * tokenInLotSize);
        uint256 amountOut = (lotCount * tokenOutLotSize);

        return (amountIn, amountOut);
    }

    /**
     * @dev Updates the statistics and swap limits for an account.
     * @param account The account address.
     * @param inAmount The input token amount.
     * @param outAmount The output token amount.
     */
    function _updateStatsAndLimit(address account, uint256 inAmount, uint256 outAmount) internal {
        SwapStats memory generalStat = stats;
        SwapStats memory accountStat = accountStats[account];

        generalStat.tokenIn += inAmount;
        generalStat.tokenOut += outAmount;
        generalStat.swapCounter += 1;

        accountStat.tokenIn += inAmount;
        accountStat.tokenOut += outAmount;
        accountStat.swapCounter += 1;

        stats = generalStat;
        accountStats[account] = accountStat;

        if (excludedFromSwapLimit[account] == false) {
            swapLimit[account] -= inAmount;
        }
    }

    /**
     * @dev Performs a token swap.
     * @param amount The input token amount.
     */
    function swap(uint256 amount) public nonReentrant {
        (uint256 inAmount, uint256 outAmount) = calculateInOut(amount);
        require(tokenOut.balanceOf(address(this)) > outAmount, "Insufficient token-out balance. Try again later");
        uint256 maxSwapAmount = getMaxSwapLimit(_msgSender());

        // Check maximum swap limit for account
        require(outAmount <= maxSwapAmount, "Maximum swap limit is reached");

        // Update stats and limit
        _updateStatsAndLimit(_msgSender(), inAmount, outAmount);

        // Transfer tokenIn to this contract
        SafeERC20.safeTransferFrom(tokenIn, _msgSender(), tokenInReceiver, inAmount);

        // Transfer tokenOut to caller
        SafeERC20.safeTransfer(tokenOut, _msgSender(), outAmount);

        // Emit swap event
        emit Swap(_msgSender(), inAmount, outAmount);
    }
}
