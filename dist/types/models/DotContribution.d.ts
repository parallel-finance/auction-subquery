import { Entity, FunctionPropertyNames } from "@subql/types";
declare type DotContributionProps = Omit<DotContribution, NonNullable<FunctionPropertyNames<DotContribution>>>;
export declare class DotContribution implements Entity {
    constructor(id: string);
    id: string;
    blockHeight: number;
    paraId: number;
    account: string;
    amount: string;
    referralCode?: string;
    timestamp: Date;
    transactionExecuted: boolean;
    isValid: boolean;
    executedBlockHeight?: number;
    save(): Promise<void>;
    static remove(id: string): Promise<void>;
    static get(id: string): Promise<DotContribution | undefined>;
    static getByBlockHeight(blockHeight: number): Promise<DotContribution[] | undefined>;
    static getByParaId(paraId: number): Promise<DotContribution[] | undefined>;
    static getByExecutedBlockHeight(executedBlockHeight: number): Promise<DotContribution[] | undefined>;
    static create(record: DotContributionProps): DotContribution;
}
export {};
