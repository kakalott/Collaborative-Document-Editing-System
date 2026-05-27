import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthProvider";
import Header from "./Header";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";

// ─── Tính delta giữa 2 chuỗi → danh sách operation nhỏ ──────────────────────
function diffToOperations(oldStr, newStr, documentId, clientId, revision) {
  let start = 0;
  while (start < oldStr.length && start < newStr.length && oldStr[start] === newStr[start]) start++;
  let oldEnd = oldStr.length;
  let newEnd = newStr.length;
  while (oldEnd > start && newEnd > start && oldStr[oldEnd - 1] === newStr[newEnd - 1]) { oldEnd--; newEnd--; }

  const ops = [];
  const deleted = oldStr.slice(start, oldEnd);
  const inserted = newStr.slice(start, newEnd);
  
  // Nếu có deletion, tạo 1 operation delete với length (thay vì multiple operations)
  if (deleted.length > 0) {
    ops.push({ type: "delete", position: start, length: deleted.length, documentId, clientId, revision });
  }
  
  // Chèn từng ký tự (giữ nguyên approach cũ)
  for (let i = 0; i < inserted.length; i++)
    ops.push({ type: "insert", position: start + i, char: inserted[i], documentId, clientId, revision });
  return ops;
}

// ─── Áp dụng 1 operation lên chuỗi ──────────────────────────────────────────
function applyOp(content, op) {
  if (op.type === "insert" && op.position >= 0) {
    const pos = Math.min(op.position, content.length);
    return content.slice(0, pos) + (op.char ?? "") + content.slice(pos);
  }
  if (op.type === "delete" && op.position >= 0) {
    if (op.position >= content.length) return content;
    const deleteLen = op.length ?? 1; // Mặc định xóa 1 ký tự nếu không có length
    const endPos = Math.min(op.position + deleteLen, content.length);
    return content.slice(0, op.position) + content.slice(endPos);
  }
  return content;
}

