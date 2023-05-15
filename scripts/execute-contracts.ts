import {Contract, getDefaultProvider, Wallet, ethers} from "ethers";
import {defaultAbiCoder} from "ethers/lib/utils";
import {isTestnet, wallet} from "../config/constants";
import { Squid, TokenData, ChainData } from "@0xsquid/sdk";

const sqTradeQuote = [
    {
        chainId: 97, // bsc
        fromNative: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        from: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
        to: '0xc2fA98faB811B785b81c64Ac875b31CC9E40F9D2'
    },
    {
        chainId: 43113, // avax
        fromNative: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        from: '0xd00ae08403B9bbb9124bB305C09058E32C39A48c',
        to: '0x57f1c63497aee0be305b8852b354cec793da43bb'
    },
    {
        chainId: 4002, // ftm
        fromNative: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        from: '0xf1277d1Ed8AD466beddF92ef448A132661956621',
        to: '0x254d06f33bDc5b8ee05b2ea472107E300226659A'
    },
    {
        chainId: 4002, // avax
        fromNative: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        from: '0xf1277d1Ed8AD466beddF92ef448A132661956621',
        to: '0x254d06f33bDc5b8ee05b2ea472107E300226659A'
    },
    {
        chainId: 5, // eth goerli
        fromNative: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        from: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
        to: '0x254d06f33bDc5b8ee05b2ea472107E300226659A'
    },
    {
        chainId: 1287, // moonbase
        fromNative: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        from: '0x372d0695E75563D9180F8CE31c9924D7e8aaac47',
        to: '0xd1633f7fb3d716643125d6415d4177bc36b7186b'
    }
]

// const {utils: {
//         deployContract
//     }} = require("@axelar-network/axelar-local-dev");

let chains = isTestnet ? require("../config/testnet.json") : require("../config/local.json");


// load contracts
const StreameraContract = require("../artifacts/contracts/streamera.sol/streamera.json");

const testParams = {
    'amountIn': '1000000000000000',
    // 'amountIn': '5000000000000000',
    'recipient': '0x801Df8bD5C0C24D9B942a20627CAF1Bd34427804'
};

async function main() { // call on destination chain

    // source chain
    const bscChain = chains.find((chain : any) => chain.chainId == 97);
    const bscProvider = getDefaultProvider(bscChain.rpc);
    const bscConnectedWallet = wallet.connect(bscProvider);
    const streamera = new Contract(bscChain.streamera, StreameraContract.abi, bscConnectedWallet);

    // debug purpose
    // const balance = await bscProvider.getBalance(bscChain.streamera);

    // approve token first
    const wethABI = ["function approve(address _spender, uint256 _value) public returns (bool success)", "function allowance(address owner, address spender) external view returns (uint256)"]
    const wethContract = new Contract(bscChain.wrappedTokenAddress, wethABI, bscConnectedWallet);

    const allowed = await wethContract.allowance(bscConnectedWallet.address, bscChain.streamera);

    // console.log(`bscConnectedWallet.address: ${bscConnectedWallet.address}`);
    // console.log(`bscChain.streamera: ${bscChain.streamera}`);
    // console.log(`allowed: ${allowed.toString()}`);
    // process.exit();

    // do not reapprove if got enough allowance
    if (Number(allowed) < Number(testParams.amountIn)) {
        await wethContract.approve(bscChain.streamera, ethers.constants.MaxUint256);
    }

    // instantiate the SDK
    const squid = new Squid({
        baseUrl: "https://testnet.api.0xsquid.com", // for mainnet use "https://api.0xsquid.com"
        executionSettings: {
            infiniteApproval: false
        }
    });
    // init the SDK
    await squid.init();
    // console.log("Squid inited");

    // get all tokens available
    // const squidTokens = squid.tokens as TokenData[];
    // console.log(tokens);

    // get all chain available
    // const squidChains = squid.chains as ChainData[];

    const sqToken = sqTradeQuote.find((chain: any) => chain.chainId == bscChain.chainId);

    // https://squidrouter.readme.io/reference/get_route
    const params = {
        fromChain: bscChain.chainId, // Goerli testnet
        fromToken: sqToken!.from, // WETH on Goerli
        fromAmount: (BigInt(testParams.amountIn) * BigInt(95) / BigInt(100)).toString(), // 0.001 WETH
        toChain: 43113, // Avalanche Fuji Testnet (hardcode)
        toToken: "0x57f1c63497aee0be305b8852b354cec793da43bb", // aUSDC on Avalanche Fuji Testnet (hardcode)
        // toAddress: bscConnectedWallet.address, // the recipient of the trade
        toAddress: '0x1cc5F2F37a4787f02e18704D252735FB714f35EC', // the recipient of the trade
        slippage: 1.00, // 1.00 = 1% max slippage across the entire route
        enableForecall: true, // instant execution service, defaults to true
        quoteOnly: false // optional, defaults to false
    };

    // check fromAmount after deduct platformFee
    // console.log(params.fromAmount);

    // get squid route info quote
    const { route } = await squid.getRoute(params);
    // console.log(JSON.stringify(route));

    // possible error back from route
    // {"errors":[{"errorType":"RouteError","message":"A route could not be generated for this trade. Please try increasing the amount, a different chain and token combination or try again later."}]}

    // get squid router & calldata from quote
    const sqCallData = route.transactionRequest?.data!;
    const sqRouter = route.transactionRequest?.targetAddress!;

    // calculate gas cost & gas limit
    const sqGasEth = route.estimate.gasCosts.reduce((accumulator, currentValue) => {
        return accumulator.add(ethers.utils.parseUnits(currentValue.amount, 'wei'));
    }, ethers.utils.parseUnits('0', 'wei'));
    const sqGasLimit = route.estimate.gasCosts.reduce((accumulator, currentValue) => {
        return accumulator.add(ethers.utils.parseUnits(currentValue.limit, 'wei'));
    }, ethers.utils.parseUnits('0', 'wei'));

    // console.log(`sqGasEth: ${sqGasEth.toString()}`);
    // console.log(`sqGasLimit: ${sqGasLimit.toString()}`);

    // ************************************************************
    // test local swap (WORKING!! Uncomment if still want to test)
    // ************************************************************
    // const tx1 = await (await streamera.localSwap(bscChain.dex, bscChain.wrappedTokenAddress, bscChain.usdt, testParams.amountIn, testParams.recipient, false)).wait(1);
    // console.log(`local swap done`);
    // console.log(tx1);

    // test squid call swap
    // steps to send to squid
    // 1. calculate amount, route and stuff
    // 2. deduct platform fee from amountIn
    // 3. get quote from squid
    // 4. add on axelar & squid gas fee!!! (IMPORTANT)
    const tx2 = await (await streamera.squidSwap(sqRouter, bscChain.wrappedTokenAddress, sqCallData, testParams.amountIn, { gasLimit: sqGasLimit, value: sqGasEth })).wait(1);
    console.log(`squid swap done`);
    console.log(tx2);
}

main();
