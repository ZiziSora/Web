const { createApp } = require('./app');

const port = Number.parseInt(process.env.PORT, 10) || 3000;
const app = createApp();

app.listen(port, () => {
  console.log(`Ứng dụng đang chạy tại http://localhost:${port}`);
});
