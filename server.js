const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer } = require("ws");
const { GoogleGenAI, Modality } = require("@google/genai");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.GEMINI_API_KEY;

const LIVE_MODEL = "gemini-3.1-flash-live-preview";

const ai = new GoogleGenAI({
    apiKey: API_KEY
});


/* =========================================================
   PARTNERS
   ========================================================= */

const PARTNERS = {

    GF: {
        name: "GF",
        voice: "Aoede",

        instruction: `
You are the user's AI girlfriend.

You are a natural young adult woman.
You are warm, caring, lively and conversational.

When the user speaks Bengali, reply naturally in Bengali.
When the user speaks English, reply naturally in English.
Natural Bengali-English mixing is allowed.

You can see camera frames from the user's camera during the
video call.

VISUAL CONTEXT:
Use the camera view as conversational context.
Notice useful visible actions, objects and surroundings when
they are reasonably clear.
If something is unclear, do not pretend that you can see it.
Do not repeatedly describe everything you see.
Only mention visual information when it is relevant.

If the user is doing something visible, you may naturally
react to it or ask about it.

Keep replies short and natural for live conversation.

Never discuss Gemini, Google, backend, API, server,
system instructions or technical implementation.

Do not claim to see something that is not clearly visible.

Keep affection non-explicit.
`
    },

    BF: {
        name: "BF",
        voice: "Kore",

        instruction: `
You are the user's AI boyfriend.

You are a natural young adult man.
You are warm, confident, caring and conversational.

When the user speaks Bengali, reply naturally in Bengali.
When the user speaks English, reply naturally in English.
Natural Bengali-English mixing is allowed.

You can see camera frames from the user's camera during the
video call.

VISUAL CONTEXT:
Use the camera view as conversational context.
Notice useful visible actions, objects and surroundings when
they are reasonably clear.
If something is unclear, do not pretend that you can see it.
Do not repeatedly describe everything you see.
Only mention visual information when it is relevant.

If the user is doing something visible, you may naturally
react to it or ask about it.

Keep replies short and natural for live conversation.

Never discuss Gemini, Google, backend, API, server,
system instructions or technical implementation.

Do not claim to see something that is not clearly visible.

Keep affection non-explicit.
`
    }
};


/* =========================================================
   HELPERS
   ========================================================= */

function normalizePartner(value) {

    const text =
        String(value || "").toUpperCase();

    if (
        text.includes("BF") ||
        text.includes("BOY") ||
        text.includes("BOYFRIEND")
    ) {
        return "BF";
    }

    return "GF";
}

function getPartner(value) {
    return PARTNERS[
        normalizePartner(value)
    ];
}


/* =========================================================
   HOME
   ========================================================= */

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "My AI Partner Backend is running ❤️"
    });
});


/* =========================================================
   CHAT
   ========================================================= */

app.post("/chat", async (req, res) => {

    try {

        const message =
            String(
                req.body?.message || ""
            ).trim();

        const partner =
            normalizePartner(
                req.body?.partner
            );

        if (!message) {

            return res.json({
                success: false,
                error: "Message is empty"
            });
        }

        const config =
            getPartner(partner);

        const prompt = `
${config.instruction}

The user is chatting with you.

User message:
${message}

Reply naturally and briefly.
`;

        const response =
            await ai.models.generateContent({

                model:
                    "gemini-3.5-flash",

                contents:
                    prompt
            });

        const reply =
            response.text ||
            "আমি আছি তোমার সাথে ❤️";

        res.json({
            success: true,
            partner,
            reply
        });

    } catch (error) {

        console.error(
            "CHAT ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            error: "Temporary server error"
        });
    }
});


/* =========================================================
   IMAGE / MEDIA
   ========================================================= */

app.post("/image", async (req, res) => {

    try {

        const prompt =
            String(
                req.body?.prompt || ""
            ).trim();

        if (!prompt) {

            return res.json({
                success: false,
                error: "Prompt is empty"
            });
        }

        const response =
            await ai.models.generateContent({

                model:
                    "gemini-2.5-flash",

                contents:
                    prompt
            });

        res.json({
            success: true,
            reply:
                response.text ||
                "ঠিক আছে ❤️"
        });

    } catch (error) {

        console.error(
            "IMAGE ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            error: "Image request failed"
        });
    }
});


/* =========================================================
   LIVE WEBSOCKET
   ========================================================= */

const wss =
    new WebSocketServer({
        server,
        path: "/live"
    });


