import { SubstrateBlock, SubstrateEvent, SubstrateExtrinsic } from "@subql/types";
export declare const handleBatchAll: (extrinsic: SubstrateExtrinsic) => Promise<void>;
export declare const handleMoonbeamContribute: ({ event, block }: SubstrateEvent) => Promise<void>;
export declare const hotfixScript: (block: SubstrateBlock) => Promise<void>;
