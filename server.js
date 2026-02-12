const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mqtt = require('mqtt');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// === YOUR CONFIG ===
const TEAM_ID = 'its_florissa';  // Must match your ESP8266
const MQTT_BROKER = '157.173.101.159'; // Testing — change to '157.173.101.59' later
const MQTT_PORT = 1883;

const STATUS_TOPIC  = `rfid/${TEAM_ID}/card/status`;
const BALANCE_TOPIC = `rfid/${TEAM_ID}/card/balance`;
const TOPUP_TOPIC   = `rfid/${TEAM_ID}/card/topup`;

// MQTT Client
const mqttClient = mqtt.connect(`mqtt://${MQTT_BROKER}:${MQTT_PORT}`, {
  clientId: `backend_${TEAM_ID}_${Math.random().toString(16).slice(3)}`
});

mqttClient.on('connect', () => {
  console.log('MQTT connected to broker');
  mqttClient.subscribe([STATUS_TOPIC, BALANCE_TOPIC], (err) => {
    if (!err) console.log(`Subscribed to ${STATUS_TOPIC} and ${BALANCE_TOPIC}`);
  });
});

mqttClient.on('message', (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    console.log(`MQTT message on ${topic}:`, payload);

    // Send with 'data' key to match dashboard
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ topic, data: payload }));
console.log('[WS] Sent to client:', { topic, data: payload });
      }
    });
  } catch (e) {
    console.error('Invalid MQTT message:', e);
  }
});

mqttClient.on('error', (err) => console.error('MQTT error:', err));

// HTTP middleware
app.use(express.json());

// POST /topup - from dashboard
app.post('/topup', (req, res) => {
  const { uid, amount } = req.body;

  if (!uid || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid uid or amount (>0)' });
  }

  const payload = JSON.stringify({ uid, amount });
  mqttClient.publish(TOPUP_TOPIC, payload);
  console.log(`Published top-up to ${TOPUP_TOPIC}:`, payload);

  res.json({ success: true, message: 'Top-up command sent' });
});

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('Dashboard connected via WebSocket');
  ws.send(JSON.stringify({ message: 'Connected to real-time updates' }));

  ws.on('close', () => console.log('Dashboard disconnected'));
});

// Serve dashboard (optional - put index.html in same folder)
app.use(express.static(__dirname));

const PORT = process.env.PORT || 9279;
server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
