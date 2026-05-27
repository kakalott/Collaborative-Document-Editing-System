"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformAgainstHistory = exports.transform = exports.applyOperation = void 0;
function applyOperation(content, op) {
    if (op.type === 'insert') {
        const pos = Math.min(op.position, content.length);
        return content.slice(0, pos) + (op.char ?? '') + content.slice(pos);
    }
    if (op.type === 'delete') {
        if (op.position < 0 || op.position >= content.length) {
            return content;
        }
        const deleteLen = op.length ?? 1;
        const endPos = Math.min(op.position + deleteLen, content.length);
        return content.slice(0, op.position) + content.slice(endPos);
    }
    return content;
}
exports.applyOperation = applyOperation;
function transform(incoming, applied) {
    const result = { ...incoming };
    const appliedLen = applied.length ?? 1;
    const incomingLen = incoming.length ?? 1;
    if (applied.type === 'insert' && incoming.type === 'insert') {
        if (applied.position < incoming.position) {
            result.position += 1;
        }
        else if (applied.position === incoming.position) {
            if (applied.clientId < incoming.clientId) {
                result.position += 1;
            }
        }
    }
    if (applied.type === 'insert' && incoming.type === 'delete') {
        if (applied.position <= incoming.position) {
            result.position += 1;
        }
    }
    if (applied.type === 'delete' && incoming.type === 'insert') {
        if (applied.position < incoming.position) {
            result.position = Math.max(applied.position, incoming.position - appliedLen);
        }
    }
    if (applied.type === 'delete' && incoming.type === 'delete') {
        if (applied.position < incoming.position) {
            result.position = Math.max(applied.position, incoming.position - appliedLen);
        }
        else if (applied.position < incoming.position + incomingLen && incoming.position <= applied.position) {
            result.position = applied.position;
            const overlap = Math.min(incoming.position + incomingLen, applied.position + appliedLen) - Math.max(incoming.position, applied.position);
            result.length = Math.max(0, incomingLen - overlap);
            if (result.length === 0) {
                result.position = -1;
            }
        }
    }
    return result;
}
exports.transform = transform;
function transformAgainstHistory(incoming, history, fromRevision) {
    let op = { ...incoming };
    const relevantHistory = history.slice(fromRevision);
    for (const pastOp of relevantHistory) {
        op = transform(op, pastOp);
        if (op.position === -1 || (op.type === 'delete' && op.length === 0))
            break;
    }
    return op;
}
exports.transformAgainstHistory = transformAgainstHistory;
//# sourceMappingURL=ot-engine.js.map