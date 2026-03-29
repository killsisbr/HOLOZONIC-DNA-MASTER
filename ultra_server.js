const express = require('express');
const app = express();
const PORT = 3030;

app.get('/', (req, res) => {
  res.send('ULTRA_JARVIS_3030_IS_LIVE');
});

app.listen(PORT, () => {
  console.log('ULTRA SERVER RUNNING ON 3030');
});
