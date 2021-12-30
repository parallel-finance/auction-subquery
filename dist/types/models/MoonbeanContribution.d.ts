import { Entity, FunctionPropertyNames } from "@subql/types";
export declare class MoonbeanContribution implements Entity {
    constructor(id: string);
    id: string;
    amount: string;
    save(): Promise<void>;
    static remove(id: string): Promise<void>;
    static get(id: string): Promise<MoonbeanContribution | undefined>;
    static create(record: Partial<Omit<MoonbeanContribution, FunctionPropertyNames<MoonbeanContribution>>> & Entity): MoonbeanContribution;
}
