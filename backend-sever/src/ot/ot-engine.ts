/**
 * Operational Transformation Engine (tối giản)
 *
 * Mỗi thao tác (Operation) là một trong hai loại:
 *   - insert: chèn ký tự tại vị trí position
 *   - delete: xoá ký tự tại vị trí position
 *
 * Khi hai client A và B cùng sửa đồng thời từ cùng một revision,
 * server dùng hàm transform() để điều chỉnh operation của B
 * sao cho nó vẫn đúng sau khi operation của A đã được áp dụng.
 *
 * Ví dụ:
 *   Document: "ac"   revision: 0
 *   Client A gửi: insert('b', pos=1)  → "abc"
 *   Client B gửi: insert('d', pos=1)  → "adc"  (dựa trên revision 0)
 *
 *   Server nhận A trước, áp dụng → "abc"
 *   Server transform B against A: pos của B dịch sang phải 1 → insert('d', pos=2)
 *   Áp dụng B đã transform → "abdc"  ✓ (cả hai thao tác đều tồn tại)
 */

export type OpType = 'insert' | 'delete';

export interface Operation {
  type: OpType;
  position: number;   // vị trí trong chuỗi (0-indexed)
  char?: string;      // ký tự cần chèn (chỉ dùng khi type = 'insert')
  length?: number;    // số ký tự cần xóa (chỉ dùng khi type = 'delete', mặc định = 1)
  clientId: string;   // socket.id của người gửi
  documentId: string; // ID tài liệu
  revision: number;   // revision của document tại thời điểm client gửi
}

export interface DocumentState {
  content: string;
  title?: string;
  revision: number;
  // Lịch sử các operation đã áp dụng (để transform các op đến muộn)
  history: Operation[];
}

/**
 * Áp dụng một operation lên chuỗi văn bản.
 * Trả về chuỗi mới sau khi áp dụng.
 */
export function applyOperation(content: string, op: Operation): string {
  if (op.type === 'insert') {
    const pos = Math.min(op.position, content.length);
    return content.slice(0, pos) + (op.char ?? '') + content.slice(pos);
  }

  if (op.type === 'delete') {
    if (op.position < 0 || op.position >= content.length) {
      return content; // vị trí không hợp lệ, bỏ qua
    }
    const deleteLen = op.length ?? 1; // Mặc định xóa 1 ký tự nếu không có length
    const endPos = Math.min(op.position + deleteLen, content.length);
    return content.slice(0, op.position) + content.slice(endPos);
  }

  return content;
}

/**
 * Transform operation `incoming` dựa trên operation `applied`
 * đã được áp dụng trước đó lên document.
 *
 * Mục tiêu: điều chỉnh position của `incoming` sao cho vẫn
 * chỉ đúng vị trí người dùng muốn, sau khi `applied` đã thay đổi document.
 */
export function transform(incoming: Operation, applied: Operation): Operation {
  const result = { ...incoming };
  const appliedLen = applied.length ?? 1;
  const incomingLen = incoming.length ?? 1;

  // Cả hai đều là insert
  if (applied.type === 'insert' && incoming.type === 'insert') {
    if (applied.position < incoming.position) {
      // applied chèn trước vị trí của incoming → dịch sang phải 1
      result.position += 1;
    } else if (applied.position === incoming.position) {
      // Cùng vị trí: ưu tiên theo clientId (tie-breaking deterministic)
      if (applied.clientId < incoming.clientId) {
        result.position += 1;
      }
    }
  }

  // applied là insert, incoming là delete
  if (applied.type === 'insert' && incoming.type === 'delete') {
    if (applied.position <= incoming.position) {
      // applied chèn vào trước hoặc tại vị trí delete → delete phải dịch phải 1
      result.position += 1;
    }
  }

  // applied là delete, incoming là insert
  if (applied.type === 'delete' && incoming.type === 'insert') {
    if (applied.position < incoming.position) {
      // applied xoá ký tự(s) trước vị trí insert → insert dịch trái
      result.position = Math.max(applied.position, incoming.position - appliedLen);
    }
  }

  // Cả hai đều là delete
  if (applied.type === 'delete' && incoming.type === 'delete') {
    if (applied.position < incoming.position) {
      // applied xoá ký tự(s) trước vị trí của incoming → dịch trái
      result.position = Math.max(applied.position, incoming.position - appliedLen);
    } else if (applied.position < incoming.position + incomingLen && incoming.position <= applied.position) {
      // Có overlap: incoming xóa từ region mà applied xóa
      // Tính toán vị trí mới sau khi xóa chồng lấp
      result.position = applied.position;
      // Giảm length của incoming nếu applied xóa phần của nó
      const overlap = Math.min(incoming.position + incomingLen, applied.position + appliedLen) - Math.max(incoming.position, applied.position);
      result.length = Math.max(0, incomingLen - overlap);
      if (result.length === 0) {
        result.position = -1; // no-op
      }
    }
  }

  return result;
}

/**
 * Transform một operation `incoming` qua toàn bộ lịch sử
 * từ revision của incoming đến revision hiện tại.
 *
 * Dùng khi client gửi operation dựa trên revision cũ
 * (do độ trễ mạng) và server cần "catch up" trước khi áp dụng.
 */
export function transformAgainstHistory(
  incoming: Operation,
  history: Operation[],
  fromRevision: number,
): Operation {
  let op = { ...incoming };
  // Chỉ transform qua các operation xảy ra sau revision của incoming
  const relevantHistory = history.slice(fromRevision);
  for (const pastOp of relevantHistory) {
    op = transform(op, pastOp);
    // Dừng sớm nếu trở thành no-op
    if (op.position === -1 || (op.type === 'delete' && op.length === 0)) break;
  }
  return op;
}
