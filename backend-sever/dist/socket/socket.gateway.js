"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const user_service_1 = require("../user/user.service");
const document_service_1 = require("../document/document.service");
const ot_engine_1 = require("../ot/ot-engine");
let SocketGateway = class SocketGateway {
    constructor(userService, documentService) {
        this.userService = userService;
        this.documentService = documentService;
        this.docStates = new Map();
        this.saveTimers = new Map();
    }
    handleConnection(client) {
        console.log(`[Socket] Client connected: ${client.id}`);
        client.on('userid-to-clientId-map', async (data) => {
            const { fullname, email, clientId } = data;
            await this.userService.mapClientIdToUserId(fullname, email, clientId);
        });
    }
    handleDisconnect(client) {
        console.log(`[Socket] Client disconnected: ${client.id}`);
        const rooms = Array.from(client.rooms).filter((r) => r !== client.id);
        rooms.forEach((docId) => {
            client.to(docId).emit('user-left', { clientId: client.id });
        });
    }
    async handleJoinDocument(client, payload) {
        const { documentId, fullname, email } = payload;
        console.log(`[Socket] ${fullname} joining document ${documentId}`);
        await this.userService.mapClientIdToUserId(fullname, email, client.id);
        client.join(documentId);
        if (!this.docStates.has(documentId)) {
            const doc = await this.documentService.getDocumentById(documentId);
            this.docStates.set(documentId, {
                content: doc?.content ?? '',
                title: doc?.title ?? '',
                revision: 0,
                history: [],
            });
        }
        const state = this.docStates.get(documentId);
        client.emit('document-init', {
            content: state.content,
            title: state.title,
            revision: state.revision,
        });
        client.to(documentId).emit('user-joined', {
            clientId: client.id,
            fullname,
        });
        const roomSockets = await this.server.in(documentId).allSockets();
        this.server.to(documentId).emit('active-users', {
            count: roomSockets.size,
        });
    }
    async handleOperation(client, op) {
        const { documentId, revision } = op;
        if (!this.docStates.has(documentId)) {
            console.warn(`[OT] Nhận op cho document không tồn tại: ${documentId}`);
            return;
        }
        const state = this.docStates.get(documentId);
        let transformedOp = op;
        if (revision < state.revision) {
            console.log(`[OT] Transform op từ revision ${revision} → ${state.revision}`);
            transformedOp = (0, ot_engine_1.transformAgainstHistory)(op, state.history, revision);
        }
        if (transformedOp.position === -1) {
            console.log(`[OT] Op trở thành no-op sau transform, bỏ qua.`);
            client.emit('ack', { revision: state.revision });
            return;
        }
        state.content = (0, ot_engine_1.applyOperation)(state.content, transformedOp);
        state.revision += 1;
        state.history.push({ ...transformedOp, revision: state.revision });
        if (state.history.length > 1000) {
            state.history = state.history.slice(-500);
        }
        console.log(`[OT] Applied op, revision: ${state.revision}, content length: ${state.content.length}`);
        client.emit('ack', {
            revision: state.revision,
            transformedOp,
        });
        client.to(documentId).emit('remote-operation', {
            op: transformedOp,
            revision: state.revision,
        });
        this.scheduleAutoSave(documentId);
    }
    scheduleAutoSave(documentId) {
        if (this.saveTimers.has(documentId)) {
            clearTimeout(this.saveTimers.get(documentId));
        }
        const timer = setTimeout(async () => {
            await this.autoSaveDocument(documentId);
            this.saveTimers.delete(documentId);
        }, 3000);
        this.saveTimers.set(documentId, timer);
    }
    async autoSaveDocument(documentId) {
        const state = this.docStates.get(documentId);
        if (!state)
            return;
        try {
            await this.documentService.updateDocument(documentId, { content: state.content, title: state.title }, null);
            console.log(`[AutoSave] Document ${documentId} saved (revision ${state.revision})`);
            this.server.to(documentId).emit('auto-saved', {
                revision: state.revision,
                savedAt: new Date().toISOString(),
            });
        }
        catch (err) {
            console.error(`[AutoSave] Lỗi khi lưu document ${documentId}:`, err);
        }
    }
    async handleSaveDocument(client, documentData) {
        if (documentData.documentId && this.docStates.has(documentData.documentId)) {
            if (this.saveTimers.has(documentData.documentId)) {
                clearTimeout(this.saveTimers.get(documentData.documentId));
                this.saveTimers.delete(documentData.documentId);
            }
            const state = this.docStates.get(documentData.documentId);
            if (state && documentData.title !== undefined) {
                state.title = documentData.title;
            }
            await this.autoSaveDocument(documentData.documentId);
            client.emit('save-document-success', {
                title: documentData.title,
                documentId: documentData.documentId,
            });
            return;
        }
        await this.userService.mapClientIdToUserId(documentData.fullname, documentData.email, documentData.clientId);
        const user = await this.userService.getClientInfoByClientId(documentData.clientId);
        const userId = user._id.toString();
        const modifiedDocumentData = {
            title: documentData.title,
            content: documentData.content,
            userId,
        };
        const document = await this.documentService.createDocument(modifiedDocumentData);
        client.emit('save-document-success', document);
    }
    handleMessage(client, payload) {
        client.to(payload.room).emit('received_message', { message: payload.message });
    }
    async handleUserStartTyping(client, payload) {
        const { roomId, fullname, email } = payload;
        await this.userService.mapClientIdToUserId(fullname, email, client.id);
        client.to(roomId).emit('typing_indicator', { fullname, isTyping: true });
    }
    async handleUserStopTyping(client, payload) {
        const { roomId, fullname } = payload;
        client.to(roomId).emit('typing_indicator', { fullname, isTyping: false });
    }
    handleTitleChange(client, payload) {
        const { documentId, title } = payload;
        if (this.docStates.has(documentId)) {
            const state = this.docStates.get(documentId);
            state.title = title;
        }
        client.to(documentId).emit('remote-title', { title });
        this.scheduleAutoSave(documentId);
    }
    handleBold(client, payload) {
        client.to(payload.documentId).emit('updateStyleBold', payload.bold);
    }
    handleItalic(client, payload) {
        client.to(payload.documentId).emit('updateStyleItalic', payload.italic);
    }
    handleUnderline(client, payload) {
        client.to(payload.documentId).emit('updateStyleUnderline', payload.underline);
    }
    handleJoinRoom(client, room) {
        client.join(room);
    }
};
exports.SocketGateway = SocketGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], SocketGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join-document'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], SocketGateway.prototype, "handleJoinDocument", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('operation'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], SocketGateway.prototype, "handleOperation", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('save-document'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], SocketGateway.prototype, "handleSaveDocument", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('send_message'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], SocketGateway.prototype, "handleMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('user_start_typing'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], SocketGateway.prototype, "handleUserStartTyping", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('user_stop_typing'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], SocketGateway.prototype, "handleUserStopTyping", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('title-change'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], SocketGateway.prototype, "handleTitleChange", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('updateStyleBold'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], SocketGateway.prototype, "handleBold", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('updateStyleItalic'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], SocketGateway.prototype, "handleItalic", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('updateStyleUnderline'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], SocketGateway.prototype, "handleUnderline", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_room'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], SocketGateway.prototype, "handleJoinRoom", null);
exports.SocketGateway = SocketGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Origin', 'X-Requested-With', 'Accept', 'Authorization'],
            exposedHeaders: ['Authorization'],
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [user_service_1.UserService,
        document_service_1.DocumentService])
], SocketGateway);
//# sourceMappingURL=socket.gateway.js.map