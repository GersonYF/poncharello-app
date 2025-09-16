/*
 * Arduino Nano 33 BLE - Edge Impulse Inference + BLE Integration
 * 
 * IA en Embebidos - Proyecto Integrado
 * Autores: Gerson Yarce Franco, David Velásquez Lenis
 * Programa: Ingeniería de Datos e IA
 * 
 * Este código integra:
 * - Edge Impulse inference para clasificación de señales de tránsito
 * - Comunicación BLE para enviar resultados a la app React Native
 * - Control de sensores del Arduino Nano 33 BLE Sense
 */

/* Includes ---------------------------------------------------------------- */
#include <transit_signals_inferencing.h>
#include <Arduino_LSM9DS1.h>
#include <Arduino_LPS22HB.h>
#include <Arduino_HTS221.h>
#include <Arduino_APDS9960.h>
#include <ArduinoBLE.h>

/* BLE Configuration ------------------------------------------------------- */
const char* deviceName = "IA-Embebidos-Nano33";
const char* deviceVersion = "1.0.0";

// UUIDs del servicio UART (Nordic UART Service)
#define UART_SERVICE_UUID      "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define UART_TX_CHAR_UUID      "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"
#define UART_RX_CHAR_UUID      "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"

// Crear servicio y características BLE
BLEService uartService(UART_SERVICE_UUID);
BLECharacteristic txCharacteristic(UART_TX_CHAR_UUID, BLENotify, 20);
BLECharacteristic rxCharacteristic(UART_RX_CHAR_UUID, BLEWrite, 20);

// Variables BLE
bool deviceConnected = false;
bool inferenceMode = true;  // true = automático, false = manual
unsigned long lastInference = 0;
unsigned long inferenceInterval = 8000; // 8 segundos por defecto para dar amplio tiempo de visualización

/* Edge Impulse Configuration ---------------------------------------------- */
enum sensor_status {
    NOT_USED = -1,
    NOT_INIT,
    INIT,
    SAMPLED
};

typedef struct{
    const char *name;
    float *value;
    uint8_t (*poll_sensor)(void);
    bool (*init_sensor)(void);    
    sensor_status status;
} eiSensors;

/* Constant defines -------------------------------------------------------- */
#define CONVERT_G_TO_MS2    9.80665f
#define MAX_ACCEPTED_RANGE  2.0f
#define N_SENSORS     18

/* Forward declarations ------------------------------------------------------- */
float ei_get_sign(float number);
bool init_IMU(void);
bool init_HTS(void);
bool init_BARO(void);
bool init_APDS(void);
uint8_t poll_acc(void);
uint8_t poll_gyr(void);
uint8_t poll_mag(void);
uint8_t poll_HTS(void);
uint8_t poll_BARO(void);
uint8_t poll_APDS_color(void);
uint8_t poll_APDS_proximity(void);
uint8_t poll_APDS_gesture(void);

// BLE Functions
void initializeBLE(void);
void sendInferenceResult(ei_impulse_result_t* result);
void sendCommand(String command);
void onDataReceived(BLEDevice central, BLECharacteristic characteristic);
void processBLECommand(String command);
void runInference(void);

/* Private variables ------------------------------------------------------- */
static const bool debug_nn = false;
static float data[N_SENSORS];
static bool ei_connect_fusion_list(const char *input_list);
static int8_t fusion_sensors[N_SENSORS];
static int fusion_ix = 0;

