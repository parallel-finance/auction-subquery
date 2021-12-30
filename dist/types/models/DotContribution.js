"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DotContribution = void 0;
const tslib_1 = require("tslib");
const assert_1 = (0, tslib_1.__importDefault)(require("assert"));
class DotContribution {
    constructor(id) {
        this.id = id;
    }
    async save() {
        let id = this.id;
        (0, assert_1.default)(id !== null, "Cannot save DotContribution entity without an ID");
        await store.set('DotContribution', id.toString(), this);
    }
    static async remove(id) {
        (0, assert_1.default)(id !== null, "Cannot remove DotContribution entity without an ID");
        await store.remove('DotContribution', id.toString());
    }
    static async get(id) {
        (0, assert_1.default)((id !== null && id !== undefined), "Cannot get DotContribution entity without an ID");
        const record = await store.get('DotContribution', id.toString());
        if (record) {
            return DotContribution.create(record);
        }
        else {
            return;
        }
    }
    static async getByBlockHeight(blockHeight) {
        const records = await store.getByField('DotContribution', 'blockHeight', blockHeight);
        return records.map(record => DotContribution.create(record));
    }
    static async getByParaId(paraId) {
        const records = await store.getByField('DotContribution', 'paraId', paraId);
        return records.map(record => DotContribution.create(record));
    }
    static async getByExecutedBlockHeight(executedBlockHeight) {
        const records = await store.getByField('DotContribution', 'executedBlockHeight', executedBlockHeight);
        return records.map(record => DotContribution.create(record));
    }
    static create(record) {
        (0, assert_1.default)(typeof record.id === 'string', "id must be provided");
        let entity = new DotContribution(record.id);
        Object.assign(entity, record);
        return entity;
    }
}
exports.DotContribution = DotContribution;
