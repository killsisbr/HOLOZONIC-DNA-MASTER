const express = require('express');
const app = express();
const PORT = 3005;

app.get('/', (req, res) => {
  res.send('JARVIS TEST 3005 SUCCESS');
});

app.listen(PORT, () => {
  console.log('TEST SERVER RUNNING ON 3005');
});
