import { Squid } from "@0xsquid/sdk";
import { ethers } from "ethers";

const getSDK = (): Squid => {
  const squid = new Squid({
    baseUrl: "https://testnet.api.0xsquid.com"
  });
  return squid;
};

const privateKey =
  "<YOUR_PRIVATE_KEY_HERE";
const ethRpcEndPoint = 
  "https://goerli.infura.io/v3/<YOUR_INFURA_KEY_OR_OTHER_RPC_PROVIDER>";

(async () => {
    // set up your RPC provider and signer
    const provider = new ethers.providers.JsonRpcProvider(ethRpcEndPoint);
    const signer = new ethers.Wallet(privateKey, provider);

    // instantiate the SDK
    const squid = getSDK();
    // init the SDK
    await squid.init();
    console.log("Squid inited");

    const ethereumId = 1;
    const avalancheId = 43114;
    const sushiRouter = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
    const sushiToken = "0x37B608519F91f70F2EeB0e5Ed9AF4061722e4F76";
    const usdceToken = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664";
    const wethToken = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const amount = "1000000000000000000";
    const minAmount = "0";

    const usdcContractInterface = new ethers.utils.Interface(erc20Abi as any);
    const approveEncodeData = usdcContractInterface.encodeFunctionData(
    "approve",
    [
        sushiRouter,
        "0"
    ]
    );

    const routerContractInterface = new ethers.utils.Interface(uniswapV2 as any);
    const swapEncodeData = routerContractInterface.encodeFunctionData(
    "swapExactTokensForTokens",
    [
        amount,
        minAmount,
        [usdceToken, sushiToken],
        signer.address,
        new Date().getTime() + 1e6
    ]
    );

    const { route } = await squid.getRoute({
    toAddress: signer.address,
    fromChain: ethereumId,
    fromToken: wethToken,
    fromAmount: amount,
    toChain: avalancheId,
    toToken: usdceToken,
    slippage: 99,
    customContractCalls: [
        {
        callType: 1,
        target: usdceToken,
        value: "0",
        callData: approveEncodeData,
        payload: {
            tokenAddress: usdceToken,
            inputPos: 1
        },
        estimatedGas: "400000"
        },
        {
        callType: 1,
        target: sushiRouter,
        value: "0",
        callData: swapEncodeData,
        payload: {
            tokenAddress: usdceToken,
            inputPos: 0
        },
        estimatedGas: "400000"
        }
    ]
    });

    const tx = await squid.executeRoute({
    signer,
    route
    });
    const txReceipt = await tx.wait();
})();