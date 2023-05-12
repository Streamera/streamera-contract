pragma solidity >=0.8.18;

library TransferHelper {
    function safeApprove(address token, address to, uint value) internal {
        // bytes4(keccak256(bytes('approve(address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x095ea7b3, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: APPROVE_FAILED');
    }

    function safeTransfer(address token, address to, uint value) internal {
        // bytes4(keccak256(bytes('transfer(address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FAILED');
    }

    function safeTransferFrom(address token, address from, address to, uint value) internal {
        // bytes4(keccak256(bytes('transferFrom(address,address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FROM_FAILED');
    }

    function safeTransferETH(address to, uint value) internal {
        (bool success,) = to.call{value:value}(new bytes(0));
        require(success, 'TransferHelper: ETH_TRANSFER_FAILED');
    }
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IUniswapV2Pair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
}

interface IUniswapV2Router02 {
    function factory() external pure returns (address);
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint amountOut);
    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) external pure returns (uint amountIn);
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts);
}

interface IERC20 {
    function decimals() external view returns (uint8);
    function balanceOf(address owner) external view returns (uint);
    function transfer(address to, uint value) external returns (bool);
    function withdraw(uint) external;
    function deposit() external payable;
    function approve(address spender, uint amount) external returns (bool);
}

contract Streamera {
    address payable public admin;
    uint public platformFee;
    address public WETH;

    constructor(address _WETH, uint _platformFee) public {
        platformFee = _platformFee;
        WETH = _WETH;
    }

    receive() external payable {}

    modifier onlyAdmin() {
        require(msg.sender == admin, "admin: wut do you try?");
        _;
    }

    mapping(address => uint) private tokenHolding;
    address[] private tokens;

    function getAmountsOut(address _router, uint amountIn, address[] memory path) public view returns (uint[] memory amounts) {
        return IUniswapV2Router02(_router).getAmountsOut(amountIn, path);
    }

    function getPair(address _router, address tokenA, address tokenB) public view returns (address pair){
        IUniswapV2Factory _uniswapV2Factory = IUniswapV2Factory(IUniswapV2Router02(_router).factory());
        return _uniswapV2Factory.getPair(tokenA, tokenB);
    }

    // token <-> token swap (same token) - working
    // native <-> native swap (same token) - working (tax missing?)
    // token <-> token swap (diff token) - working
    // native <-> token swap (diff token) - working
    // token <-> native swap (diff token) - working
    // function swapToToken(address _router, address tokenA, address tokenB, uint amountIn, uint calcAmount, uint slippage, address recipient) payable public {
    function localSwap(address _router, address tokenA, address tokenB, uint amountIn, address recipient, bool nativeFund) payable public {
        address[] memory _path = new address[](2);
        _path[0] = tokenA;
        _path[1] = tokenB;

        // check if user passed native (prioritize native)
        if (msg.value > 0) {
            amountIn = msg.value;
            // swap all the native to wrapped token
            IERC20(WETH).deposit{value: msg.value}();
        } else {
            // transfer user fund to contract first
            TransferHelper.safeTransferFrom(
                tokenA, msg.sender, address(this), amountIn
            );
        }

        // take platform fee
        uint platformCharges = amountIn * platformFee / uint(100);
        tokenHolding[tokenA] += platformCharges;
        amountIn = amountIn - platformCharges;

        if (tokenA != tokenB) {
            // ***************************
            // transfer between diff token
            // ***************************

            // get amountsOut and swap
            uint[] memory amounts = getAmountsOut(_router, amountIn, _path);
            address pairAddress = getPair(_router, tokenA, tokenB);

            // Add a check to prevent sandwich attacks (within slippage changes)
            // require(calcAmount - (calcAmount * slippage / 100) <= amounts[1], "Price has changed significantly");

            // transfer from contract -> pair
            TransferHelper.safeTransfer(tokenA, pairAddress, amountIn);

            // prepare swap data
            address token0 = tokenA < tokenB ? tokenA : tokenB;
            (uint amount0Out, uint amount1Out) = tokenA == token0 ? (uint(0), amounts[1]) : (amounts[1], uint(0));

            // perform swap
            IUniswapV2Pair(pairAddress).swap(amount0Out, amount1Out, address(this), new bytes(0));

            // calculate swapped amount
            uint swappedAmount = IERC20(tokenB).balanceOf(address(this)) - tokenHolding[tokenB];

            if (nativeFund && tokenB == WETH) {
                // transfer native fund to streamer
                IERC20(WETH).withdraw(swappedAmount);
                TransferHelper.safeTransferETH(recipient, swappedAmount);
            } else {
                // transfer token to streamer
                TransferHelper.safeTransfer(tokenB, recipient, swappedAmount);
            }
        } else {
            // *********************************
            // transfer same token / same native
            // *********************************
            
            if (nativeFund && tokenB == WETH) {
                // transfer native fund to streamer
                IERC20(WETH).withdraw(amountIn);
                TransferHelper.safeTransferETH(recipient, amountIn);
            } else {
                // transfer token to streamer
                TransferHelper.safeTransfer(tokenB, recipient, amountIn);
            }
        }
    }

    // retrieve platform fee
    function sendTokenBackAll(address token) external onlyAdmin {
        IERC20(token).transfer(admin, IERC20(token).balanceOf(address(this)));
    }

    // retrieve platform fee
    function sendNativeBack() external onlyAdmin {
        admin.transfer(address(this).balance);
    }
}