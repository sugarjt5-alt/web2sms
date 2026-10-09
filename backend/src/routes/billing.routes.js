const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
  getPackages, getPaymentInfo, getOrders, createOrder, cancelOrder,
} = require('../controllers/billing.controller');

router.use(authMiddleware);

router.get('/packages', getPackages);
router.get('/payment-info', getPaymentInfo);
router.get('/orders', getOrders);
// Хэрэглэгч бүр өөрийн бүртгэлд багц захиалж, цуцлана
router.post('/orders', createOrder);
router.post('/orders/:id/cancel', cancelOrder);

module.exports = router;
