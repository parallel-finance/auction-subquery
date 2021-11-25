"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hotfixScript = exports.handleMoonbeamContribute = exports.handleBatchAll = void 0;
const tslib_1 = require("tslib");
const types_1 = require("../types");
const tasks_1 = (0, tslib_1.__importDefault)(require("./tasks"));
const moonbeam_patch_1 = (0, tslib_1.__importDefault)(require("./moonbeam-patch"));
const moonbeam_patch2_1 = (0, tslib_1.__importDefault)(require("./moonbeam-patch2"));
const MULTISIG_ADDR = "13wNbioJt44NKrcQ5ZUrshJqP7TKzQbzZt5nhkeL4joa3PAX";
const PROXY_ADDR = "13vj58X9YtGCRBFHrcxP6GCkBu81ALcqexiwySx18ygqAUw";
// const MULTISIG_ADDR = "EF9xmEeFv3nNVM3HyLAMTV5TU8jua5FRXCE116yfbbrZbCL";
const parseRemark = (remark) => {
    logger.info(`Remark is ${remark.toString()}`);
    return Buffer.from(remark.toString().slice(2), "hex").toString("utf8");
};
const checkTransaction = (sectionFilter, methodFilter, call) => {
    const { section, method } = api.registry.findMetaCall(call.callIndex);
    return section === sectionFilter && method === methodFilter;
};
const checkTransactionInsideProxy = (sectionFilter, methodFilter, call) => {
    if (!checkTransaction("proxy", "proxy", call))
        return false;
    const addr = call.args[0].toString();
    if (addr !== MULTISIG_ADDR) {
        logger.debug("Found proxy address: " + addr + ", expected: " + MULTISIG_ADDR);
        return false;
    }
    const insideCall = call.args[2];
    return checkTransaction(sectionFilter, methodFilter, insideCall);
};
const handleDotContribution = async (extrinsic) => {
    const calls = extrinsic.extrinsic.args[0];
    if (calls.length !== 2 ||
        !checkTransaction("system", "remark", calls[0]) ||
        !checkTransaction("balances", "transfer", calls[1])) {
        return;
    }
    const [{ args: [remarkRaw], }, { args: [addressRaw, amountRaw], },] = calls.toArray();
    if (addressRaw.toString() !== MULTISIG_ADDR) {
        return;
    }
    const [paraId, referralCode] = parseRemark(remarkRaw).split("#");
    const record = types_1.DotContribution.create({
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
const handleAuctionBot = async (extrinsic) => {
    // batchAll[
    //  remark(previous_hash)
    //  proxy(contribute(amount))
    //  proxy(addMemo(referralCode))
    // ]
    if (extrinsic.extrinsic.signer.toString() !== PROXY_ADDR) {
        return;
    }
    const [remarkCall, proxyContributeCall] = extrinsic.extrinsic.args[0].toArray();
    // Check format
    if (!checkTransaction("system", "remark", remarkCall) ||
        !checkTransactionInsideProxy("crowdloan", "contribute", proxyContributeCall)) {
        return;
    }
    let remark = remarkCall.args[0].toString();
    if (remark.length !== 66) {
        remark = parseRemark(remark);
    }
    const txIds = remark.split("#");
    txIds.forEach((txId) => logger.info(`Fetch execution of ${txId}`));
    const entities = await Promise.all(txIds.map((txId) => types_1.DotContribution.get(txId)));
    const { event: { data: [result], }, } = extrinsic.events.find((e) => e.event.section === "proxy" && e.event.method === "ProxyExecuted");
    const status = result.isOk;
    entities.forEach((entity) => (entity.isValid = status));
    await Promise.all(entities.map((entity) => {
        entity.transactionExecuted = true;
        entity.executedBlockHeight = extrinsic.block.block.header.number.toNumber();
        return entity.save();
    }));
};
const handleBatchAll = async (extrinsic) => {
    await handleDotContribution(extrinsic);
    await handleAuctionBot(extrinsic);
};
exports.handleBatchAll = handleBatchAll;
const handleMoonbeamContribute = async ({ event, block }) => {
    const [who, fund, amount] = event.data.toArray();
    if (MULTISIG_ADDR !== who.toString() || fund.toString() !== "2004") {
        return;
    }
    let record = await types_1.MoonbeanContribution.get("2004");
    if (record) {
        record.amount = (BigInt(record.amount) + BigInt(amount.toString())).toString();
    }
    else {
        record = types_1.MoonbeanContribution.create({
            id: fund.toString(),
            amount: amount.toString(),
        });
    }
    await record.save();
};
exports.handleMoonbeamContribute = handleMoonbeamContribute;
const hotfixScript = async (block) => {
    if (block.block.header.number.toNumber() === 7694900) {
        await Promise.all(tasks_1.default.nodes.map(async (node) => {
            const record = await types_1.DotContribution.get(node.id);
            record.isValid = true;
            record.transactionExecuted = false;
            record.executedBlockHeight = null;
            await record.save();
        }));
    }
    if (block.block.header.number.toNumber() === 7754100) {
        await Promise.all(moonbeam_patch_1.default.id.map(async (id) => {
            const record = await types_1.DotContribution.get(id);
            record.isValid = true;
            record.transactionExecuted = true;
            record.executedBlockHeight = 7753953;
            await record.save();
        }));
    }
    if (block.block.header.number.toNumber() === 7853900) {
        await Promise.all(moonbeam_patch2_1.default.id.map(async (id) => {
            const record = await types_1.DotContribution.get(id);
            record.isValid = true;
            record.transactionExecuted = true;
            record.executedBlockHeight = 7814744;
            await record.save();
        }));
    }
};
exports.hotfixScript = hotfixScript;
