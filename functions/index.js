// --- IMPORTACIONES DE V2 (¡LA FORMA CORRECTA!) ---
// onCall es para funciones invocables (como Daily.co)
const { onCall } = require("firebase-functions/v2/https");
// onUserCreate es para triggers de autenticación (como crear perfil)
const { onUserCreate } = require("firebase-functions/v2/auth");
// setGlobalOptions es para configurar el entorno (CPU, Región)
const { setGlobalOptions } = require("firebase-functions/v2");
// defineString es para leer variables de entorno (.env)
const { defineString } = require("firebase-functions/params");

// Dependencias estándar
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

// Inicializamos admin solo una vez
initializeApp();

// --- MANEJO DE VARIABLES DE ENTORNO V2 ---
// Esto le dice a Firebase: "Busca una variable llamada DAILY_APIKEY en mis .env"
const DAILY_API_KEY = defineString("DAILY_APIKEY");

// --- OPCIONES GLOBALES (¡IMPORTANTE!) ---
// Aplicamos una configuración global a todas las funciones en este archivo
// para que coincidan con la plataforma V2.
setGlobalOptions({
    region: "us-central1", // O la región que prefieras
    cpu: 1, // CPU base
    memory: "256MiB" // Memoria base
});


// --- FUNCIÓN 1: DAILY.CO (Sintaxis V2) ---
exports.createCoachingRoom = onCall(async (request) => {
    
    // Obtenemos el valor de la variable de entorno
    const dailyApiKey = DAILY_API_KEY.value();

    if (!dailyApiKey) {
        console.error("No se encontró la API Key de Daily.co en las variables de entorno.");
        throw new functions.https.HttpsError(
            'internal',
            'El servidor no está configurado para crear salas.'
        );
    }

    const DAILY_API_URL = "https://api.daily.co/v1/rooms";

    // Opciones para la sala de Daily.co
    const roomOptions = {
        properties: {
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 2), // Expira en 2 horas
            enable_chat: true,
            enable_screenshare: true,
        },
    };

    try {
        console.log("Creando sala de Daily.co (V2)...");

        const response = await axios.post(
            DAILY_API_URL,
            roomOptions,
            {
                headers: {
                    'Authorization': `Bearer ${dailyApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const roomUrl = response.data.url;
        console.log(`Sala creada exitosamente: ${roomUrl}`);
        // Retornamos el objeto en el formato V2
        return { roomUrl: roomUrl }; 

    } catch (error) {
        console.error("Error al llamar a la API de Daily.co:", error.response ? error.response.data : error.message);

        if (error.response && error.response.status === 401) {
            console.error("¡ERROR DE AUTENTICACIÓN! La API Key de Daily.co es inválida.");
            throw new functions.https.HttpsError(
                'unauthenticated',
                'La API Key de Daily.co configurada en el servidor es incorrecta.'
            );
        }

        // Error genérico
        throw new functions.https.HttpsError(
            'internal',
            'No se pudo crear la sala de video.',
            error.message
        );
    }
});


// --- FUNCIÓN 2: CREAR PERFIL AUTOMÁTICO (Sintaxis V2) ---
exports.createProfileOnRegister = onUserCreate(async (user) => {

    const { uid, email } = user;
    console.log(`Nuevo usuario registrado (V2): ${uid} (${email}). Creando perfil...`);

    // El perfil que guardaremos
    const userProfile = {
        email: email,
        role: "paciente", // ¡Rol por defecto para todos los nuevos registros!
        createdAt: FieldValue.serverTimestamp(), // Marca de tiempo
    };

    try {
        // Obtenemos la referencia a Firestore y escribimos el documento
        const userRef = getFirestore().collection('users').doc(uid);
        await userRef.set(userProfile);

        console.log(`Perfil para ${uid} creado exitosamente en Firestore.`);
        return null;

    } catch (error) {
        console.error(`Error al crear el perfil para ${uid}:`, error);
        return null;
    }
});