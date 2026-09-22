// Тодорхой role-той хэрэглэгчид л хандах эрхтэй route-уудад ашиглана
// Жишээ: router.get('/users', authMiddleware, requireRole('admin'), controller)
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Энэ үйлдлийг хийх эрх байхгүй' });
    }
    next();
  };
}

module.exports = requireRole;