/** Used sensors value function connected to label name */
eiSensors sensors[] =
{
    "accX", &data[0], &poll_acc, &init_IMU, NOT_USED,
    "accY", &data[1], &poll_acc, &init_IMU, NOT_USED,
    "accZ", &data[2], &poll_acc, &init_IMU, NOT_USED,
    "gyrX", &data[3], &poll_gyr, &init_IMU, NOT_USED,
    "gyrY", &data[4], &poll_gyr, &init_IMU, NOT_USED,
    "gyrZ", &data[5], &poll_gyr, &init_IMU, NOT_USED,
    "magX", &data[6], &poll_mag, &init_IMU, NOT_USED,
    "magY", &data[7], &poll_mag, &init_IMU, NOT_USED,
    "magZ", &data[8], &poll_mag, &init_IMU, NOT_USED,
    "temperature", &data[9], &poll_HTS, &init_HTS, NOT_USED,
    "humidity", &data[10], &poll_HTS, &init_HTS, NOT_USED,
    "pressure", &data[11], &poll_BARO, &init_BARO, NOT_USED,
    "red", &data[12], &poll_APDS_color, &init_APDS, NOT_USED,
    "green", &data[13], &poll_APDS_color, &init_APDS, NOT_USED,
    "blue", &data[14], &poll_APDS_color, &init_APDS, NOT_USED,
    "brightness", &data[15], &poll_APDS_color, &init_APDS, NOT_USED,
    "proximity", &data[16], &poll_APDS_proximity, &init_APDS, NOT_USED,
    "gesture", &data[17], &poll_APDS_gesture,&init_APDS, NOT_USED,
};

/**
* @brief      Arduino setup function
*/
void setup()
{
    /* Init serial */
    Serial.begin(115200);
    while (!Serial);
    
    Serial.println("=====================================");
    Serial.println("IA en Embebidos - Proyecto Integrado");
    Serial.println("Edge Impulse + BLE Communication");
    Serial.println("Autores: Gerson Yarce & David Velásquez");
    Serial.println("=====================================");

    // Configurar pines
    pinMode(LED_BUILTIN, OUTPUT);
    pinMode(2, INPUT_PULLUP); // Botón para trigger manual

    // Inicializar BLE
    initializeBLE();

    /* Connect used sensors for Edge Impulse */
    if(ei_connect_fusion_list(EI_CLASSIFIER_FUSION_AXES_STRING) == false) {
        ei_printf("ERR: Errors in sensor list detected\r\n");
        sendCommand("error");
        return;
    }

    /* Init & start sensors */
    Serial.println("Inicializando sensores...");
    for(int i = 0; i < fusion_ix; i++) {
        if (sensors[fusion_sensors[i]].status == NOT_INIT) {
            sensors[fusion_sensors[i]].status = (sensor_status)sensors[fusion_sensors[i]].init_sensor();
            if (!sensors[fusion_sensors[i]].status) {
              ei_printf("❌ %s sensor initialization failed.\r\n", sensors[fusion_sensors[i]].name);             
            }
            else {
              ei_printf("✅ %s sensor initialization successful.\r\n", sensors[fusion_sensors[i]].name);
            }
        }
    }

    Serial.println("Sistema listo para inferencia y comunicación BLE");
    sendCommand("ready");
    
    // LED de inicio
    for (int i = 0; i < 3; i++) {
        digitalWrite(LED_BUILTIN, HIGH);
        delay(200);
        digitalWrite(LED_BUILTIN, LOW);
        delay(200);
    }
}

/**
* @brief      Main loop - handles BLE and inference
*/
void loop()
{
    // Verificar conexión BLE
    BLEDevice central = BLE.central();
    
    if (central) {
        if (!deviceConnected) {
            deviceConnected = true;
            digitalWrite(LED_BUILTIN, HIGH);
            Serial.println("Cliente BLE conectado!");
            Serial.println("Dirección: " + central.address());
            sendCommand("connected");
            delay(500);
        }
        
        // Mientras esté conectado
        while (central.connected()) {
            // Verificar botón para inferencia manual
            if (digitalRead(2) == LOW) {
                static unsigned long lastButtonPress = 0;
                if (millis() - lastButtonPress > 1000) { // Debounce
                    Serial.println("Botón presionado - Iniciando inferencia manual");
                    runInference();
                    lastButtonPress = millis();
                }
            }
            
            // Inferencia automática (si está habilitada)
            if (inferenceMode && (millis() - lastInference > inferenceInterval)) {
                Serial.println("Iniciando inferencia automática");
                runInference();
                lastInference = millis();
            }
            
            delay(100);
        }
        
        // Cliente desconectado
        if (deviceConnected) {
            deviceConnected = false;
            digitalWrite(LED_BUILTIN, LOW);
            Serial.println("Cliente BLE desconectado");
        }
    }
    
    // Parpadeo lento si no hay conexión
    if (!deviceConnected) {
        static unsigned long lastBlink = 0;
        if (millis() - lastBlink > 1000) {
            digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
            lastBlink = millis();
        }
    }
}

