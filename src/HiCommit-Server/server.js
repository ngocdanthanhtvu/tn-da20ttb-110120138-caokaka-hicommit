require('dotenv').config();

const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { isAllowedOrigin } = require('./configs/cors');
const { initializeSocket } = require('./socket');

const app = express();
const server = http.createServer(app);

// Khởi tạo socket.io với server
initializeSocket(server);

const sequelize = require('./configs/database');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const courseRoutes = require('./routes/courseRoutes');
const problemRoutes = require('./routes/problemRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const contestRoutes = require('./routes/contestRoutes');
const discussionRoutes = require('./routes/discussionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const geminiRoutes = require('./routes/geminiRoutes');

// Tăng giới hạn kích thước payload cho JSON
app.use(bodyParser.json({ limit: '20mb' }));

// Tăng giới hạn kích thước payload cho URL-encoded
app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));

app.use(cookieParser());

app.use(cors({
  origin: function (origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy' });
  }
});

// [ADMIN]
app.use('/admin', adminRoutes);

// [USER]
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/posts', postRoutes);
app.use('/courses', courseRoutes);
app.use('/problems', problemRoutes);
app.use('/discussions', discussionRoutes);
app.use('/submissions', submissionRoutes);
app.use('/contests', contestRoutes);
app.use('/gemini', geminiRoutes);

const port = process.env.PORT || 5174;
sequelize.authenticate()
  .then(() => {
    server.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });
