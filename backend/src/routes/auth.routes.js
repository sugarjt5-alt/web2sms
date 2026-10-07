const express = require('express');
const router = express.Router();
const { register, login, adminLogin, me } = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/admin/login', authLimiter, adminLogin);
router.get('/me', authMiddleware, me);

module.exports = router;