/**
 * @brief Initialize BLE service and characteristics
 */
void initializeBLE(void) {
    Serial.println("Inicializando BLE...");
    
    if (!BLE.begin()) {
        Serial.println("Error: No se pudo inicializar BLE");
        while (1) {
            digitalWrite(LED_BUILTIN, HIGH);
            delay(100);
            digitalWrite(LED_BUILTIN, LOW);
            delay(100);
        }
    }
    
    // Configurar dispositivo BLE
    BLE.setLocalName(deviceName);
    BLE.setDeviceName(deviceName);
    BLE.setAdvertisedService(uartService);
    
    // Agregar características al servicio
    uartService.addCharacteristic(txCharacteristic);
    uartService.addCharacteristic(rxCharacteristic);
    
    // Agregar servicio al dispositivo BLE
    BLE.addService(uartService);
    
    // Configurar callback para recibir datos
    rxCharacteristic.setEventHandler(BLEWritten, onDataReceived);
    
    // Valores iniciales
    txCharacteristic.writeValue("IA-Embebidos Ready");
    
    // Comenzar advertising
    BLE.advertise();
    
    Serial.println("BLE inicializado correctamente");
    Serial.println("Nombre: " + String(deviceName));
    Serial.println("Servicio: " + String(UART_SERVICE_UUID));
    Serial.println("Esperando conexión desde la app...");
}

/**
 * @brief Run Edge Impulse inference and send results via BLE
 */
void runInference(void) {
    Serial.println("\nIniciando inferencia...");
    sendCommand("inferencing");

    if (EI_CLASSIFIER_RAW_SAMPLES_PER_FRAME != fusion_ix) {
        ei_printf("ERR: Sensors don't match the sensors required in the model\r\n"
        "Following sensors are required: %s\r\n", EI_CLASSIFIER_FUSION_AXES_STRING);
        sendCommand("error");
        return;
    }

    ei_printf("Sampling...\r\n");

    // Allocate buffer for sensor readings
    float buffer[EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE] = { 0 };

    // Collect sensor data
    for (size_t ix = 0; ix < EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE; ix += EI_CLASSIFIER_RAW_SAMPLES_PER_FRAME) {
        int64_t next_tick = (int64_t)micros() + ((int64_t)EI_CLASSIFIER_INTERVAL_MS * 1000);

        for(int i = 0; i < fusion_ix; i++) {
            if (sensors[fusion_sensors[i]].status == INIT) {
                sensors[fusion_sensors[i]].poll_sensor();
                sensors[fusion_sensors[i]].status = SAMPLED;
            }
            if (sensors[fusion_sensors[i]].status == SAMPLED) {
                buffer[ix + i] = *sensors[fusion_sensors[i]].value;
                sensors[fusion_sensors[i]].status = INIT;
            }
        }

        int64_t wait_time = next_tick - (int64_t)micros();
        if(wait_time > 0) {
            delayMicroseconds(wait_time);
        }
    }

    // Create signal from buffer
    signal_t signal;
    int err = numpy::signal_from_buffer(buffer, EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE, &signal);
    if (err != 0) {
        ei_printf("ERR: Signal creation failed (%d)\r\n", err);
        sendCommand("error");
        return;
    }

    // Run the classifier
    ei_impulse_result_t result = { 0 };
    err = run_classifier(&signal, &result, debug_nn);
    if (err != EI_IMPULSE_OK) {
        ei_printf("ERR: Classification failed (%d)\r\n", err);
        sendCommand("error");
        return;
    }

    // Send results via BLE
    sendInferenceResult(&result);

    // Print results to serial
    ei_printf("Predictions (DSP: %d ms., Classification: %d ms., Anomaly: %d ms.):\r\n",
        result.timing.dsp, result.timing.classification, result.timing.anomaly);
    
    for (size_t ix = 0; ix < EI_CLASSIFIER_LABEL_COUNT; ix++) {
        ei_printf("  %s: %.5f\r\n", result.classification[ix].label, result.classification[ix].value);
    }

#if EI_CLASSIFIER_HAS_ANOMALY == 1
    ei_printf("  Anomaly score: %.3f\r\n", result.anomaly);
#endif

    Serial.println("Inferencia completada y enviada por BLE\n");
}

