const express = require("express");
const mqtt = require("mqtt");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const teamId = "its_ace"; // change if you want

const MQTT_BROKER = "mqtt://157.173.101.159"; // temporary public broker

const mqttClient = mqtt.connect(MQTT_BROKER);

const wss = new WebSocket.Server({ port: 8081 });

let clients = [];

wss.on("connection", (ws) => {
  clients.push(ws);
});

function broadcast(data) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

mqttClient.on("connect", () => {
  console.log("Connected to MQTT");
  mqttClient.subscribe(`rfid/${teamId}/card/status`);
  mqttClient.subscribe(`rfid/${teamId}/card/balance`);
});

mqttClient.on("message", (topic, message) => {
  console.log("MQTT Message Received:");
  console.log("Topic:", topic);
  console.log("Message:", message.toString());

  const data = JSON.parse(message.toString());
  broadcast(data);
});


app.post("/topup", (req, res) => {
  const { uid, amount } = req.body;

  mqttClient.publish(
    `rfid/${teamId}/card/topup`,
    JSON.stringify({ uid, amount })
  );

  res.json({ message: "Top-up sent" });
});

app.listen(3000, () => {
  console.log("HTTP running on port 3000");
});
