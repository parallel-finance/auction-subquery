import { Entity, FunctionPropertyNames } from "@subql/types";
declare type MoonbeanContributionProps = Omit<MoonbeanContribution, NonNullable<FunctionPropertyNames<MoonbeanContribution>>>;
export declare class MoonbeanContribution implements Entity {
    constructor(id: string);
    id: string;
    amount: string;
    save(): Promise<void>;
    static remove(id: string): Promise<void>;
    static get(id: string): Promise<MoonbeanContribution | undefined>;
    static create(record: MoonbeanContributionProps): MoonbeanContribution;
}
export {};
