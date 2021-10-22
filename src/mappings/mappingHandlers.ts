import { SubstrateExtrinsic } from "@subql/types";
import { Contribution, DotContribution } from "../types";
import type { Balance, Extrinsic } from "@polkadot/types/interfaces";
import type { Vec } from "@polkadot/types";

// ALICE
const MULTISIG_ADDR = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

const parseRemark = (remark: { toString: () => string }) => {
  return Buffer.from(remark.toString().slice(2), "hex").toString("utf8");
};

const checkTransaction = (sectionFilter: string, methodFilter: string, call: Extrinsic) => {
  let { section, method } = api.registry.findMetaCall(call.callIndex);
  return section === sectionFilter && method === methodFilter;
};

const handleDotContribution = async (extrinsic: SubstrateExtrinsic) => {
  let calls = extrinsic.extrinsic.args[0] as Vec<Extrinsic>;
  if (
    calls.length !== 2 ||
    !checkTransaction("system", "remark", calls[0]) ||
    !checkTransaction("balances", "transfer", calls[1])
  ) {
    return;
  }
  let [
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

  logger.info(remarkRaw.toString());
  let [paraId, referralCode] = parseRemark(remarkRaw).split("#");

  let record = DotContribution.create({
    id: extrinsic.extrinsic.hash.toString(),

    blockHeight: extrinsic.block.block.header.number,
    paraId: parseInt(paraId),
    account: extrinsic.extrinsic.signer.toString(),
    amount: amountRaw.toString(),
    referralCode,
    timestamp: extrinsic.block.timestamp,
    transactionExecuted: false,
  });
  logger.info(JSON.stringify(record));

  await record.save();
};

const handleAuctionBot = async (extrinsic: SubstrateExtrinsic) => {
  let batchAllCall = extrinsic.extrinsic.args[2] as Extrinsic;
  let calls = batchAllCall.args[0] as Vec<Extrinsic>;
  logger.info(calls.toString());
  let [remarkCall, ...transitionCalls] = calls.toArray();
  if (checkTransaction("system", "remark", remarkCall)) {
    logger.info(parseRemark(remarkCall.args[0].toString()));
  }
  if (transitionCalls.filter((trans) => !checkTransaction("crowdloan", "contribute", trans)).length > 0) {
    return;
  }

  let [start, end] = parseRemark(remarkCall.args[0].toString())
    .split(":")
    .map((v) => parseInt(v));
  for (let i = start; i <= end; i++) {
    let entities = await DotContribution.getByBlockHeight(i);
    for (let entity of entities) {
      let record = DotContribution.create(entity);
      record.transactionExecuted = true;
      await record.save();
    }
  }
};

export const handleBatchAll = async (extrinsic: SubstrateExtrinsic) => {
  await handleDotContribution(extrinsic);
};

export const handleProxyProxyCall = async (extrinsic: SubstrateExtrinsic) => {
  await handleAuctionBot(extrinsic);
};

export async function handleContributionCall(extrinsic: SubstrateExtrinsic): Promise<void> {
  const {
    events,
    extrinsic: { hash },
    block,
  } = extrinsic;
  const contributionEvent = events.find(({ event }) => event.section === "crowdloan" && event.method === "Contributed");
  if (contributionEvent) {
    let contributionRecord = new Contribution(hash.toString());
    const {
      event: {
        data: [contributeAccount, contributeParaId, contributeValue],
      },
    } = contributionEvent;
    contributionRecord.blockHeight = block.block.header.number.toNumber();
    contributionRecord.timestamp = block.timestamp;
    contributionRecord.account = contributeAccount.toString();
    contributionRecord.paraId = parseInt(contributeParaId.toString());
    contributionRecord.amount = (contributeValue as Balance).toBigInt();
    contributionRecord.remark = false;

    const memoUpdatedEvent = events.find(
      ({ event }) => event.section === "crowdloan" && event.method === "MemoUpdated"
    );
    if (memoUpdatedEvent) {
      const {
        event: {
          data: [memoAccount, memoParaId, memo],
        },
      } = memoUpdatedEvent;
      if (contributeAccount.eq(memoAccount) && contributeParaId.eq(memoParaId)) {
        contributionRecord.referralCode = memo.toString();
      }
    }
    await contributionRecord.save();
  }
}