/**
 * @brief Send inference results via BLE to the app
 */
void sendInferenceResult(ei_impulse_result_t* result) {
    if (!deviceConnected || !txCharacteristic.subscribed()) {
        return;
    }

    // Find the prediction with highest confidence
    float max_confidence = 0.0;
    String predicted_class = "unknown";
    
    for (size_t ix = 0; ix < EI_CLASSIFIER_LABEL_COUNT; ix++) {
        if (result->classification[ix].value > max_confidence) {
            max_confidence = result->classification[ix].value;
            predicted_class = String(result->classification[ix].label);
        }
    }

    // Map predictions to app commands específicos para señales de tránsito
    String ble_command = "siga"; // Default
    
    // Convertir a minúsculas para comparación
    predicted_class.toLowerCase();
    
    // Mapeo específico para tu modelo de señales de tránsito
    if (predicted_class.indexOf("siga") >= 0 || predicted_class.indexOf("go") >= 0 || predicted_class.indexOf("green") >= 0) {
        ble_command = "siga";
    }
    else if (predicted_class.indexOf("pare") >= 0 || predicted_class.indexOf("stop") >= 0 || predicted_class.indexOf("red") >= 0) {
        ble_command = "pare";
    }
    else if (predicted_class.indexOf("derecha") >= 0 || predicted_class.indexOf("right") >= 0 || predicted_class.indexOf("turn_right") >= 0) {
        ble_command = "gire_derecha";
    }
    else if (predicted_class.indexOf("izquierda") >= 0 || predicted_class.indexOf("left") >= 0 || predicted_class.indexOf("turn_left") >= 0) {
        ble_command = "gire_izquierda";
    }
    else if (predicted_class.indexOf("reversa") >= 0 || predicted_class.indexOf("reverse") >= 0 || predicted_class.indexOf("back") >= 0) {
        ble_command = "reversa";
    }
    else if (predicted_class.indexOf("caution") >= 0 || predicted_class.indexOf("yellow") >= 0 || predicted_class.indexOf("warning") >= 0) {
        ble_command = "pare"; // Precaución = Pare
    }
    else {
        // Si la confianza es muy baja, usar comando por defecto basado en confianza
        if (max_confidence < 0.5) {
            ble_command = "pare"; // Baja confianza = Pare por seguridad
        } else if (max_confidence < 0.7) {
            ble_command = "siga"; // Confianza media = Siga con precaución
        } else {
            // Alta confianza pero clase desconocida, usar el índice de mayor probabilidad
            size_t max_ix = 0;
            for (size_t ix = 1; ix < EI_CLASSIFIER_LABEL_COUNT; ix++) {
                if (result->classification[ix].value > result->classification[max_ix].value) {
                    max_ix = ix;
                }
            }
            
            // Mapeo por índice si el nombre no coincide
            switch(max_ix % 5) {
                case 0: ble_command = "siga"; break;
                case 1: ble_command = "pare"; break;
                case 2: ble_command = "gire_derecha"; break;
                case 3: ble_command = "gire_izquierda"; break;
                case 4: ble_command = "reversa"; break;
                default: ble_command = "siga"; break;
            }
        }
    }

    // Send the command
    sendCommand(ble_command);
    
    // Send detailed info if connected (formato: "comando:confianza:clase")
    String detailed_info = ble_command + ":" + String(max_confidence, 2) + ":" + predicted_class;
    if (detailed_info.length() <= 20) { // BLE characteristic limit
        delay(100);
        txCharacteristic.writeValue(detailed_info.c_str());
    } else {
        // Si es muy largo, enviar solo comando y confianza
        String short_info = ble_command + ":" + String(max_confidence, 2);
        delay(100);
        txCharacteristic.writeValue(short_info.c_str());
    }

    Serial.println("Resultado enviado: " + ble_command + " (clase: " + predicted_class + ", confianza: " + String(max_confidence, 3) + ")");
    
    // Visual feedback
    digitalWrite(LED_BUILTIN, LOW);
    delay(50);
    digitalWrite(LED_BUILTIN, HIGH);
}

