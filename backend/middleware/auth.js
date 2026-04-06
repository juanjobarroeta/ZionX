const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  const role = user.role || (user.is_admin ? "admin" : "user");
  return jwt.sign(
    { id: user.id, email: user.email, role },
    process.env.JWT_SECRET || "secretkey",
    { expiresIn: "7d" }
  );
};

const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization");
  console.log("🛡️ Incoming token header:", token);
  if (!token) return res.status(403).json({ message: "Access denied" });

  try {
    const cleanToken = token.replace("Bearer ", "");
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET || "secretkey");
    console.log("✅ Token decoded:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ Token verification failed:", err);
    return res.status(403).json({ message: "Invalid token" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
};

module.exports = { generateToken, authenticateToken, isAdmin };
