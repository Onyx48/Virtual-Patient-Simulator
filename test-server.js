import express from 'express';

const app = express();
const PORT = 3005; // Using a different port to avoid any conflicts

app.get('/', (req, res) => {
  res.send('Minimal Express server is running!');
});

app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});