/**
 * @brief Send command to the app
 */
void sendCommand(String command) {
    if (deviceConnected && txCharacteristic.subscribed()) {
        txCharacteristic.writeValue(command.c_str());
        Serial.println("Comando enviado: '" + command + "'");
    }
}

/**
 * @brief Handle data received from the app
 */
void onDataReceived(BLEDevice central, BLECharacteristic characteristic) {
    String receivedData = "";
    
    // Método correcto para ArduinoBLE
    int dataLength = characteristic.valueLength();
    const uint8_t* data = characteristic.value();
    
    for (int i = 0; i < dataLength; i++) {
        receivedData += (char)data[i];
    }
    
    // Limpiar espacios y caracteres no deseados
    receivedData.trim();
    
    if (receivedData.length() > 0) {
        Serial.println("Comando recibido: '" + receivedData + "' (longitud: " + String(receivedData.length()) + ")");
        
        // Debug: mostrar cada caracter
        Serial.print("Caracteres: ");
        for (int i = 0; i < receivedData.length(); i++) {
            Serial.print((int)receivedData[i]);
            Serial.print(" ");
        }
        Serial.println();
        
        processBLECommand(receivedData);
    } else {
        Serial.println("Comando vacío recibido");
    }
}

/**
 * @brief Process commands received from the app
 */
void processBLECommand(String command) {
    // Limpiar el comando de espacios y convertir a minúsculas
    command.trim();
    command.toLowerCase();
    
    Serial.println("Procesando comando: '" + command + "'");
    
    if (command == "inference" || command == "run") {
        Serial.println("Ejecutando inferencia inmediata...");
        runInference();
    }
    else if (command == "auto_on") {
        inferenceMode = true;
        sendCommand("auto_enabled");
        Serial.println("✅ Modo automático ACTIVADO");
    }
    else if (command == "auto_off") {
        inferenceMode = false;
        sendCommand("auto_disabled");
        Serial.println("❌ Modo automático DESACTIVADO");
    }
    else if (command == "fast") {
        inferenceInterval = 5000; // 5 segundos
        sendCommand("fast_mode");
        Serial.println("⚡ Modo rápido configurado: inferencia cada 5s");
    }
    else if (command == "medium") {
        inferenceInterval = 8000; // 8 segundos
        sendCommand("medium_mode");
        Serial.println("⚖️ Modo medio configurado: inferencia cada 8s");
    }
    else if (command == "slow") {
        inferenceInterval = 12000; // 12 segundos
        sendCommand("slow_mode");
        Serial.println("🐌 Modo lento configurado: inferencia cada 12s");
    }
    else if (command == "status") {
        sendCommand("ready");
        Serial.println("📊 Estado: Sistema listo");
        Serial.println("🔄 Modo automático: " + String(inferenceMode ? "ACTIVADO" : "DESACTIVADO"));
        Serial.println("⏱️ Intervalo actual: " + String(inferenceInterval) + "ms");
    }
    else if (command == "test") {
        Serial.println("🧪 Iniciando test de conexión...");
        sendCommand("test_start");
        delay(500);
        sendCommand("test_middle");
        delay(500);
        sendCommand("test_end");
        Serial.println("✅ Test de conexión completado");
    }
    else {
        Serial.println("❓ Comando no reconocido: '" + command + "'");
        Serial.println("📝 Comandos válidos: inference, auto_on, auto_off, fast, medium, slow, status, test");
    }
}

// ========== Edge Impulse Functions ==========

#if !defined(EI_CLASSIFIER_SENSOR) || (EI_CLASSIFIER_SENSOR != EI_CLASSIFIER_SENSOR_FUSION && EI_CLASSIFIER_SENSOR != EI_CLASSIFIER_SENSOR_ACCELEROMETER)
#error "Invalid model for current sensor"
#endif

/**
 * @brief Go through sensor list to find matching axis name
 *
 * @param axis_name
 * @return int8_t index in sensor list, -1 if axis name is not found
 */
static int8_t ei_find_axis(char *axis_name) {
    int ix;
    for(ix = 0; ix < N_SENSORS; ix++) {
        if(strstr(axis_name, sensors[ix].name)) {
            return ix;
        }
    }
    return -1;
}

