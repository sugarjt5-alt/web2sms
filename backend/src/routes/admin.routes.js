const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const { getAllUsers, updateUserRole } = require('../controllers/admin.controller');

router.use(authMiddleware, requireRole('admin'));

router.get('/users', getAllUsers);
router.put('/users/:id/role', updateUserRole);

module.exports = router;
