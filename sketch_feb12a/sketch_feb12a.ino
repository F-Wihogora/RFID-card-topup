#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

#define SS_PIN 4  // SDI / SDA
#define RST_PIN 5

const char* ssid = "EdNet";
const char* password = "Huawei@123";

const char* mqtt_server = "157.173.101.159";
const char* teamId = "its_ace";

WiFiClient espClient;
PubSubClient client(espClient);
MFRC522 mfrc522(SS_PIN, RST_PIN);

long balance = 3000;  // default balance

// ------------------ Functions ------------------

void setup_wifi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  int retry = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    retry++;
    if (retry > 20) {
      Serial.println("\nFailed to connect to WiFi. Restarting...");
      ESP.restart();
    }
  }

  Serial.println("\nWiFi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived on topic: ");
  Serial.println(topic);

  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, payload);
  if (error) {
    Serial.print("JSON parse failed: ");
    Serial.println(error.c_str());
    return;
  }

  String uid = doc["uid"];
  int amount = doc["amount"];

  Serial.print("Top-up for UID: ");
  Serial.print(uid);
  Serial.print(", Amount: ");
  Serial.println(amount);

  balance += amount;
  Serial.print("New balance: ");
  Serial.println(balance);

  StaticJsonDocument<200> response;
  response["uid"] = uid;
  response["new_balance"] = balance;

  char buffer[256];
  serializeJson(response, buffer);

  String topicBalance = "rfid/" + String(teamId) + "/card/balance";
  client.publish(topicBalance.c_str(), buffer);
  Serial.println("Published new balance to MQTT.");
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Connecting to MQTT...");
    if (client.connect("ESP8266Client")) {
      Serial.println("connected!");
      String topicTopup = "rfid/" + String(teamId) + "/card/topup";
      client.subscribe(topicTopup.c_str());
      Serial.print("Subscribed to topic: ");
      Serial.println(topicTopup);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

// ------------------ Setup ------------------

void setup() {
  Serial.begin(115200);
  while (!Serial); // Wait for serial monitor

  SPI.begin();
  mfrc522.PCD_Init();
  Serial.println("MFRC522 initialized.");

  setup_wifi();

  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
}

// ------------------ Loop ------------------

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Check for new RFID card
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  if (!mfrc522.PICC_ReadCardSerial()) {
    Serial.println("Failed to read card serial.");
    return;
  }

  String uidStr = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    uidStr += String(mfrc522.uid.uidByte[i], HEX);
  }

  Serial.print("Card UID detected: ");
  Serial.println(uidStr);

  StaticJsonDocument<200> doc;
  doc["uid"] = uidStr;
  doc["balance"] = balance;

  char buffer[256];
  serializeJson(doc, buffer);

  String topicStatus = "rfid/" + String(teamId) + "/card/status";
  client.publish(topicStatus.c_str(), buffer);
  Serial.println("Published card status to MQTT.");

  delay(3000); // avoid spamming
}
