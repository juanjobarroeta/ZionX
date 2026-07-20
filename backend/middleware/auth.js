const jwt = require("jsonwebtoken");

// Fail closed: never run with a guessable signing key. Without a strong
// JWT_SECRET anyone can forge an admin token, so refuse to start instead.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is required. Set it (a long random string) before starting the server."
  );
}

const generateToken = (user) => {
  const role = user.role || (user.is_admin ? "admin" : "user");
  const payload = { id: user.id, email: user.email, role };
  // Client-portal users carry their tenant so the server can scope every query.
  if (user.customer_id != null) payload.customer_id = user.customer_id;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
};

const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(403).json({ message: "Access denied" });

  try {
    const cleanToken = token.replace("Bearer ", "");
    const decoded = jwt.verify(cleanToken, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
};

module.exports = { generateToken, authenticateToken, isAdmin };
