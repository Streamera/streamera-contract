import ("hardhat-change-network");

import fs from "fs/promises";
import {getDefaultProvider, BigNumber} from "ethers";
import {isTestnet, wallet} from "../config/constants";
import {ethers} from "ethers";
import _ from "lodash";
import { TRANSFER_RESULT } from "@axelar-network/axelarjs-sdk";
import * as hre from 'hardhat';

const {utils: {
        deployContract
    }} = require("@axelar-network/axelar-local-dev");

// load contracts
const StreameraContract = require("../artifacts/contracts/streamera.sol/streamera.json");

let chains = isTestnet ? require("../config/testnet.json") : require("../config/local.json");

// get chains
// const chainName = ["Moonbeam", "Avalanche", "BscTest", "Mumbai", "Fantom"];
// const chainName = ["Ethereum"];

// npx hardhat verify --list-networks
const hreName: {[key: string]: string} = {
    "Ethereum": "goerli",
    "Moonbeam": "moonbaseAlpha",
    "Avalanche": "avalancheFujiTestnet",
    "BscTest": "bscTestnet",
    "Mumbai": "polygonMumbai",
    "Fantom": "ftmTestnet"
}
// const chainName = [ "Mumbai"];
const chainInfo: any = [];

const platformFee = 1;

// deploy speed on steroid
const asyncDeploy = true;

async function deploy(chain: any) {
    const provider = getDefaultProvider(chain.rpc);
    const connectedWallet = wallet.connect(provider);

    const constructorArgs = [
        chain.dex, chain.wrappedTokenAddress, platformFee
    ];

    // console.log(constructorArgs);
    // Compare live block vs rpc block, sometime bsc testnet got issue, will stuck
    console.log(`${chain.name} Block: ${await provider.getBlockNumber()}`);

    try {
        const streamera = await deployContract(connectedWallet, StreameraContract, constructorArgs,{
            gasLimit: 13000000, // Set the desired gas limit here
        });

        chain.streamera = streamera.address;
        console.log(`[${chain.name}] Deployed ${chain.streamera}`);

        // AUTO VERIFY DELAY (most like will fail due to blockscan belum index these new contract)
        // if you want to auto verify contract, uncomment these code
        // hre.changeNetwork(hreName[chain.name]);
        // try {
        //     await hre.run("verify:verify", {
        //         // address: chain.streamera, //change this to streamera.address
        //         address: streamera.address, //change this to streamera.address
        //         constructorArguments: constructorArgs
        //     });
        //     console.log(`[${chain.name}] Verified ${chain.streamera}`);
        // } catch(e) {
        //     console.log(`[${chain.name}] Failed to verify`);
        //     // console.log(e);
        // }
    } catch(e) {
        // console.log(e);
        console.log(`[${chain.name}] Failed to deploy`);
    }

    return chain;
}

// deploy script
async function main() {
    let cnIndex = 0;
    const promises = [];
    let result: any = [];
    // loop chain to deploy
    for (let cn in chainName) {
        const cName = chainName[cn];
        chainInfo[cn] = chains.find((chain : any) => chain.name === cName);
        console.log(`Deploying [${cName}]`);

        if (asyncDeploy) {
            promises.push(deploy(chainInfo[cn]));
            cnIndex += 1;
        } else {
            const res = await deploy(chainInfo[cn]);
            result.push(res);
        }
    }

    if (asyncDeploy) {
        result = await Promise.all(promises);
    }

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
