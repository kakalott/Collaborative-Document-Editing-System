import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "./AuthProvider";
import Header from "./Header";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const ViewDocument = () => {
  const navigate = useNavigate();
  const [documentList, setDocumentList] = useState([]);
  const [expandedDocumentId, setExpandedDocumentId] = useState(null);
  const { user: loggedInUser } = useAuth();

  useEffect(() => {
    const fetchUserDocuments = async () => {
      if (!loggedInUser) return;
      const accessToken = localStorage.getItem("accessToken");
      try {
        const res = await axios.get(
          `http://localhost:3000/documents/getDocumentsByUserId/${loggedInUser._id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        setDocumentList(res.data);
      } catch (error) {
        console.error("Lỗi khi tải danh sách tài liệu:", error);
      }
    };
    fetchUserDocuments();
  }, [loggedInUser]);

  const handleDeleteDocument = async (documentId) => {
    const accessToken = localStorage.getItem("accessToken");
    try {
      await axios.delete(
        `http://localhost:3000/documents/deleteDocument/${documentId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setDocumentList((prev) => prev.filter((d) => d._id !== documentId));
      toast.success("Đã xoá tài liệu");
    } catch (error) {
      toast.error("Xoá thất bại");
    }
  };

  const handleOpenDocument = (doc) => {
    // Dùng URL-based route — dễ share link
    navigate(`/editor/${doc._id}`, {
      state: { title: doc.title, content: doc.content },
    });
  };

  // Copy share link trực tiếp từ danh sách
  const handleCopyLink = (docId) => {
    const link = `${window.location.origin}/editor/${docId}`;
    navigator.clipboard.writeText(link);
    toast.success("Đã copy link chia sẻ!");
  };

  return (
    <div>
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-6">Tài liệu của bạn</h1>

        {Array.isArray(documentList) && documentList.length > 0 ? (
          <ul className="space-y-3">
            {documentList.map((doc) => (
              <li key={doc._id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-medium text-gray-800">📄 {doc.title}</span>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      className="bg-blue-500 hover:bg-blue-700 text-white text-sm font-bold py-1.5 px-3 rounded"
                      onClick={() => handleOpenDocument(doc)}
                    >
                      ✏️ Mở & Chỉnh sửa
                    </button>
                    {/* Nút copy share link */}
                    <button
                      className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-bold py-1.5 px-3 rounded"
                      onClick={() => handleCopyLink(doc._id)}
                    >
                      🔗 Copy link
                    </button>
                    <button
                      className="bg-green-500 hover:bg-green-700 text-white text-sm font-bold py-1.5 px-3 rounded"
                      onClick={() => setExpandedDocumentId(expandedDocumentId === doc._id ? null : doc._id)}
                    >
                      {expandedDocumentId === doc._id ? "Thu gọn" : "Xem"}
                    </button>
                    <button
                      className="bg-red-500 hover:bg-red-700 text-white text-sm font-bold py-1.5 px-3 rounded"
                      onClick={() => handleDeleteDocument(doc._id)}
                    >
                      Xoá
                    </button>
                  </div>
                </div>

                {expandedDocumentId === doc._id && (
                  <div className="mt-3 bg-gray-50 p-3 rounded text-sm text-gray-700 whitespace-pre-wrap">
                    {doc.content || "(Tài liệu trống)"}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-gray-500 mt-10">
            Chưa có tài liệu nào. Hãy tạo tài liệu mới!
          </p>
        )}

        <div className="flex gap-3 mt-8 justify-center">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded"
            onClick={() => navigate("/editor")}
          >
            + Tạo tài liệu mới
          </button>
          <button
            className="bg-gray-400 hover:bg-gray-600 text-white font-bold py-2 px-5 rounded"
            onClick={() => navigate("/")}
          >
            Trang chủ
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewDocument;