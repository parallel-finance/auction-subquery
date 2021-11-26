import { SubstrateBlock, SubstrateEvent, SubstrateExtrinsic } from "@subql/types";
import { DotContribution, MoonbeanContribution } from "../types";
import type { Extrinsic } from "@polkadot/types/interfaces";
import type { Vec, Result, Null, Option } from "@polkadot/types";
import tasks from "./tasks";
import moonbeamPatch from "./moonbeam-patch";
import moonbeamPatch2 from "./moonbeam-patch2";
import vrfPatch from "./vrf-patch";

const MULTISIG_ADDR = "13wNbioJt44NKrcQ5ZUrshJqP7TKzQbzZt5nhkeL4joa3PAX";
const PROXY_ADDR = "13vj58X9YtGCRBFHrcxP6GCkBu81ALcqexiwySx18ygqAUw";
// const MULTISIG_ADDR = "EF9xmEeFv3nNVM3HyLAMTV5TU8jua5FRXCE116yfbbrZbCL";

const parseRemark = (remark: { toString: () => string }) => {
  logger.info(`Remark is ${remark.toString()}`);
  return Buffer.from(remark.toString().slice(2), "hex").toString("utf8");
};

const checkTransaction = (sectionFilter: string, methodFilter: string, call: Extrinsic) => {
  const { section, method } = api.registry.findMetaCall(call.callIndex);
  return section === sectionFilter && method === methodFilter;
};

const checkTransactionInsideProxy = (sectionFilter: string, methodFilter: string, call: Extrinsic) => {
  if (!checkTransaction("proxy", "proxy", call)) return false;
  const addr = call.args[0].toString();
  if (addr !== MULTISIG_ADDR) {
    logger.debug("Found proxy address: " + addr + ", expected: " + MULTISIG_ADDR);
    return false;
  }
  const insideCall = call.args[2] as Extrinsic;
  return checkTransaction(sectionFilter, methodFilter, insideCall);
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

    blockHeight: extrinsic.block.block.header.number.toNumber(),
    paraId: parseInt(paraId),
    account: extrinsic.extrinsic.signer.toString(),
    amount: amountRaw.toString(),
    referralCode,
    timestamp: extrinsic.block.timestamp,
    transactionExecuted: false,
    isValid: true,
    executedBlockHeight: null,
  });
  logger.info(JSON.stringify(record));

  await record.save();
};

const handleAuctionBot = async (extrinsic: SubstrateExtrinsic) => {
  // batchAll[
  //  remark(previous_hash)
  //  proxy(contribute(amount))
  //  proxy(addMemo(referralCode))
  // ]
  if (extrinsic.extrinsic.signer.toString() !== PROXY_ADDR) {
    return;
  }

  const [remarkCall, proxyContributeCall] = (extrinsic.extrinsic.args[0] as Vec<Extrinsic>).toArray();

  // Check format
  if (
    !checkTransaction("system", "remark", remarkCall) ||
    !checkTransactionInsideProxy("crowdloan", "contribute", proxyContributeCall)
  ) {
    return;
  }

  let remark = remarkCall.args[0].toString();
  if (remark.length !== 66) {
    remark = parseRemark(remark);
  }

  const txIds = remark.split("#");
  txIds.forEach((txId) => logger.info(`Fetch execution of ${txId}`));
  const entities = await Promise.all(txIds.map((txId) => DotContribution.get(txId)));

  const {
    event: {
      data: [result],
    },
  } = extrinsic.events.find((e) => e.event.section === "proxy" && e.event.method === "ProxyExecuted");

  const status = (result as Result<Null, any>).isOk;

  entities.forEach((entity) => (entity.isValid = status));
  await Promise.all(
    entities.map((entity) => {
      entity.transactionExecuted = true;
      entity.executedBlockHeight = extrinsic.block.block.header.number.toNumber();
      return entity.save();
    })
  );
};

export const handleBatchAll = async (extrinsic: SubstrateExtrinsic) => {
  await handleDotContribution(extrinsic);
  await handleAuctionBot(extrinsic);
};

export const handleMoonbeamContribute = async ({ event, block }: SubstrateEvent) => {
  const [who, fund, amount] = event.data.toArray();
  if (MULTISIG_ADDR !== who.toString() || fund.toString() !== "2004") {
    return;
  }

  let record = await MoonbeanContribution.get("2004");
  if (record) {
    record.amount = (BigInt(record.amount) + BigInt(amount.toString())).toString();
  } else {
    record = MoonbeanContribution.create({
      id: fund.toString(),
      amount: amount.toString(),
    });
  }
  await record.save();
};

export const hotfixScript = async (block: SubstrateBlock) => {
  if (block.block.header.number.toNumber() === 7694900) {
    await Promise.all(
      tasks.nodes.map(async (node) => {
        const record = await DotContribution.get(node.id);
        record.isValid = true;
        record.transactionExecuted = false;
        record.executedBlockHeight = null;
        await record.save();
      })
    );
  }

  if (block.block.header.number.toNumber() === 7754100) {
    await Promise.all(
      moonbeamPatch.id.map(async (id) => {
        const record = await DotContribution.get(id);
        record.isValid = true;
        record.transactionExecuted = true;
        record.executedBlockHeight = 7753953;
        await record.save();
      })
    );
  }

  if (block.block.header.number.toNumber() === 7853900) {
    await Promise.all(
      moonbeamPatch2.id.map(async (id) => {
        const record = await DotContribution.get(id);
        record.isValid = true;
        record.transactionExecuted = true;
        record.executedBlockHeight = 7814744;
        await record.save();
      })
    );
  }

  if (block.block.header.number.toNumber() === 7866150) {
    const ids = vrfPatch.map((p) => p.id).flat();
    await Promise.all(
      ids.map(async (id) => {
        const record = await DotContribution.get(id);
        record.isValid = true;
        record.transactionExecuted = false;
        record.executedBlockHeight = null;
        await record.save();
      })
    );
  }
};
