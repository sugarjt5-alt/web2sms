const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const {
  getTemplates, createTemplate, updateTemplate, deleteTemplate,
} = require('../controllers/templates.controller');

router.use(authMiddleware, requireRole('admin'));

router.get('/', getTemplates);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

module.exports = router;
