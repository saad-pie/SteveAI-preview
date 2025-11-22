// live.js

// 🛑 WARNING: This API key is exposed in the client. USE A SERVER-SIDE PROXY IN PRODUCTION.
const GEMINI_API_KEY = "AIzaSyDL3i0fCKkSnxnTG4-FLvfUxudtD4rKlos";
const MODEL_ID = "models/gemini-2.5-flash-native-audio-preview-09-2025";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`;

// UI Elements
const chatContainer = document.getElementById('chat-container');
const recordBtn = document.getElementById('record-btn');
const stopBtn = document.getElementById('stop-btn');
const statusDiv = document.getElementById('status');

// Audio variables
let mediaRecorder;
let audioChunks = [];
let audioContext;
let audioSource;

// Parameters (as requested: closable voice)
// Note: 'closable' is not a standard Gemini parameter, but often refers to system/session management.
// For the native audio model, the voice is determined by the model itself or server configuration, 
// and the session is usually "closable" by simply stopping the stream/request.
const customParams = {
    voice: "closable",
    session: "closable" 
};

/**
 * Appends a message to the chat UI.
 * @param {string} text - The content of the message.
 * @param {string} sender - 'user' or 'ai'.
 */
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Updates the recording status and controls state.
 * @param {string} message - Status message to display.
 * @param {boolean} isRecording - Whether the recording is active.
 */
function setStatus(message, isRecording = false) {
    statusDiv.textContent = message;
    recordBtn.disabled = isRecording;
    stopBtn.disabled = !isRecording;
    
    if (isRecording) {
        recordBtn.classList.add('recording');
        recordBtn.textContent = '🔴 Recording...';
    } else {
        recordBtn.classList.remove('recording');
        recordBtn.textContent = '🎤 Start Recording';
    }
}

// --- Audio Recording Functions ---

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = uploadAudio;

        mediaRecorder.start();
        setStatus('Recording...', true);
    } catch (err) {
        console.error('Error accessing microphone:', err);
        setStatus('Error: Microphone access denied.', false);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        // The mediaRecorder.onstop callback will handle the upload.
        setStatus('Processing...', false);
    }
}

// --- API Interaction ---

async function uploadAudio() {
    // 1. Convert audio chunks to a single Blob
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    
    // 2. Read Blob as ArrayBuffer for encoding
    const reader = new FileReader();
    reader.readAsArrayBuffer(audioBlob);
    
    reader.onloadend = async () => {
        const arrayBuffer = reader.result;
        // 3. Base64 encode the audio data
        const base64Audio = btoa(
            new Uint8Array(arrayBuffer)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        // 4. Construct the API Payload
        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [
                        // The audio data part
                        {
                            inlineData: {
                                mimeType: audioBlob.type,
                                data: base64Audio
                            }
                        }
                    ]
                }
            ],
            config: {
                // Add any necessary configuration here, like system instructions or safety settings
                // The 'closable' voice/session parameters are primarily for server-side control,
                // but we include them here if they map to a valid config field later.
                custom_params: customParams 
            }
        };

        try {
            setStatus('Sending audio to Gemini...');
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            handleGeminiResponse(data);

        } catch (error) {
            console.error('Gemini API request failed:', error);
            setStatus(`API Failed: ${error.message}`, false);
            addMessage('Sorry, I encountered an error.', 'ai');
        }
    };
}

// --- Response Handling ---

/**
 * Handles the response from the Gemini API, displaying the text and playing the audio.
 * @param {object} data - The JSON response from the API.
 */
function handleGeminiResponse(data) {
    setStatus('Receiving response...', false);
    const candidate = data.candidates?.[0]?.content?.parts?.[0];
    
    if (candidate) {
        const text = candidate.text || "No text response.";
        addMessage(text, 'ai');

        const audioPart = candidate.inlineData;
        if (audioPart && audioPart.mimeType.startsWith('audio/') && audioPart.data) {
            playAudio(audioPart.data, audioPart.mimeType);
        }
    } else {
        const error = data.candidates?.[0]?.finishReason || "Unknown error.";
        addMessage(`AI Error: ${error}`, 'ai');
    }
    setStatus('Ready', false);
}

/**
 * Decodes and plays the audio data received from the Gemini API.
 * @param {string} base64Data - Base64 encoded audio data.
 * @param {string} mimeType - The MIME type of the audio.
 */
function playAudio(base64Data, mimeType) {
    try {
        const audioBlob = new Blob([Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))], { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onplaying = () => setStatus('AI Speaking...');
        audio.onended = () => setStatus('Ready');

        audio.play().catch(e => console.error("Error playing audio:", e));
    } catch (e) {
        console.error("Audio playback failure:", e);
        setStatus('Ready');
    }
}

// --- Event Listeners ---

recordBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);

// Initial message
addMessage("Press 'Start Recording' and talk to SteveAI!", 'ai');
