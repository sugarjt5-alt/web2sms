const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { requireOrgOwner } = require('../middleware/role.middleware');
const {
  getPackages, getPaymentInfo, getOrders, createOrder, cancelOrder,
} = require('../controllers/billing.controller');

router.use(authMiddleware);

router.get('/packages', getPackages);
router.get('/payment-info', getPaymentInfo);
router.get('/orders', getOrders);
// Төлбөртэй үйлдлийг зөвхөн байгууллагын эзэн хийнэ
router.post('/orders', requireOrgOwner, createOrder);
router.post('/orders/:id/cancel', requireOrgOwner, cancelOrder);

module.exports = router;