/**
 * @brief Check if requested input list is valid sensor fusion, create sensor buffer
 *
 * @param[in]  input_list      Axes list to sample (ie. "accX + gyrY + magZ")
 * @retval  false if invalid sensor_list
 */
static bool ei_connect_fusion_list(const char *input_list) {
    char *buff;
    bool is_fusion = false;

    /* Copy const string in heap mem */
    char *input_string = (char *)ei_malloc(strlen(input_list) + 1);
    if (input_string == NULL) {
        return false;
    }
    memset(input_string, 0, strlen(input_list) + 1);
    strncpy(input_string, input_list, strlen(input_list));

    /* Clear fusion sensor list */
    memset(fusion_sensors, 0, N_SENSORS);
    fusion_ix = 0;

    buff = strtok(input_string, "+");

    while (buff != NULL) { /* Run through buffer */
        int8_t found_axis = 0;

        is_fusion = false;
        found_axis = ei_find_axis(buff);

        if(found_axis >= 0) {
            if(fusion_ix < N_SENSORS) {
                fusion_sensors[fusion_ix++] = found_axis;
                sensors[found_axis].status = NOT_INIT;
            }
            is_fusion = true;
        }

        buff = strtok(NULL, "+ ");
    }

    ei_free(input_string);
    return is_fusion;
}

/**
 * @brief Return the sign of the number
 * 
 * @param number 
 * @return int 1 if positive (or 0) -1 if negative
 */
float ei_get_sign(float number) {
    return (number >= 0.0) ? 1.0 : -1.0;
}

bool init_IMU(void) {
  static bool init_status = false;
  if (!init_status) {
    init_status = IMU.begin();
  }
  return init_status;
}

bool init_HTS(void) {
  static bool init_status = false;
  if (!init_status) {
    init_status = HTS.begin();
  }
  return init_status;
}

bool init_BARO(void) {
  static bool init_status = false;
  if (!init_status) {
    init_status = BARO.begin();
  }
  return init_status;
}

bool init_APDS(void) {
  static bool init_status = false;
  if (!init_status) {
    init_status = APDS.begin();
  }
  return init_status;
}

uint8_t poll_acc(void) {
    if (IMU.accelerationAvailable()) {
        IMU.readAcceleration(data[0], data[1], data[2]);
        for (int i = 0; i < 3; i++) {
            if (fabs(data[i]) > MAX_ACCEPTED_RANGE) {
                data[i] = ei_get_sign(data[i]) * MAX_ACCEPTED_RANGE;
            }
        }
        data[0] *= CONVERT_G_TO_MS2;
        data[1] *= CONVERT_G_TO_MS2;
        data[2] *= CONVERT_G_TO_MS2;
    }
    return 0;
}

uint8_t poll_gyr(void) {
    if (IMU.gyroscopeAvailable()) {
        IMU.readGyroscope(data[3], data[4], data[5]);
    }
    return 0;
}

uint8_t poll_mag(void) {
    if (IMU.magneticFieldAvailable()) {
        IMU.readMagneticField(data[6], data[7], data[8]);
    }
    return 0;
}

uint8_t poll_HTS(void) {
    data[9] = HTS.readTemperature();
    data[10] = HTS.readHumidity();
    return 0;
}

uint8_t poll_BARO(void) {
    data[11] = BARO.readPressure();
    return 0;
}

uint8_t poll_APDS_color(void) {
    int temp_data[4];
    if (APDS.colorAvailable()) {
        APDS.readColor(temp_data[0], temp_data[1], temp_data[2], temp_data[3]);
        data[12] = temp_data[0];
        data[13] = temp_data[1];
        data[14] = temp_data[2];
        data[15] = temp_data[3];
    }
    return 0;
}

uint8_t poll_APDS_proximity(void) {
    if (APDS.proximityAvailable()) {
        data[16] = (float)APDS.readProximity();
    }
    return 0;
}

uint8_t poll_APDS_gesture(void) {
    if (APDS.gestureAvailable()) {
        data[17] = (float)APDS.readGesture();
    }
    return 0;
}