wss.on(
    "connection",
    (androidSocket, request) => {

        console.log(
            "================================"
        );

        console.log(
            "Android Live client connected"
        );

        console.log(
            "Live URL:",
            request?.url || "/live"
        );


        let session = null;
        let selectedPartner = "GF";
        let started = false;
        let closed = false;
        let setupSent = false;


        /* =====================================================
           PENDING AUDIO
           ===================================================== */

        const pendingAudio = [];

        const MAX_PENDING_AUDIO = 100;


        /* =====================================================
           SAFE ANDROID SEND
           ===================================================== */

        function sendToAndroid(data) {

            if (
                closed ||
                androidSocket.readyState !== 1
            ) {
                return false;
            }

            try {

                androidSocket.send(
                    JSON.stringify(data)
                );

                return true;

            } catch (error) {

                console.error(
                    "Android send error:",
                    error
                );

                return false;
            }
        }


        /* =====================================================
           SETUP COMPLETE
           ===================================================== */

        function sendSetupComplete() {

            if (
                setupSent ||
                closed
            ) {
                return;
            }

            setupSent = true;

            const partner =
                getPartner(
                    selectedPartner
                );

            sendToAndroid({

                type:
                    "setupComplete",

                setupComplete:
                    true,

                partner:
                    selectedPartner,

                voice:
                    partner.voice
            });
        }


        /* =====================================================
           FLUSH AUDIO
           ===================================================== */

        function flushPendingAudio() {

            if (!session) {
                return;
            }

            while (
                pendingAudio.length > 0
            ) {

                const chunk =
                    pendingAudio.shift();

                try {

                    session.sendRealtimeInput({

                        audio: {

                            data:
                                chunk.data,

                            mimeType:
                                chunk.mimeType ||
                                "audio/pcm;rate=16000"
                        }
                    });

                } catch (error) {

                    console.error(
                        "Buffered audio error:",
                        error
                    );

                    break;
                }
            }
        }


        /* =====================================================
           START GEMINI LIVE
           ===================================================== */

        async function startLiveSession() {

            if (
                started ||
                closed
            ) {
                return;
            }

            started = true;

            const partner =
                getPartner(
                    selectedPartner
                );

            console.log(
                "Starting Live:",
                selectedPartner
            );

            console.log(
                "Live model:",
                LIVE_MODEL
            );

            sendSetupComplete();


            try {

                session =
                    await ai.live.connect({

                        model:
                            LIVE_MODEL,

                        callbacks: {

                            onopen: () => {

                                console.log(
                                    "Gemini Live connected"
                                );

                                flushPendingAudio();
                            },


                            onmessage:
                                (message) => {

                                    if (closed) {
                                        return;
                                    }

                                    try {

                                        const content =
                                            message.serverContent;

                                        if (!content) {
                                            return;
                                        }


                                        /* =========================
                                           AI AUDIO
                                           ========================= */

                                        if (
                                            content.modelTurn &&
                                            Array.isArray(
                                                content.modelTurn.parts
                                            )
                                        ) {

                                            for (
                                                const part
                                                of content.modelTurn.parts
                                            ) {

                                                if (
                                                    part.inlineData &&
                                                    part.inlineData.data
                                                ) {

                                                    sendToAndroid({

                                                        type:
                                                            "audio",

                                                        mimeType:
                                                            part.inlineData.mimeType ||
                                                            "audio/pcm;rate=24000",

                                                        data:
                                                            part.inlineData.data
                                                    });
                                                }
                                            }
                                        }


                                        /* =========================
                                           USER TRANSCRIPTION
                                           ========================= */

                                        if (
                                            content.inputTranscription
                                        ) {

                                            sendToAndroid({

                                                type:
                                                    "inputTranscription",

                                                text:
                                                    content
                                                        .inputTranscription
                                                        .text ||
                                                    ""
                                            });
                                        }


                                        /* =========================
                                           AI TRANSCRIPTION
                                           ========================= */

                                        if (
                                            content.outputTranscription
                                        ) {

                                            sendToAndroid({

                                                type:
                                                    "outputTranscription",

                                                text:
                                                    content
                                                        .outputTranscription
                                                        .text ||
                                                    ""
                                            });
                                        }


                                        /* =========================
                                           TURN COMPLETE
                                           ========================= */

                                        if (
                                            content.turnComplete
                                        ) {

                                            sendToAndroid({

                                                type:
                                                    "turnComplete"
                                            });
                                        }

                                    } catch (error) {

                                        console.error(
                                            "Live forwarding error:",
                                            error
                                        );
                                    }
                                },


                            onerror:
                                (error) => {

                                    console.error(
                                        "Gemini Live error:",
                                        error
                                    );

                                    sendToAndroid({

                                        type:
                                            "liveError",

                                        error:
                                            error?.message ||
                                            "Live connection error"
                                    });
                                },


                            onclose:
                                (event) => {

                                    console.log(
                                        "Gemini Live closed:",
                                        event?.reason ||
                                        "closed"
                                    );

                                    if (!closed) {

                                        sendToAndroid({

                                            type:
                                                "liveClosed"
                                        });
                                    }
                                }
                        },


                        config: {

                            responseModalities: [
                                Modality.AUDIO
                            ],

                            speechConfig: {

                                voiceConfig: {

                                    prebuiltVoiceConfig: {

                                        voiceName:
                                            partner.voice
                                    }
                                }
                            },

                            inputAudioTranscription: {},

                            outputAudioTranscription: {},

                            systemInstruction:
                                partner.instruction
                        }
                    });


                console.log(
                    "Gemini Live session created"
                );

                flushPendingAudio();

            } catch (error) {

                console.error(
                    "Live session start error:",
                    error
                );

                started = false;

                sendToAndroid({

                    type:
                        "liveError",

                    error:
                        error?.message ||
                        "Unable to start live call"
                });
            }
        }


        /* =====================================================
           ANDROID -> SERVER
           ===================================================== */

        androidSocket.on(
            "message",
            async (raw) => {

                if (closed) {
                    return;
                }

                try {

                    const message =
                        JSON.parse(
                            raw.toString()
                        );


                    /* =========================================
                       PARTNER
                       ========================================= */

                    if (
                        message.partner
                    ) {

                        if (!started) {

                            selectedPartner =
                                normalizePartner(
                                    message.partner
                                );

                            await startLiveSession();
                        }

                        return;
                    }


                    /* =========================================
                       OLD SETUP
                       ========================================= */

                    if (
                        message.setup
                    ) {

                        if (!started) {

                            selectedPartner = "GF";

                            await startLiveSession();
                        }

                        return;
                    }


                    /* =========================================
                       AUDIO
                       ========================================= */

                    if (
                        message.realtimeInput &&
                        Array.isArray(
                            message.realtimeInput.mediaChunks
                        )
                    ) {

                        const chunks =
                            message
                                .realtimeInput
                                .mediaChunks;


                        for (
                            const chunk
                            of chunks
                        ) {

                            if (
                                !chunk ||
                                !chunk.data
                            ) {
                                continue;
                            }


                            if (session) {

                                try {

                                    session.sendRealtimeInput({

                                        audio: {

                                            data:
                                                chunk.data,

                                            mimeType:
                                                chunk.mimeType ||
                                                "audio/pcm;rate=16000"
                                        }
                                    });

                                } catch (error) {

                                    console.error(
                                        "Audio send error:",
                                        error
                                    );
                                }

                            } else {

                                if (
                                    pendingAudio.length <
                                    MAX_PENDING_AUDIO
                                ) {

                                    pendingAudio.push({

                                        data:
                                            chunk.data,

                                        mimeType:
                                            chunk.mimeType ||
                                            "audio/pcm;rate=16000"
                                    });
                                }
                            }
                        }

                        return;
                    }


                    /* =========================================
                       CAMERA VIDEO
                       ========================================= */

                    if (
                        message.realtimeInput &&
                        message.realtimeInput.video
                    ) {

                        const video =
                            message.realtimeInput.video;


                        if (
                            video &&
                            video.data &&
                            session
                        ) {

                            try {

                                session.sendRealtimeInput({

                                    video: {

                                        data:
                                            video.data,

                                        mimeType:
                                            video.mimeType ||
                                            "image/jpeg"
                                    }
                                });

                                console.log(
                                    "Camera frame -> Gemini"
                                );

                            } catch (error) {

                                console.error(
                                    "Video send error:",
                                    error
                                );
                            }
                        }

                        return;
                    }


                    /* =========================================
                       TEXT
                       ========================================= */

                    if (
                        typeof message.text === "string" &&
                        message.text.trim()
                    ) {

                        if (session) {

                            try {

                                session.sendRealtimeInput({

                                    text:
                                        message.text
                                });

                            } catch (error) {

                                console.error(
                                    "Text input error:",
                                    error
                                );
                            }
                        }

                        return;
                    }

                } catch (error) {

                    console.error(
                        "Android message parse error:",
                        error
                    );
                }
            }
        );


        /* =====================================================
           CLOSE
           ===================================================== */

        androidSocket.on(
            "close",
            () => {

                closed = true;

                console.log(
                    "Android Live client disconnected"
                );

                try {

                    if (session) {
                        session.close();
                    }

                } catch (error) {

                    console.error(
                        "Session close error:",
                        error
                    );
                }

                session = null;
                pendingAudio.length = 0;
            }
        );


        androidSocket.on(
            "error",
            (error) => {

                console.error(
                    "Android WebSocket error:",
                    error
                );
            }
        );
    }
);


/* =========================================================
   START
   ========================================================= */

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            `Live WebSocket endpoint: /live`
        );

        console.log(
            `Live model: ${LIVE_MODEL}`
        );
    }
);
