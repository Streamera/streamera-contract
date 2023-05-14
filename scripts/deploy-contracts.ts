import ("hardhat-change-network");

import fs from "fs/promises";
import {getDefaultProvider, BigNumber} from "ethers";
import {isTestnet, wallet} from "../config/constants";
import {ethers} from "ethers";
import _ from "lodash";
import { TRANSFER_RESULT } from "@axelar-network/axelarjs-sdk";
import * as hre from 'hardhat';
import { Squid, TokenData, ChainData } from "@0xsquid/sdk";

const {utils: {
        deployContract
    }} = require("@axelar-network/axelar-local-dev");

// load contracts
const StreameraContract = require("../artifacts/contracts/streamera.sol/streamera.json");

let chains = isTestnet ? require("../config/testnet.json") : require("../config/local.json");

// get chains
// const chainName = ["Ethereum", "Moonbeam", "Avalanche", "BscTest", "Mumbai", "Fantom"];
const chainName = [ "BscTest"];
const chainInfo: any = [];

const platformFee = 5;

async function deploy(chain: any) {
    const provider = getDefaultProvider(chain.rpc);
    const connectedWallet = wallet.connect(provider);

    const constructorArgs = [
        chain.dex, chain.wrappedTokenAddress, platformFee
    ];

    console.log(constructorArgs);

    const streamera = await deployContract(connectedWallet, StreameraContract, constructorArgs,);

    chain.streamera = streamera.address;
    console.log(`Deployed ${chain.streamera}`);

    hre.changeNetwork('bscTestnet');

    try {
        await hre.run("verify:verify", {
            address: streamera.address,
            constructorArguments: constructorArgs
        });
        console.log(`Verified ${chain.streamera}`);
    } catch(e) {
        console.log(e);
    }

    // const nftId = 1;
    // const contractName = await oneNFT.name();
    // const nftNonce = await oneNFT.nonces(nftId);
    // // set deadline in 1 days
    // const sigExpiry = Math.round(Date.now() / 1000 + (7 * 24 * 60 * 60));

    // const signature = await sign(contractName, oneNFT.address, marketplace.address, nftId, chain.chainId, nftNonce, sigExpiry, connectedWallet);

    // await(await marketplace.makeItem(oneNFT.address, nftId, ethers.utils.parseUnits('0.1', 6), newTime, sigExpiry, signature)).wait(1);

    return chain;
}

// deploy script
async function main() {
    let cnIndex = 0;
    const promises = [];

    // loop chain to deploy
    for (let cn in chainName) {
        const cName = chainName[cn];
        chainInfo[cn] = chains.find((chain : any) => chain.name === cName);
        console.log(`Deploying [${cName}]`);

        // chainInfo[cn] = await deploy(chainInfo[cn], tokenUrl[cnIndex]);
        promises.push(deploy(chainInfo[cn]));
        cnIndex += 1;
    }
    const result = await Promise.all(promises);

    // update chains
    // chainInfo = _.values(chainInfo);
    if (isTestnet) {
        await fs.writeFile("config/testnet.json", JSON.stringify(result, null, 2),);
    } else {
        await fs.writeFile("config/local.json", JSON.stringify(result, null, 2),);
    }
}

// helper to sign using (spender, tokenId, nonce, deadline) EIP 712
async function sign(
    contractName: String,
    verifyingContract: String,
    spender: String,
    tokenId: number,
    chainId: number,
    nonce: BigNumber,
    deadline: number,
    connectedWallet: any
  ) {

    const typedData = {
      types: {
        Permit: [
          { name: "spender", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "Permit",
      domain: {
        name: contractName,
        version: "1",
        chainId: chainId,
        verifyingContract: verifyingContract,
      },
      message: {
        spender,
        tokenId,
        nonce,
        deadline
      },
    };

    // sign Permit
    // assume deployer is the owner
    const deployer = connectedWallet;

    const signature = await deployer._signTypedData(
      typedData.domain as any,
      { Permit: typedData.types.Permit },
      typedData.message
    );

    return signature;
  }

main();
