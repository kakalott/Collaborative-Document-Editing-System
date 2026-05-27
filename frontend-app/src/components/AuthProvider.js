import React, { createContext, useContext, useState } from "react";
import axios from "axios";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const register = async (formData) => {
    const { fullname, email, password } = formData;
    // POST /users/register — trả về user object từ MongoDB
    const response = await axios.post("http://localhost:3000/users/register/", {
      fullname,
      email,
      password,
    });
    return response; // caller chỉ cần biết thành công hay không
  };

  const login = async (email, password) => {
    const res = await axios.post("http://localhost:3000/auth/signin/", {
      email,
      password,
    });
    const loggedInUser = res?.data?.user;
    setUser(loggedInUser);
    localStorage.setItem("user", JSON.stringify(loggedInUser));
    localStorage.setItem("accessToken", res.data.access_token);
    return loggedInUser;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("accessToken");
  };

  return (
    <AuthContext.Provider value={{ user, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;