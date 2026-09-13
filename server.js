const express = require("express");
const http = require("http");
const cors = require("cors");
const { WebSocketServer } = require("ws");
const { GoogleGenAI, Modality } = require("@google/genai");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: "25mb" }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing");
}

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY
});

const CHAT_MODEL = "gemini-3.8-flash";
const IMAGE_MODEL = "gemini-3.1-flash-image";
const LIVE_MODEL = "gemini-3.1-flash-live-preview";


// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "My AI Partner Backend is running ❤️"
  });
});


// =====================================================
// CHAT
// =====================================================

app.post("/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    const partner = String(req.body?.partner || "AI Partner");

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required"
      });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is missing"
      });
    }

    const prompt =
      `You are a warm, friendly AI ${partner}. ` +
      `Speak naturally and conversationally. ` +
      `The user may speak Bangla or English. ` +
      `Reply in the same language the user uses. ` +
      `Keep responses natural, helpful and reasonably concise.\n\n` +
      `User: ${message}`;

    const response = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: prompt
    });

    const reply =
      response?.text ||
      "Sorry babu ❤️ একটু পরে আবার বলো।";

    res.json({
      success: true,
      reply: reply
    });

  } catch (error) {
    console.error("Chat error:", error);

    res.status(500).json({
      success: false,
      error: error?.message || "Chat failed"
    });
  }
});


// =====================================================
// IMAGE GENERATION
// =====================================================

app.post("/image", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: "Prompt is required"
      });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is missing"
      });
    }

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: prompt,
      config: {
        responseModalities: ["IMAGE"]
      }
    });

    const parts =
      response?.candidates?.[0]?.content?.parts || [];

    let imageData = null;
    let mimeType = "image/png";

    for (const part of parts) {
      if (part?.inlineData?.data) {
        imageData = part.inlineData.data;
        mimeType =
          part.inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!imageData) {
      return res.status(500).json({
        success: false,
        error: "Gemini did not return an image"
      });
    }

    res.json({
      success: true,
      image: imageData,
      mimeType: mimeType
    });

  } catch (error) {
    console.error("Image error:", error);

    res.status(500).json({
      success: false,
      error: error?.message || "Image generation failed"
    });
  }
});


// =====================================================
// LIVE WEBSOCKET
// =====================================================

const liveWss = new WebSocketServer({
  noServer: true
});

server.on("upgrade", (request, socket, head) => {

  try {

    const url = new URL(
      request.url,
      `http://${request.headers.host}`
    );

    if (url.pathname !== "/live") {
      socket.destroy();
      return;
    }

    liveWss.handleUpgrade(
      request,
      socket,
      head,
      (clientSocket) => {

        liveWss.emit(
          "connection",
          clientSocket,
          request
        );

      }
    );

  } catch (error) {

    console.error(
      "WebSocket upgrade error:",
      error
    );

    socket.destroy();
  }
});


// =====================================================
// LIVE CONNECTION
// =====================================================

