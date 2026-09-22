const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
  getContacts, createContact, updateContact, deleteContact,
} = require('../controllers/contacts.controller');

router.use(authMiddleware); // энэ route бүгд нэвтэрсэн байх шаардлагатай

router.get('/', getContacts);
router.post('/', createContact);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

module.exports = router;
