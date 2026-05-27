import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UserService } from '../user/user.service';
import { DocumentService } from 'src/document/document.service';
import { DocumentDto } from 'src/document/document.dto';
import {
  Operation,
  DocumentState,
  applyOperation,
  transformAgainstHistory,
} from '../ot/ot-engine';

/**
 * SocketGateway — xử lý toàn bộ real-time logic:
 *
 * Luồng cộng tác:
 *   1. Client join room theo documentId (join-document)
 *   2. Server gửi lại nội dung hiện tại + revision (document-init)
 *   3. Client gửi operation delta (op) thay vì full string
 *   4. Server transform op nếu có xung đột revision, áp dụng, broadcast
 *   5. Auto-save sau mỗi lần có thay đổi (debounce 3s)
 */
@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Origin', 'X-Requested-With', 'Accept', 'Authorization'],
    exposedHeaders: ['Authorization'],
    credentials: true,
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Trạng thái in-memory cho mỗi document đang được chỉnh sửa
  // Key: documentId, Value: DocumentState
  private docStates = new Map<string, DocumentState>();

  // Auto-save timers: key = documentId
  private saveTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly userService: UserService,
    private readonly documentService: DocumentService,
  ) {}

  // ─── Connection ──────────────────────────────────────────────────────────────

  handleConnection(client: Socket) {
    console.log(`[Socket] Client connected: ${client.id}`);
    client.on('userid-to-clientId-map', async (data) => {
      const { fullname, email, clientId } = data;
      await this.userService.mapClientIdToUserId(fullname, email, clientId);
    });
  }

  handleDisconnect(client: Socket) {
    console.log(`[Socket] Client disconnected: ${client.id}`);
    // Thông báo cho các user trong cùng room
    const rooms = Array.from(client.rooms).filter((r) => r !== client.id);
    rooms.forEach((docId) => {
      client.to(docId).emit('user-left', { clientId: client.id });
    });
  }

  // ─── Room join / leave ───────────────────────────────────────────────────────

  /**
   * Client yêu cầu vào phòng chỉnh sửa một document cụ thể.
   * Server trả về nội dung hiện tại + revision để client đồng bộ.
   */
  @SubscribeMessage('join-document')
  async handleJoinDocument(
    client: Socket,
    payload: { documentId: string; fullname: string; email: string },
  ) {
    const { documentId, fullname, email } = payload;
    console.log(`[Socket] ${fullname} joining document ${documentId}`);

    // Map clientId → user trong DB
    await this.userService.mapClientIdToUserId(fullname, email, client.id);

    // Join Socket.io room theo documentId
    client.join(documentId);

    // Khởi tạo state nếu chưa có (lần đầu tiên có người vào document này)
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

    // Gửi trạng thái hiện tại cho client vừa join
    client.emit('document-init', {
      content: state.content,
      title: state.title,
      revision: state.revision,
    });

    // Thông báo cho các client khác trong room
    client.to(documentId).emit('user-joined', {
      clientId: client.id,
      fullname,
    });

    // Gửi danh sách người đang online trong room này
    const roomSockets = await this.server.in(documentId).allSockets();
    this.server.to(documentId).emit('active-users', {
      count: roomSockets.size,
    });
  }

  // ─── Operational Transformation ──────────────────────────────────────────────

  /**
   * Nhận một operation (insert/delete) từ client.
   *
   * Quy trình:
   *   1. Lấy state hiện tại của document
   *   2. Nếu client gửi dựa trên revision cũ → transform op qua history
   *   3. Áp dụng op đã transform vào content
   *   4. Tăng revision, lưu vào history
   *   5. Broadcast op đã transform + revision mới tới các client khác
   *   6. Schedule auto-save
   */
  @SubscribeMessage('operation')
  async handleOperation(client: Socket, op: Operation) {
    const { documentId, revision } = op;

    if (!this.docStates.has(documentId)) {
      console.warn(`[OT] Nhận op cho document không tồn tại: ${documentId}`);
      return;
    }

    const state = this.docStates.get(documentId);

    // Transform nếu client đang ở revision cũ hơn server
    let transformedOp = op;
    if (revision < state.revision) {
      console.log(
        `[OT] Transform op từ revision ${revision} → ${state.revision}`,
      );
      transformedOp = transformAgainstHistory(op, state.history, revision);
    }

    // No-op (position = -1 sau transform, tức là xung đột đã xử lý)
    if (transformedOp.position === -1) {
      console.log(`[OT] Op trở thành no-op sau transform, bỏ qua.`);
      // Vẫn cần ack client để client biết revision hiện tại
      client.emit('ack', { revision: state.revision });
      return;
    }

    // Áp dụng op đã transform vào content
    state.content = applyOperation(state.content, transformedOp);
    state.revision += 1;
    state.history.push({ ...transformedOp, revision: state.revision });

    // Giữ history không quá 1000 op (tránh memory leak)
    if (state.history.length > 1000) {
      state.history = state.history.slice(-500);
    }

    console.log(
      `[OT] Applied op, revision: ${state.revision}, content length: ${state.content.length}`,
    );

    // Ack cho người gửi: op đã được chấp nhận, đây là revision mới
    client.emit('ack', {
      revision: state.revision,
      transformedOp,
    });

    // Broadcast op đã transform tới các client khác trong room
    client.to(documentId).emit('remote-operation', {
      op: transformedOp,
      revision: state.revision,
    });

    // Schedule auto-save (debounce 3 giây)
    this.scheduleAutoSave(documentId);
  }

  // ─── Auto-save ───────────────────────────────────────────────────────────────

  private scheduleAutoSave(documentId: string) {
    // Reset timer nếu đã có
    if (this.saveTimers.has(documentId)) {
      clearTimeout(this.saveTimers.get(documentId));
    }

    const timer = setTimeout(async () => {
      await this.autoSaveDocument(documentId);
      this.saveTimers.delete(documentId);
    }, 3000); // 3 giây sau lần thay đổi cuối

    this.saveTimers.set(documentId, timer);
  }

  private async autoSaveDocument(documentId: string) {
    const state = this.docStates.get(documentId);
    if (!state) return;

    try {
      await this.documentService.updateDocument(
        documentId,
        { content: state.content, title: state.title },
        null,
      );
      console.log(`[AutoSave] Document ${documentId} saved (revision ${state.revision})`);

      // Thông báo tới tất cả client trong room
      this.server.to(documentId).emit('auto-saved', {
        revision: state.revision,
        savedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`[AutoSave] Lỗi khi lưu document ${documentId}:`, err);
    }
  }

  // ─── Manual save ─────────────────────────────────────────────────────────────

  @SubscribeMessage('save-document')
  async handleSaveDocument(client: Socket, documentData: any) {
    // Nếu đang dùng OT (có documentId), lưu từ state in-memory
    if (documentData.documentId && this.docStates.has(documentData.documentId)) {
      // Cancel auto-save timer vì sắp save thủ công
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

    // Fallback: tạo document mới (dùng khi chưa có documentId)
    await this.userService.mapClientIdToUserId(
      documentData.fullname,
      documentData.email,
      documentData.clientId,
    );
    const user = await this.userService.getClientInfoByClientId(
      documentData.clientId,
    );
    const userId = user._id.toString();

    const modifiedDocumentData: DocumentDto = {
      title: documentData.title,
      content: documentData.content,
      userId,
    };
    const document = await this.documentService.createDocument(modifiedDocumentData);
    client.emit('save-document-success', document);
  }

  // ─── Chat / Typing ───────────────────────────────────────────────────────────

  @SubscribeMessage('send_message')
  handleMessage(client: Socket, payload: { room: string; message: string }) {
    client.to(payload.room).emit('received_message', { message: payload.message });
  }

  @SubscribeMessage('user_start_typing')
  async handleUserStartTyping(
    client: Socket,
    payload: { roomId: string; fullname: string; email: string },
  ) {
    const { roomId, fullname, email } = payload;
    await this.userService.mapClientIdToUserId(fullname, email, client.id);
    client.to(roomId).emit('typing_indicator', { fullname, isTyping: true });
  }

  @SubscribeMessage('user_stop_typing')
  async handleUserStopTyping(
    client: Socket,
    payload: { roomId: string; fullname: string; email: string },
  ) {
    const { roomId, fullname } = payload;
    client.to(roomId).emit('typing_indicator', { fullname, isTyping: false });
  }

  // Style broadcast chỉ trong đúng room (fix Cấp 1)
  // Đồng bộ tiêu đề tài liệu real-time
  @SubscribeMessage('title-change')
  handleTitleChange(
    client: Socket,
    payload: { documentId: string; title: string },
  ) {
    const { documentId, title } = payload;
    if (this.docStates.has(documentId)) {
      const state = this.docStates.get(documentId);
      state.title = title;
    }
    // Broadcast tiêu đề mới tới các client khác trong cùng room
    client.to(documentId).emit('remote-title', { title });
    // Tự động lưu tiêu đề mới
    this.scheduleAutoSave(documentId);
  }

  @SubscribeMessage('updateStyleBold')
  handleBold(client: Socket, payload: { documentId: string; bold: boolean }) {
    client.to(payload.documentId).emit('updateStyleBold', payload.bold);
  }

  @SubscribeMessage('updateStyleItalic')
  handleItalic(client: Socket, payload: { documentId: string; italic: boolean }) {
    client.to(payload.documentId).emit('updateStyleItalic', payload.italic);
  }

  @SubscribeMessage('updateStyleUnderline')
  handleUnderline(client: Socket, payload: { documentId: string; underline: boolean }) {
    client.to(payload.documentId).emit('updateStyleUnderline', payload.underline);
  }

  // Legacy join_room (giữ lại để không break code cũ nếu có)
  @SubscribeMessage('join_room')
  handleJoinRoom(client: Socket, room: string) {
    client.join(room);
  }
}