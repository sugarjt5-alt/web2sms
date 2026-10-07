const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { requireOrgOwner } = require('../middleware/role.middleware');
const {
  getOrganization, updateOrganization, getTransactions,
  addMember, updateMemberRole, removeMember,
  getApiKeys, createApiKey, revokeApiKey,
} = require('../controllers/org.controller');

router.use(authMiddleware);

router.get('/', getOrganization);
router.get('/transactions', getTransactions);

router.put('/', requireOrgOwner, updateOrganization);
router.post('/members', requireOrgOwner, addMember);
router.put('/members/:id/role', requireOrgOwner, updateMemberRole);
router.delete('/members/:id', requireOrgOwner, removeMember);

router.get('/api-keys', requireOrgOwner, getApiKeys);
router.post('/api-keys', requireOrgOwner, createApiKey);
router.delete('/api-keys/:id', requireOrgOwner, revokeApiKey);

module.exports = router;
