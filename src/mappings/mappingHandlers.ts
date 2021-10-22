import { SubstrateExtrinsic } from "@subql/types";
import { Contribution, DotContribution } from "../types";
import type { Balance, Extrinsic } from "@polkadot/types/interfaces";
import type { Vec } from "@polkadot/types";

// ALICE
const MULTISIG_ADDR = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

const parseRemark = (remark: { toString: () => string }) => {
  return Buffer.from(remark.toString().slice(2), "hex").toString("utf8");
};

const handleDotContribution = async (extrinsic: SubstrateExtrinsic) => {
  let calls = extrinsic.extrinsic.args[0] as Vec<Extrinsic>;
  if (calls.length !== 2) {
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
  let calls = extrinsic.extrinsic.args[0] as Vec<Extrinsic>;
  let [remarkCall, ...transitionCalls] = calls.toArray();
  if (api.tx.system.remark.is(remarkCall)) {
    logger.info(parseRemark(remarkCall.args[0].toString()));
  }
  if (transitionCalls.filter((trans) => !api.tx.balances.transfer.is(trans)).length > 0) {
    return;
  }

  let [start, end] = parseRemark(remarkCall.args[0].toString())
    .split(":")
    .map((v) => parseInt(v));
  for (let i = start; i <= end; i++) {
    let entities = await store.getByField("DotContribution", "blockHeight", i);
    for (let entity of entities) {
      await store.set("DotContribution", entity.id, {
        transactionExecuted: true,
        ...entity,
      } as any);
    }
  }
};

export const handleBatchAll = async (extrinsic: SubstrateExtrinsic) => {
  await handleDotContribution(extrinsic);
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
