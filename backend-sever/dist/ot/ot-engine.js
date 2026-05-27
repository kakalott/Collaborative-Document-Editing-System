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
        return content.slice(0, op.position) + content.slice(op.position + 1);
    }
    return content;
}
exports.applyOperation = applyOperation;
function transform(incoming, applied) {
    const result = { ...incoming };
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
            result.position -= 1;
        }
    }
    if (applied.type === 'delete' && incoming.type === 'delete') {
        if (applied.position < incoming.position) {
            result.position -= 1;
        }
        else if (applied.position === incoming.position) {
            result.position = -1;
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
        if (op.position === -1)
            break;
    }
    return op;
}
exports.transformAgainstHistory = transformAgainstHistory;
//# sourceMappingURL=ot-engine.js.map