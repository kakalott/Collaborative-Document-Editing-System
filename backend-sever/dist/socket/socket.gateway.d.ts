import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UserService } from '../user/user.service';
import { DocumentService } from "../document/document.service";
import { Operation } from '../ot/ot-engine';
export declare class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly userService;
    private readonly documentService;
    server: Server;
    private docStates;
    private saveTimers;
    constructor(userService: UserService, documentService: DocumentService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleJoinDocument(client: Socket, payload: {
        documentId: string;
        fullname: string;
        email: string;
    }): Promise<void>;
    handleOperation(client: Socket, op: Operation): Promise<void>;
    private scheduleAutoSave;
    private autoSaveDocument;
    handleSaveDocument(client: Socket, documentData: any): Promise<void>;
    handleMessage(client: Socket, payload: {
        room: string;
        message: string;
    }): void;
    handleUserStartTyping(client: Socket, payload: {
        roomId: string;
        fullname: string;
        email: string;
    }): Promise<void>;
    handleUserStopTyping(client: Socket, payload: {
        roomId: string;
        fullname: string;
        email: string;
    }): Promise<void>;
    handleTitleChange(client: Socket, payload: {
        documentId: string;
        title: string;
    }): void;
    handleBold(client: Socket, payload: {
        documentId: string;
        bold: boolean;
    }): void;
    handleItalic(client: Socket, payload: {
        documentId: string;
        italic: boolean;
    }): void;
    handleUnderline(client: Socket, payload: {
        documentId: string;
        underline: boolean;
    }): void;
    handleJoinRoom(client: Socket, room: string): void;
}
