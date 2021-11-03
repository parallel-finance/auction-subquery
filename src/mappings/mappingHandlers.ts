import { SubstrateExtrinsic } from "@subql/types";
import { DotContribution } from "../types";
import type { Extrinsic } from "@polkadot/types/interfaces";
import type { Vec, Result, Null } from "@polkadot/types";

// ALICE
const MULTISIG_ADDR = "EF9xmEeFv3nNVM3HyLAMTV5TU8jua5FRXCE116yfbbrZbCL";

const parseRemark = (remark: { toString: () => string }) => {
  logger.info(`Remark is ${remark.toString()}`);
  return Buffer.from(remark.toString().slice(2), "hex").toString("utf8");
};

const checkTransaction = (sectionFilter: string, methodFilter: string, call: Extrinsic) => {
  const { section, method } = api.registry.findMetaCall(call.callIndex);
  return section === sectionFilter && method === methodFilter;
};

const handleDotContribution = async (extrinsic: SubstrateExtrinsic) => {
  const calls = extrinsic.extrinsic.args[0] as Vec<Extrinsic>;
  if (
    calls.length !== 2 ||
    !checkTransaction("system", "remark", calls[0]) ||
    !checkTransaction("balances", "transfer", calls[1])
  ) {
    return;
  }
  const [
    {
      args: [remarkRaw],
    },
    {
      args: [addressRaw, amountRaw],
    },
  ] = calls.toArray();

  if (addressRaw.toString() !== MULTISIG_ADDR) {
    return;
  }

  const [paraId, referralCode] = parseRemark(remarkRaw).split("#");

  const record = DotContribution.create({
    id: extrinsic.extrinsic.hash.toString(),

    blockHeight: extrinsic.block.block.header.number,
    paraId: parseInt(paraId),
    account: extrinsic.extrinsic.signer.toString(),
    amount: amountRaw.toString(),
    referralCode,
    timestamp: extrinsic.block.timestamp,
    transactionExecuted: false,
    isValid: true,
    executedAt: null,
  });
  logger.info(JSON.stringify(record));

  await record.save();
};

const handleAuctionBot = async (extrinsic: SubstrateExtrinsic) => {
  if (extrinsic.extrinsic.args[0].toString() !== MULTISIG_ADDR) {
    return;
  }

  const batchAllCall = extrinsic.extrinsic.args[2] as Extrinsic;
  if (!checkTransaction("utility", "batchAll", batchAllCall)) {
    return;
  }

  const calls = batchAllCall.args[0] as Vec<Extrinsic>;
  const [remarkCall, contributionCall] = calls.toArray();
  if (
    checkTransaction("system", "remark", remarkCall) &&
    checkTransaction("crowdloan", "contribute", contributionCall)
  ) {
    logger.info(`Fetch execution of ${remarkCall.args[0].toString()}`);
  }

  const txId = remarkCall.args[0].toString();
  const entity = await DotContribution.get(txId);

  const {
    event: {
      data: [result],
    },
  } = extrinsic.events.find((e) => e.event.section === "proxy" && e.event.method === "ProxyExecuted");
  if ((result as Result<Null, any>).isErr) {
    logger.error("Proxy excuted failed");
    entity.isValid = false;
    await entity.save();
    return;
  }

  entity.transactionExecuted = true;
  entity.executedAt = extrinsic.block.block.header.number.toNumber();
  await entity.save();
};

export const handleBatchAll = async (extrinsic: SubstrateExtrinsic) => {
  await handleDotContribution(extrinsic);
};

export const handleProxyProxyCall = async (extrinsic: SubstrateExtrinsic) => {
  await handleAuctionBot(extrinsic);
};
