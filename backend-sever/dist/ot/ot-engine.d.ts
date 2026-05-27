export type OpType = 'insert' | 'delete';
export interface Operation {
    type: OpType;
    position: number;
    char?: string;
    clientId: string;
    documentId: string;
    revision: number;
}
export interface DocumentState {
    content: string;
    title?: string;
    revision: number;
    history: Operation[];
}
export declare function applyOperation(content: string, op: Operation): string;
export declare function transform(incoming: Operation, applied: Operation): Operation;
export declare function transformAgainstHistory(incoming: Operation, history: Operation[], fromRevision: number): Operation;
