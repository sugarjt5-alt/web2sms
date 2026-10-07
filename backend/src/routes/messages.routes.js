const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const { sendLimiter } = require('../middleware/rateLimit.middleware');
const {
  sendMessage, cancelScheduled, getMessages, getMessageById,
} = require('../controllers/messages.controller');

// SMS илгээхийг зөвхөн системийн admin хийнэ (хэрэглэгчдэд хаалттай)
router.use(authMiddleware, requireRole('admin'));

router.post('/send', sendLimiter, sendMessage);
router.get('/', getMessages);
router.get('/:id', getMessageById);
router.post('/:id/cancel', cancelScheduled);

module.exports = router;
