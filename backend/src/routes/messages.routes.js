const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
  sendMessage, getMessages, getMessageById,
} = require('../controllers/messages.controller');

router.use(authMiddleware);

router.post('/send', sendMessage);
router.get('/', getMessages);
router.get('/:id', getMessageById);

module.exports = router;
