const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// ---- Routes ----
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/contacts', require('./routes/contacts.routes'));
app.use('/api/groups', require('./routes/groups.routes'));
app.use('/api/messages', require('./routes/messages.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route олдсонгүй' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});
