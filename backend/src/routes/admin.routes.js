const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const upload = require('../middleware/upload.middleware');
const { importUsers } = require('../controllers/adminImport.controller');
const {
  getAllUsers, updateUserRole, deleteUser,
  getOrganizations, createOrganization, addOrganizationMember, adjustCredits, setOrganizationActive,
  getRecipients, getStats,
} = require('../controllers/admin.controller');
const {
  getAllPackages, createPackage, updatePackage,
  getAllOrders, approveOrder, rejectOrder,
  getSettings, updateSettings,
} = require('../controllers/adminBilling.controller');

router.use(authMiddleware, requireRole('admin'));

router.get('/stats', getStats);

router.get('/users', getAllUsers);
router.post('/users/import', upload.single('file'), importUsers);
router.put('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

router.get('/organizations', getOrganizations);
router.post('/organizations', createOrganization);
router.post('/organizations/:id/members', addOrganizationMember);
router.post('/organizations/:id/credits', adjustCredits);
router.put('/organizations/:id/active', setOrganizationActive);

router.get('/recipients', getRecipients);

router.get('/packages', getAllPackages);
router.post('/packages', createPackage);
router.put('/packages/:id', updatePackage);

router.get('/orders', getAllOrders);
router.post('/orders/:id/approve', approveOrder);
router.post('/orders/:id/reject', rejectOrder);

router.get('/settings', getSettings);
router.put('/settings', updateSettings);

module.exports = router;
