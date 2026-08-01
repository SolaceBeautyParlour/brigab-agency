import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;

export function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    SECRET,
    { expiresIn: "30d" }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
