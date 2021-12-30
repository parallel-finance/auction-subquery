"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoonbeanContribution = void 0;
const tslib_1 = require("tslib");
const assert_1 = (0, tslib_1.__importDefault)(require("assert"));
class MoonbeanContribution {
    constructor(id) {
        this.id = id;
    }
    async save() {
        let id = this.id;
        (0, assert_1.default)(id !== null, "Cannot save MoonbeanContribution entity without an ID");
        await store.set('MoonbeanContribution', id.toString(), this);
    }
    static async remove(id) {
        (0, assert_1.default)(id !== null, "Cannot remove MoonbeanContribution entity without an ID");
        await store.remove('MoonbeanContribution', id.toString());
    }
    static async get(id) {
        (0, assert_1.default)((id !== null && id !== undefined), "Cannot get MoonbeanContribution entity without an ID");
        const record = await store.get('MoonbeanContribution', id.toString());
        if (record) {
            return MoonbeanContribution.create(record);
        }
        else {
            return;
        }
    }
    static create(record) {
        (0, assert_1.default)(typeof record.id === 'string', "id must be provided");
        let entity = new MoonbeanContribution(record.id);
        Object.assign(entity, record);
        return entity;
    }
}
exports.MoonbeanContribution = MoonbeanContribution;
