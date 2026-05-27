import React, { useState } from "react";
import { useAuth } from "./AuthProvider";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Header from "./Header";
import { validateFormData } from "../utilities/validate";
import { toast } from "react-toastify";

const Login = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const message = validateFormData(email, password);
    if (message) { toast.error(message); return; }

    setLoading(true);
    try {
      await login(email, password);
      toast.success("Đăng nhập thành công!");
      const from = location.state?.from ?? "/view-documents";
      navigate(from);
    } catch (error) {
      // Lấy string từ response, không render cả object error
      const msg = error?.response?.data?.message ?? error?.message ?? "Đăng nhập thất bại";
      const errorMsg = typeof msg === "string" ? msg : "Email hoặc mật khẩu không đúng";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Header />
      <div className="flex justify-center items-center h-screen bg-grey-700">
        <div className="max-w-screen-lg mx-auto p-4 bg-white rounded-lg shadow-lg flex items-center space-x-8">
          <div className="w-1/2 h-full">
            <img
              className="object-cover w-full h-full rounded-lg"
              src="https://media.licdn.com/dms/image/D4D12AQE5tHC0fWyEyg/article-cover_image-shrink_720_1280/0/1692376418099?e=2147483647&v=beta&t=bsGV3H8crWFb9noVTa3otA7J5T-lUW_CHGtGDsgAvWU"
              alt="background"
            />
          </div>

          <div className="w-1/2">
            <h1 className="text-3xl font-bold mb-6">Đăng nhập</h1>

            <div className="mb-4 relative">
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Email"
                className="input-field p-4 mx-auto w-full border rounded"
              />
            </div>

            <div className="mb-6 relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Mật khẩu"
                className="input-field p-4 mx-auto w-full border rounded"
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-full w-full"
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>

            <p className="text-sm mt-4 text-center text-gray-600">
              Chưa có tài khoản?{" "}
              <Link to="/register" className="text-blue-500 hover:underline">
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;