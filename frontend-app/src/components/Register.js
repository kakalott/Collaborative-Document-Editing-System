import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "./Header";
import { useAuth } from "./AuthProvider";
import { toast } from "react-toastify";

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({ fullname: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!formData.fullname.trim()) return "Vui lòng nhập họ tên";
    if (!formData.email.trim()) return "Vui lòng nhập email";
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(formData.email)) return "Email không hợp lệ";
    if (formData.password.length < 8) return "Mật khẩu phải có ít nhất 8 ký tự";
    if (!/(?=.*\d)(?=.*[a-z])(?=.*[A-Z])/.test(formData.password))
      return "Mật khẩu cần có chữ hoa, chữ thường và số (VD: Abc12345)";
    return null;
  };

  const handleRegister = async () => {
    const error = validate();
    if (error) { toast.error(error); return; }

    setLoading(true);
    try {
      await register(formData);
      toast.success("Đăng ký thành công! Vui lòng đăng nhập.");
      navigate("/"); // chuyển về login sau khi đăng ký thành công
    } catch (err) {
      const msg = err?.response?.data?.message;
      if (msg?.includes("already exists")) {
        toast.error("Email này đã được đăng ký. Vui lòng đăng nhập.");
      } else {
        toast.error(msg ?? "Đăng ký thất bại, thử lại sau.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Header />
      <div className="flex justify-center items-center h-screen bg-grey-700">
        <div className="max-w-screen-lg mx-auto p-4 bg-white rounded-lg shadow-lg flex items-center space-x-8">
          {/* Ảnh bên trái */}
          <div className="w-1/2 h-full">
            <img
              className="object-cover w-full h-full rounded-lg"
              src="https://media.licdn.com/dms/image/D4D12AQE5tHC0fWyEyg/article-cover_image-shrink_720_1280/0/1692376418099?e=2147483647&v=beta&t=bsGV3H8crWFb9noVTa3otA7J5T-lUW_CHGtGDsgAvWU"
              alt="background"
            />
          </div>

          {/* Form bên phải */}
          <div className="w-1/2">
            <h1 className="text-3xl font-bold mb-6">Đăng ký</h1>

            <div className="mb-4">
              <input
                value={formData.fullname}
                type="text"
                placeholder="Họ và tên"
                className="input-field p-4 mx-auto w-full border rounded"
                onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
              />
            </div>
            <div className="mb-4">
              <input
                value={formData.email}
                type="email"
                placeholder="Email"
                className="input-field p-4 mx-auto w-full border rounded"
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="mb-4">
              <input
                value={formData.password}
                type="password"
                placeholder="Mật khẩu (VD: Abc12345)"
                className="input-field p-4 mx-auto w-full border rounded"
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số.
              </p>
            </div>

            <button
              onClick={handleRegister}
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-full w-full"
            >
              {loading ? "Đang đăng ký..." : "Đăng ký"}
            </button>

            <p className="text-sm mt-4 text-center text-gray-600">
              Đã có tài khoản?{" "}
              <Link to="/" className="text-blue-500 hover:underline">
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;