const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
  getGroups, getGroupById, createGroup, addContactsToGroup, deleteGroup,
} = require('../controllers/groups.controller');

router.use(authMiddleware);

router.get('/', getGroups);
router.get('/:id', getGroupById);
router.post('/', createGroup);
router.post('/:id/contacts', addContactsToGroup);
router.delete('/:id', deleteGroup);

module.exports = router;
