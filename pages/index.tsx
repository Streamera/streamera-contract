import cn from "classnames";
import type { NextPage } from "next";
import React, { useCallback, useEffect, useState } from "react";
import { wallet, isTestnet } from "../config/constants";
import {
  sendTokenToDestChain,
  listTokenToDestChain,
  delistTokenToDestChain,
  mintTokenToSourceChain,
  mintTokenToDestChain,
  getBalance,
  generateRecipientAddress,
  truncatedAddress,
} from "../utils";

const Home: NextPage = () => {
  const [customRecipientAddress, setCustomRecipientAddress] =
    useState<string>("");
  const [recipientAddresses, setRecipientAddresses] = useState<string[]>([]);
  const [balances, setBalances] = useState<string[]>([]);
  const [senderBalance, setSenderBalance] = useState<string>();
  const [txhash, setTxhash] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function handleOnSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const itemId = formData.get("itemId") as unknown as number;
    setLoading(true);
    await sendTokenToDestChain(itemId, setTxhash).finally(
      () => {
        setLoading(false);
        handleRefreshSrcBalances();
        handleRefreshDestBalances();
      },
    );
  }

  async function mintNft() {
    setLoading(true);
    await mintTokenToDestChain(setTxhash).finally(
      () => {
        setLoading(false);
      },
    );
  }

  async function listNft() {
    setLoading(true);
    await listTokenToDestChain(setTxhash).finally(
      () => {
        setLoading(false);
      },
    );
  }

  async function delistNft() {
    setLoading(true);
    await delistTokenToDestChain(setTxhash).finally(
      () => {
        setLoading(false);
      },
    );
  }


  const handleRefreshDestBalances = useCallback(async () => {
    const _balances = await getBalance(recipientAddresses, false);
    setBalances(_balances);
  }, [recipientAddresses]);

  const handleRefreshSrcBalances = useCallback(async () => {
    const [_balance] = await getBalance([wallet.address], true);
    setSenderBalance(_balance);
  }, []);

  const handleOnGenerateRecipientAddress = () => {
    const recipientAddress = generateRecipientAddress();
    console.log(recipientAddress);
    setRecipientAddresses([...recipientAddresses, recipientAddress]);
  };

  const handleOnAddRecepientAddress = () => {
    setRecipientAddresses([...recipientAddresses, customRecipientAddress]);
    setCustomRecipientAddress("");
  };

  useEffect(() => {
    handleRefreshSrcBalances();
  }, [handleRefreshSrcBalances]);

  return (
    <div>
      <div>
        <h1 className="text-4xl font-medium text-center">
          General Message Passing (GMP)
        </h1>
        <h2 className="text-base text-center">Call Contract With Token</h2>

        <div className="grid grid-cols-2 gap-20 mt-20 justify-items-center">
          {/* source chain card */}
          <div className="row-span-2 shadow-xl card w-96 bg-base-100">
            <figure
              className="h-64 bg-center bg-no-repeat bg-cover image-full"
              style={{ backgroundImage: "url('/assets/avalanche.gif')" }}
            />
            <div className="card-body">
              <h2 className="card-title">Avax (Token Sender)</h2>

              <p>
                Sender ({wallet.address}) balance:{" "}
                {senderBalance}
              </p>

              <label className="label">
                <span className="label-text">Recepients</span>
              </label>
              {recipientAddresses.map((recipientAddress) => (
                <span key={recipientAddress} className="mt-1">
                  {recipientAddress}
                </span>
              ))}

              <div className="justify-end mt-2 card-actions">
                <form
                  className="flex flex-col w-full"
                  onSubmit={handleOnSubmit}
                >
                  <div>
                    <label className="label">
                      <span className="label-text">ItemId To Buy</span>
                    </label>
                    <div className="w-full input-group">
                      <input
                        disabled={loading}
                        required
                        name="itemId"
                        type="number"
                        min="0.1"
                        step="0.1"
                        placeholder="Enter nft itemId to buy"
                        className="w-full input input-bordered"
                      />
                      <button
                        className={cn("btn btn-primary", {
                          loading,
                          "opacity-30":
                            loading || recipientAddresses.length === 0,
                          "opacity-100":
                            !loading && recipientAddresses.length > 0,
                        })}
                        type="submit"
                      >
                        Buy
                      </button>
                    </div>
                  </div>
                  {txhash && isTestnet && (
                    <a
                      href={`https://testnet.axelarscan.io/gmp/${txhash}`}
                      className="mt-2 link link-accent"
                      target="blank"
                    >
                      Track at axelarscan
                    </a>
                  )}

                  <div className="form-control">
                    {/* <label className="label">
                      <span className="label-text">EVM Address</span>
                    </label>
                    <label className="w-full input-group">
                      <input
                        type="text"
                        placeholder="Enter address"
                        className="w-full input input-bordered"
                        value={customRecipientAddress}
                        onChange={(e) =>
                          setCustomRecipientAddress(e.target.value)
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleOnAddRecepientAddress}
                      >
                        Add
                      </button>
                    </label> */}

                    <div className="divider">OR</div>

                    <button
                      onClick={mintNft}
                      type="button"
                      className={cn("btn btn-accent mt-2", {
                        loading,
                      })}
                    >
                      Mint NFT
                    </button>

                    <button
                      onClick={listNft}
                      type="button"
                      className={cn("btn btn-accent mt-2", {
                        loading,
                      })}
                    >
                      List NFT
                    </button>

                    <button
                      onClick={delistNft}
                      type="button"
                      className={cn("btn btn-accent mt-2", {
                        loading,
                      })}
                    >
                      Delist NFT
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Destination chain card */}
          <div className="row-span-1 shadow-xl card w-96 bg-base-100">
            <figure
              className="h-64 bg-center bg-no-repeat bg-cover image-full"
              style={{ backgroundImage: "url('/assets/bsc.gif')" }}
            />
            <div className="card-body">
              <h2 className="card-title">BSC (Token Receiver)</h2>
              <div className="h-40">
                <div className="w-full max-w-xs form-control">
                  <div>
                    {recipientAddresses.map((recipientAddress, i) => (
                      <div
                        key={recipientAddress}
                        className="flex justify-between"
                      >
                        <span>{truncatedAddress(recipientAddress)}</span>
                        <span className="font-bold">
                          {balances[i] || `0.00`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
