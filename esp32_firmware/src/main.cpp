#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "esp_system.h"
#include "esp_wifi.h"

// --------------------
// Wi-Fi
// --------------------
const char* WIFI_SSID = "Frontier1536";
const char* WIFI_PASSWORD = "4813017779";

// --------------------
// Ashwin Cloud Backend
// --------------------
#define BACKEND_URL "https://api.ashwinwellness.com"

// User ID
const int ASHWIN_USER_ID = 1;

// Sensor pins
const int EEG_PIN = 34;
const int ECG_PIN = 35;
const int TEMP_PIN = 32;
const int LIGHT_PIN = 33;

unsigned long lastPost = 0;
const unsigned long POST_INTERVAL_MS = 5005;

unsigned long lastWifiAttempt = 0;
const unsigned long WIFI_RETRY_MS = 5000;

// --------------------
// Pillow In‑Use Detection
// --------------------
const int RAW_ACTIVE_MIN = 25;
const int RAW_ACTIVE_MAX = 4010;

const int ACTIVE_HITS_REQUIRED = 3;
const int IDLE_HITS_REQUIRED = 6;

int activeHits = 0;
int idleHits = 0;

bool inUse = false;

// --------------------
// Oversampling
// --------------------
int readSensorAverage(int pin) {

  const int samples = 12;
  long sum = 0;

  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delayMicroseconds(500);
  }

  return sum / samples;
}

// --------------------
// Signal Detection
// --------------------
bool looksActive(int raw) {
  return (raw >= RAW_ACTIVE_MIN && raw <= RAW_ACTIVE_MAX);
}

void updateInUseState(int rawEEG, int rawECG) {

  bool activeNow = looksActive(rawEEG) && looksActive(rawECG);

  if (activeNow) {
    activeHits++;
    idleHits = 0;
  } 
  else {
    idleHits++;
    activeHits = 0;
  }

  if (!inUse && activeHits >= ACTIVE_HITS_REQUIRED) {
    inUse = true;
    Serial.println("✅ Pillow IN USE (uploading data)");
  }

  if (inUse && idleHits >= IDLE_HITS_REQUIRED) {
    inUse = false;
    Serial.println("⏸ Pillow IDLE (not uploading)");
  }
}

// --------------------
// Debug
// --------------------
void printResetReason() {
  Serial.print("Reset reason: ");
  Serial.println((int)esp_reset_reason());
}

// --------------------
// WiFi Connect
// --------------------
void connectWiFi() {

  Serial.println("Connecting to WiFi...");
  Serial.print("SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("WiFi connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());

  } 
  else {

    Serial.println("WiFi connect FAILED");

  }
}

// --------------------
// Conversions
// --------------------
float adcToPercent(int raw) {
  return (raw / 4095.0f) * 100.0f;
}

float adcToTempF(int raw) {
  return 90.0f + adcToPercent(raw) * 0.10f;
}

// --------------------
// POST Reading
// --------------------
bool postReading(float eeg, float ecg, float temperature, float light) {

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected");
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;

  String url = String(BACKEND_URL) + "/ingest/raw";

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  String json =
    "{\"user_id\":" + String(ASHWIN_USER_ID) +
    ",\"eeg\":" + String(eeg, 2) +
    ",\"ecg\":" + String(ecg, 2) +
    ",\"temperature\":" + String(temperature, 2) +
    ",\"light\":" + String(light, 2) +
    "}";

  Serial.print("POST JSON → ");
  Serial.println(json);

  int code = http.POST(json);

  Serial.print("HTTP Response: ");
  Serial.println(code);

  http.end();

  return (code == 200);
}

// --------------------
// Setup
// --------------------
void setup() {

  Serial.begin(115200);
  delay(1000);

  printResetReason();

  analogSetPinAttenuation(EEG_PIN, ADC_11db);
  analogSetPinAttenuation(ECG_PIN, ADC_11db);

  connectWiFi();

  pinMode(EEG_PIN, INPUT);
  pinMode(ECG_PIN, INPUT);
  pinMode(TEMP_PIN, INPUT);
  pinMode(LIGHT_PIN, INPUT);

  Serial.println("BOOT complete");
}

// --------------------
// Loop
// --------------------
void loop() {

  if (WiFi.status() != WL_CONNECTED) {

    if (millis() - lastWifiAttempt >= WIFI_RETRY_MS) {

      lastWifiAttempt = millis();

      Serial.println("WiFi disconnected. Retrying...");

      WiFi.disconnect(true);
      delay(50);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }

  if (millis() - lastPost >= POST_INTERVAL_MS) {

    lastPost = millis();

    int rawEEG = readSensorAverage(EEG_PIN);
    int rawECG = readSensorAverage(ECG_PIN);
    int rawTEMP = readSensorAverage(TEMP_PIN);
    int rawLIGHT = readSensorAverage(LIGHT_PIN);

    updateInUseState(rawEEG, rawECG);

    static float eegSmooth = 0;
    static float ecgSmooth = 0;

    float eeg = adcToPercent(rawEEG);
    float ecg = adcToPercent(rawECG);

    eegSmooth = (eegSmooth * 0.75) + (eeg * 0.25);
    ecgSmooth = (ecgSmooth * 0.75) + (ecg * 0.25);

    eeg = eegSmooth;
    ecg = ecgSmooth;

    float temp = adcToTempF(rawTEMP);
    float light = adcToPercent(rawLIGHT);

    Serial.println("---- Reading ----");

    Serial.print("RAW EEG: ");
    Serial.println(rawEEG);

    Serial.print("RAW ECG: ");
    Serial.println(rawECG);

    Serial.print("EEG: ");
    Serial.println(eeg);

    Serial.print("ECG: ");
    Serial.println(ecg);

    Serial.print("Temp: ");
    Serial.println(temp);

    Serial.print("Light: ");
    Serial.println(light);

    Serial.print("inUse = ");
    Serial.println(inUse);

    if (!inUse) {
      Serial.println("⏭ Not uploading (pillow idle)");
      return;
    }

    postReading(eeg, ecg, temp, light);
  }
}