export default function Editor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { documentId: docIdFromUrl } = useParams();
  const { user: loggedInUser } = useAuth();

  const initialDocumentId = docIdFromUrl ?? location.state?.documentId ?? null;

  const [documentId, setDocumentId] = useState(initialDocumentId);
  const [title, setTitle] = useState(location.state?.title ?? "");
  const [content, setContent] = useState(location.state?.content ?? "");
  const [revision, setRevision] = useState(0);
  const [activeUsers, setActiveUsers] = useState(1);
  const [lastSaved, setLastSaved] = useState(null);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [connected, setConnected] = useState(false);

  // Refs để tránh stale closure trong event handler
  const contentRef = useRef(content);
  const revisionRef = useRef(0);
  const documentIdRef = useRef(documentId);
  const isRemote = useRef(false);
  const typingTimer = useRef(null);
  const socketRef = useRef(null);

  contentRef.current = content;
  revisionRef.current = revision;
  documentIdRef.current = documentId;

  // ─── Kiểm tra Đăng nhập ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!loggedInUser) {
      toast.warning("Vui lòng đăng nhập trước để xem/chỉnh sửa tài liệu!");
      const targetPath = documentId ? `/editor/${documentId}` : "/editor";
      navigate("/", { state: { from: targetPath } });
    }
  }, [loggedInUser, documentId, navigate]);

  // ─── Khởi tạo socket 1 lần, join room sau khi connected ─────────────────────
  useEffect(() => {
    const socket = io("http://localhost:3000", { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id);
      setConnected(true);

      // Join room ngay sau khi connect — đảm bảo socket đã sẵn sàng
      if (documentIdRef.current && loggedInUser) {
        socket.emit("join-document", {
          documentId: documentIdRef.current,
          fullname: loggedInUser.fullname,
          email: loggedInUser.email,
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      setConnected(false);
    });

    // Nhận trạng thái ban đầu khi join room
    socket.on("document-init", ({ content: c, revision: rev, title: t }) => {
      console.log("[Socket] document-init, revision:", rev);
      isRemote.current = true;
      setContent(c ?? "");
      setRevision(rev ?? 0);
      revisionRef.current = rev ?? 0;
      if (t !== undefined) setTitle(t);
      isRemote.current = false;
    });

    // Nhận operation từ người khác → áp dụng trực tiếp
    socket.on("remote-operation", ({ op, revision: newRev }) => {
      isRemote.current = true;
      setContent((prev) => applyOp(prev, op));
      setRevision(newRev);
      revisionRef.current = newRev;
      isRemote.current = false;
    });

    // Nhận thay đổi tiêu đề từ người khác
    socket.on("remote-title", ({ title: newTitle }) => {
      setTitle(newTitle);
    });

    socket.on("ack", ({ revision: newRev }) => {
      setRevision(newRev);
      revisionRef.current = newRev;
    });

    socket.on("auto-saved", ({ savedAt }) => {
      setLastSaved(new Date(savedAt).toLocaleTimeString("vi-VN"));
    });

    socket.on("save-document-success", (data) => {
      if (data._id && !documentIdRef.current) {
        setDocumentId(data._id);
        documentIdRef.current = data._id;
        window.history.replaceState(null, "", `/editor/${data._id}`);
      }
      toast.success(`Đã lưu "${data.title ?? title}"`);
    });

    socket.on("active-users", ({ count }) => setActiveUsers(count));
    socket.on("user-joined", ({ fullname }) => toast.info(`${fullname} vừa tham gia`));
    socket.on("user-left", () => setActiveUsers((n) => Math.max(1, n - 1)));

    socket.on("typing_indicator", ({ fullname, isTyping }) => {
      setTypingUsers((prev) =>
        isTyping ? (prev.includes(fullname) ? prev : [...prev, fullname])
                 : prev.filter((u) => u !== fullname)
      );
    });

    socket.on("updateStyleBold", setBold);
    socket.on("updateStyleItalic", setItalic);
    socket.on("updateStyleUnderline", setUnderline);

    return () => { socket.disconnect(); };
  }, []); // chỉ chạy 1 lần khi mount

  // ─── Join document khi loggedInUser load xong (nếu chưa join lúc connect) ───
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !loggedInUser || !documentId) return;
    if (socket.connected) {
      socket.emit("join-document", {
        documentId,
        fullname: loggedInUser.fullname,
        email: loggedInUser.email,
      });
    }
    // Nếu chưa connected, sẽ join trong handler "connect" ở trên
  }, [loggedInUser, documentId]);

  // ─── Thay đổi nội dung → gửi delta ──────────────────────────────────────────
  const handleContentChange = useCallback((e) => {
    const newContent = e.target.value;
    const oldContent = contentRef.current;
    const socket = socketRef.current;
    const docId = documentIdRef.current;

    if (!isRemote.current && docId && socket?.connected) {
      const ops = diffToOperations(oldContent, newContent, docId, socket.id, revisionRef.current);
      ops.forEach((op) => socket.emit("operation", op));
    }

    setContent(newContent);

    // Typing indicator
    clearTimeout(typingTimer.current);
    const docId2 = documentIdRef.current;
    socket?.emit("user_start_typing", { roomId: docId2, fullname: loggedInUser?.fullname, email: loggedInUser?.email });
    typingTimer.current = setTimeout(() => {
      socket?.emit("user_stop_typing", { roomId: docId2, fullname: loggedInUser?.fullname });
    }, 1500);
  }, [loggedInUser]);

  // ─── Thay đổi tiêu đề → broadcast cho room ───────────────────────────────────
  const handleTitleChange = useCallback((e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    const socket = socketRef.current;
    const docId = documentIdRef.current;
    if (docId && socket?.connected) {
      socket.emit("title-change", { documentId: docId, title: newTitle });
    }
  }, []);

  // ─── Style ───────────────────────────────────────────────────────────────────
  const handleBold = () => { const v = !bold; setBold(v); socketRef.current?.emit("updateStyleBold", { documentId, bold: v }); };
  const handleItalic = () => { const v = !italic; setItalic(v); socketRef.current?.emit("updateStyleItalic", { documentId, italic: v }); };
  const handleUnderline = () => { const v = !underline; setUnderline(v); socketRef.current?.emit("updateStyleUnderline", { documentId, underline: v }); };

  // ─── Save ────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    socketRef.current?.emit("save-document", {
      documentId,
      title,
      content,
      clientId: socketRef.current?.id,
      fullname: loggedInUser?.fullname,
      email: loggedInUser?.email,
    });
  };

  // ─── Copy share link ─────────────────────────────────────────────────────────
  const handleCopyLink = () => {
    if (!documentId) { toast.warning("Lưu tài liệu trước để tạo link!"); return; }
    navigator.clipboard.writeText(`${window.location.origin}/editor/${documentId}`);
    toast.success("Đã copy link chia sẻ!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-400 to-blue-100">
      <Header />
      <div className="container mx-auto px-4 py-8 md:w-3/4 bg-gradient-to-r from-purple-500 to-purple-300 rounded-lg shadow-lg">

        {/* Status bar */}
        <div className="flex justify-between items-center mb-3 text-sm text-white">
          <span className="font-bold">
            👤 {loggedInUser?.fullname}
            <span className={`ml-2 text-xs ${connected ? "text-green-300" : "text-red-300"}`}>
              ● {connected ? "Đã kết nối" : "Đang kết nối..."}
            </span>
          </span>
          <span>
            🟢 {activeUsers} người đang chỉnh sửa
            {lastSaved && <span className="ml-3 opacity-75">💾 {lastSaved}</span>}
          </span>
          <span className="opacity-75 text-xs">rev.{revision}</span>
        </div>

        {/* Share link */}
        {documentId && (
          <div className="flex items-center gap-2 mb-3 bg-white bg-opacity-20 rounded-lg px-3 py-2">
            <span className="text-white text-xs flex-shrink-0">🔗</span>
            <input
              readOnly
              value={`${window.location.origin}/editor/${documentId}`}
              className="flex-1 text-xs bg-transparent text-white outline-none truncate"
              onFocus={(e) => e.target.select()}
            />
            <button onClick={handleCopyLink} className="flex-shrink-0 bg-white text-purple-700 text-xs font-bold px-3 py-1 rounded-md hover:bg-purple-100">
              Copy
            </button>
          </div>
        )}

        {/* Tiêu đề — đồng bộ real-time */}
        <div className="mb-4">
          <input
            type="text"
            className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            value={title}
            onChange={handleTitleChange}
            placeholder="Tiêu đề tài liệu..."
          />
        </div>

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <p className="text-center text-white text-sm mb-2">{typingUsers.join(", ")} đang gõ...</p>
        )}

        {/* Toolbar */}
        <div className="flex justify-between mb-4">
          <div className="flex gap-2">
            <button className={`px-4 py-2 rounded-md text-white ${bold ? "bg-orange-800" : "bg-orange-600 hover:bg-orange-700"}`} onClick={handleBold}><b>B</b></button>
            <button className={`px-4 py-2 rounded-md text-white ${italic ? "bg-green-800" : "bg-green-600 hover:bg-green-700"}`} onClick={handleItalic}><i>I</i></button>
            <button className={`px-4 py-2 rounded-md text-white ${underline ? "bg-orange-800" : "bg-orange-600 hover:bg-orange-700"}`} onClick={handleUnderline}><u>U</u></button>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600" onClick={handleSave}>💾 Lưu</button>
            <button className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600" onClick={handleCopyLink}>🔗 Share</button>
            <button className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600" onClick={() => navigate("/view-documents")}>📄 Danh sách</button>
          </div>
        </div>

        {/* Nội dung — đồng bộ real-time */}
        <textarea
          className="w-full h-80 border border-gray-300 rounded-lg p-4 resize-none focus:outline-none focus:border-blue-500"
          value={content}
          onChange={handleContentChange}
          placeholder="Bắt đầu gõ nội dung tài liệu..."
          style={{
            fontWeight: bold ? "bold" : "normal",
            fontStyle: italic ? "italic" : "normal",
            textDecoration: underline ? "underline" : "none",
          }}
        />
      </div>
    </div>
  );
}