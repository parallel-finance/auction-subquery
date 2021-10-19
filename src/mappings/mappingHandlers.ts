import { SubstrateExtrinsic } from "@subql/types";
import { Contribution } from "../types";
import { Balance } from "@polkadot/types/interfaces";

export async function handleContributionCall(
  extrinsic: SubstrateExtrinsic
): Promise<void> {
  const {
    success,
    events,
    extrinsic: { hash },
    block,
  } = extrinsic;
  if (success) {
    const contributionEvent = events.find(
      ({ event }) =>
        event.section === "crowdloan" && event.method === "Contributed"
    );
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
        ({ event }) =>
          event.section === "crowdloan" && event.method === "MemoUpdated"
      );
      if (memoUpdatedEvent) {
        const {
          event: {
            data: [memoAccount, memoParaId, memo],
          },
        } = memoUpdatedEvent;
        if (
          contributeAccount.eq(memoAccount) &&
          contributeParaId.eq(memoParaId)
        ) {
          contributionRecord.referralCode = memo.toString();
        }
      }
      await contributionRecord.save();
    }
  }
}
