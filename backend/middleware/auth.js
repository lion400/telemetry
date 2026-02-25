const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'solartrack-jwt-2024';

function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    req.user = jwt.verify(auth.split(' ')[1], SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function verifyTokenSync(token) {
  return jwt.verify(token, SECRET);
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    next();
  };
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '24h' });
}

module.exports = { verifyToken, verifyTokenSync, requireRole, signToken };