liveWss.on("connection", async (clientSocket) => {

  console.log(
    "Android Live client connected"
  );

  if (!GEMINI_API_KEY) {

    clientSocket.send(
      JSON.stringify({
        error: "GEMINI_API_KEY is missing"
      })
    );

    clientSocket.close();
    return;
  }

  let session = null;
  let closed = false;

  try {

    session = await ai.live.connect({

      model: LIVE_MODEL,

      config: {

        responseModalities: [
          Modality.AUDIO
        ],

        systemInstruction: {
          parts: [
            {
              text:
                "You are a warm, friendly AI girlfriend. " +
                "Speak naturally and conversationally. " +
                "The user may speak Bangla or English. " +
                "Reply in the same language the user uses. " +
                "Keep responses natural and reasonably concise."
            }
          ]
        }

      },

      callbacks: {

        onopen: () => {

          console.log(
            "Gemini Live connected"
          );

          if (
            clientSocket.readyState === 1
          ) {

            clientSocket.send(
              JSON.stringify({
                type: "live_ready",
                success: true
              })
            );

          }

        },

        onmessage: (message) => {

          if (
            !message ||
            clientSocket.readyState !== 1
          ) {
            return;
          }

          try {

            const content =
              message?.serverContent;

            if (
              content?.modelTurn?.parts
            ) {

              for (
                const part
                of content.modelTurn.parts
              ) {

                if (
                  part?.inlineData?.data
                ) {

                  clientSocket.send(
                    JSON.stringify({
                      type: "audio",
                      data:
                        part.inlineData.data,
                      mimeType:
                        part.inlineData.mimeType ||
                        "audio/pcm;rate=24000"
                    })
                  );

                }

              }

            }

            if (
              content?.inputTranscription?.text
            ) {

              clientSocket.send(
                JSON.stringify({
                  type: "input_transcript",
                  text:
                    content.inputTranscription.text
                })
              );

            }

            if (
              content?.outputTranscription?.text
            ) {

              clientSocket.send(
                JSON.stringify({
                  type: "output_transcript",
                  text:
                    content.outputTranscription.text
                })
              );

            }

            if (
              content?.turnComplete
            ) {

              clientSocket.send(
                JSON.stringify({
                  type: "turn_complete"
                })
              );

            }

          } catch (error) {

            console.error(
              "Live message processing error:",
              error
            );

          }

        },

        onerror: (error) => {

          console.error(
            "Gemini Live error:",
            error
          );

          if (
            clientSocket.readyState === 1
          ) {

            clientSocket.send(
              JSON.stringify({
                type: "live_error",
                error:
                  error?.message ||
                  "Gemini Live error"
              })
            );

          }

        },

        onclose: (event) => {

          console.log(
            "Gemini Live closed:",
            event?.reason || "closed"
          );

          if (
            clientSocket.readyState === 1
          ) {

            clientSocket.send(
              JSON.stringify({
                type: "live_closed",
                reason:
                  event?.reason || "closed"
              })
            );

          }

        }

      }

    });

  } catch (error) {

    console.error(
      "Gemini Live connection error:",
      error
    );

    if (
      clientSocket.readyState === 1
    ) {

      clientSocket.send(
        JSON.stringify({
          type: "live_error",
          error:
            error?.message ||
            "Unable to connect to Gemini Live"
        })
      );

      clientSocket.close();

    }

    return;
  }


  // ===================================================
  // ANDROID -> GEMINI
  // ===================================================

  clientSocket.on("message", async (rawMessage) => {

    if (!session) {
      return;
    }

    try {

      let message;

      if (Buffer.isBuffer(rawMessage)) {

        message =
          JSON.parse(
            rawMessage.toString("utf8")
          );

      } else {

        message =
          JSON.parse(
            String(rawMessage)
          );

      }


      // -----------------------------------------------
      // TEXT
      // -----------------------------------------------

      if (typeof message.text === "string") {

        session.sendRealtimeInput({
          text: message.text
        });

        return;
      }


      // -----------------------------------------------
      // AUDIO
      // -----------------------------------------------

      if (message.audio) {

        let audioData =
          message.audio.data ||
          message.audio;

        let mimeType =
          message.audio.mimeType ||
          "audio/pcm;rate=16000";

        if (
          typeof audioData !== "string"
        ) {

          audioData =
            Buffer.from(
              audioData
            ).toString("base64");

        }

        session.sendRealtimeInput({

          audio: {
            data: audioData,
            mimeType: mimeType
          }

        });

        return;
      }


      // -----------------------------------------------
      // VIDEO
      // -----------------------------------------------

      if (message.video) {

        let videoData =
          message.video.data ||
          message.video;

        let mimeType =
          message.video.mimeType ||
          "image/jpeg";

        if (
          typeof videoData !== "string"
        ) {

          videoData =
            Buffer.from(
              videoData
            ).toString("base64");

        }

        session.sendRealtimeInput({

          video: {
            data: videoData,
            mimeType: mimeType
          }

        });

        return;
      }


      // -----------------------------------------------
      // AUDIO STREAM END
      // -----------------------------------------------

      if (
        message.audioStreamEnd
      ) {

        session.sendRealtimeInput({
          audioStreamEnd: true
        });

        return;
      }


      // -----------------------------------------------
      // ACTIVITY START
      // -----------------------------------------------

      if (
        message.activityStart
      ) {

        session.sendRealtimeInput({
          activityStart: {}
        });

        return;
      }


      // -----------------------------------------------
      // ACTIVITY END
      // -----------------------------------------------

      if (
        message.activityEnd
      ) {

        session.sendRealtimeInput({
          activityEnd: {}
        });

        return;
      }


      // -----------------------------------------------
      // PING
      // -----------------------------------------------

      if (message.type === "ping") {

        if (
          clientSocket.readyState === 1
        ) {

          clientSocket.send(
            JSON.stringify({
              type: "pong"
            })
          );

        }

        return;
      }


    } catch (error) {

      console.error(
        "Android Live message error:",
        error
      );

      if (
        clientSocket.readyState === 1
      ) {

        clientSocket.send(
          JSON.stringify({
            type: "live_error",
            error:
              error?.message ||
              "Invalid Live message"
          })
        );

      }

    }

  });


  // ===================================================
  // ANDROID DISCONNECTED
  // ===================================================

  clientSocket.on("close", async () => {

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
        "Live session close error:",
        error
      );

    }

  });

});


// =====================================================
// START SERVER
// =====================================================

const PORT =
  process.env.PORT || 10000;

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Server running on port ${PORT}`
    );

  }
);
