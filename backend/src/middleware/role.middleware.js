// Тодорхой role-той хэрэглэгчид л хандах эрхтэй route-уудад ашиглана.
// authMiddleware-ийн дараа дуудна — тэр нь role-ийг DB-ээс уншсан байгаа.
// Жишээ: router.get('/users', authMiddleware, requireRole('admin'), controller)
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Энэ үйлдлийг хийх эрх байхгүй' });
    }
    next();
  };
}

// Байгууллагын эзэн (owner) л хийх үйлдлүүдэд
function requireOrgOwner(req, res, next) {
  if (!req.user || req.user.orgRole !== 'owner') {
    return res.status(403).json({ message: 'Зөвхөн байгууллагын эзэн хийх боломжтой' });
  }
  next();
}

module.exports = requireRole;
module.exports.requireOrgOwner = requireOrgOwner;
