const express = require("express");
const http = require("http");
const cors = require("cors");
const { WebSocketServer } = require("ws");
const { GoogleGenAI, Modality } = require("@google/genai");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: "25mb" }));

const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const CHAT_MODEL = "gemini-3.6-flash";
const IMAGE_MODEL = "gemini-3.1-flash-image";
const LIVE_MODEL = "gemini-3.1-flash-live-preview";

let ai = null;

if (GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY
  });
}

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

    const message =
      String(req.body?.message || "").trim();

    const partner =
      String(req.body?.partner || "AI Partner");

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

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      CHAT_MODEL +
      ":generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify({

          systemInstruction: {
            parts: [
              {
                text:
                  `You are ${partner}, a warm friendly AI partner. ` +
                  `Reply naturally and concisely. ` +
                  `The user may speak Bangla or English. ` +
                  `Reply in the same language the user uses.`
              }
            ]
          },

          contents: [
            {
              role: "user",
              parts: [
                {
                  text: message
                }
              ]
            }
          ]

        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Chat error:", data);

      return res.status(500).json({
        success: false,
        error:
          data?.error?.message ||
          "Gemini chat error"
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.find(p => p?.text)
        ?.text || "";

    if (!reply) {
      return res.status(500).json({
        success: false,
        error: "Empty Gemini response"
      });
    }

    res.json({
      success: true,
      reply: reply
    });

  } catch (error) {

    console.error("Chat server error:", error);

    res.status(500).json({
      success: false,
      error: error?.message || "Chat failed"
    });
  }
});


// =====================================================
// IMAGE
// =====================================================

app.post("/image", async (req, res) => {
  try {

    const prompt =
      String(req.body?.prompt || "").trim();

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

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/" +
      IMAGE_MODEL +
      ":generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify({

          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],

          generationConfig: {
            responseModalities: ["IMAGE"]
          }

        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error:
          data?.error?.message ||
          "Image generation failed"
      });
    }

    let image = "";
    let mimeType = "image/png";

    for (const candidate of data?.candidates || []) {

      for (const part of candidate?.content?.parts || []) {

        if (part?.inlineData?.data) {

          image = part.inlineData.data;

          mimeType =
            part.inlineData.mimeType ||
            "image/png";

          break;
        }
      }

      if (image) break;
    }

    if (!image) {
      return res.status(500).json({
        success: false,
        error: "No image returned"
      });
    }

    res.json({
      success: true,
      image: image,
      mimeType: mimeType
    });

  } catch (error) {

    console.error("Image error:", error);

    res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Image generation failed"
    });
  }
});


// =====================================================
// LIVE WEBSOCKET
// =====================================================

const liveWss =
  new WebSocketServer({
    noServer: true
  });


server.on("upgrade", (request, socket, head) => {

  try {

    const url =
      new URL(
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
      ws => {

        liveWss.emit(
          "connection",
          ws,
          request
        );
      }
    );

  } catch (error) {

    console.error(
      "Upgrade error:",
      error
    );

    socket.destroy();
  }
});


// =====================================================
// LIVE CONNECTION
// =====================================================

liveWss.on("connection", async clientSocket => {

  console.log(
    "Android Live client connected"
  );

  if (!ai) {

    clientSocket.close(
      1011,
      "GEMINI_API_KEY missing"
    );

    return;
  }

  let session = null;
  let closed = false;

  try {

    session =
      await ai.live.connect({

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
                  "Have a natural real-time voice conversation. " +
                  "Understand Bangla and English. " +
                  "Reply in the same language the user speaks. " +
                  "Keep spoken replies natural and reasonably short."
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
                  setupComplete: {}
                })
              );
            }
          },


          onmessage: message => {

            if (
              closed ||
              clientSocket.readyState !== 1
            ) {
              return;
            }

            try {

              const serverContent =
                message?.serverContent;

              if (!serverContent) {
                return;
              }


              // -----------------------------
              // MODEL AUDIO / TEXT
              // -----------------------------

              if (
                serverContent.modelTurn
              ) {

                const parts =
                  serverContent
                    .modelTurn
                    .parts || [];

                const outputParts = [];

                for (const part of parts) {

                  if (
                    part?.inlineData?.data
                  ) {

                    outputParts.push({
                      inlineData: {
                        data:
                          part.inlineData.data,

                        mimeType:
                          part.inlineData.mimeType ||
                          "audio/pcm;rate=24000"
                      }
                    });
                  }

                  if (
                    typeof part?.text ===
                    "string" &&
                    part.text.length > 0
                  ) {

                    outputParts.push({
                      text: part.text
                    });
                  }
                }

                if (outputParts.length > 0) {

                  clientSocket.send(
                    JSON.stringify({
                      serverContent: {
                        modelTurn: {
                          parts: outputParts
                        }
                      }
                    })
                  );
                }
              }


              // -----------------------------
              // TURN COMPLETE
              // -----------------------------

              if (
                serverContent.turnComplete
              ) {

                clientSocket.send(
                  JSON.stringify({
                    serverContent: {
                      turnComplete: true
                    }
                  })
                );
              }


              // -----------------------------
              // INPUT TRANSCRIPTION
              // -----------------------------

              if (
                serverContent.inputTranscription
              ) {

                clientSocket.send(
                  JSON.stringify({
                    serverContent: {
                      inputTranscription:
                        serverContent.inputTranscription
                    }
                  })
                );
              }


              // -----------------------------
              // OUTPUT TRANSCRIPTION
              // -----------------------------

              if (
                serverContent.outputTranscription
              ) {

                clientSocket.send(
                  JSON.stringify({
                    serverContent: {
                      outputTranscription:
                        serverContent.outputTranscription
                    }
                  })
                );
              }

            } catch (error) {

              console.error(
                "Live message error:",
                error
              );
            }
          },


          onerror: error => {

            console.error(
              "Gemini Live error:",
              error
            );

            if (
              clientSocket.readyState === 1
            ) {

              clientSocket.send(
                JSON.stringify({
                  liveError:
                    error?.message ||
                    "Gemini Live error"
                })
              );
            }
          },


          onclose: event => {

            console.log(
              "Gemini Live closed:",
              event?.reason ||
              "closed"
            );

            if (
              !closed &&
              clientSocket.readyState === 1
            ) {

              clientSocket.send(
                JSON.stringify({
                  liveClosed: true,
                  reason:
                    event?.reason ||
                    "closed"
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
          liveError:
            error?.message ||
            "Gemini Live connection failed"
        })
      );
    }

    return;
  }


  // =====================================================
  // ANDROID → GEMINI
  // =====================================================

  clientSocket.on(
    "message",
    async rawMessage => {

      if (!session || closed) {
        return;
      }

      try {

        const message =
          JSON.parse(
            rawMessage.toString()
          );


        // Android sends setup.
        // SDK connection is already configured.
        if (message?.setup) {
          return;
        }


        // Android realtime audio
        const realtime =
          message?.realtimeInput;

        if (
          realtime?.mediaChunks
        ) {

          for (
            const chunk
            of realtime.mediaChunks
          ) {

            if (
              chunk?.data
            ) {

              session.sendRealtimeInput({

                audio: {
                  data:
                    chunk.data,

                  mimeType:
                    chunk.mimeType ||
                    "audio/pcm;rate=16000"
                }

              });
            }
          }

          return;
        }


        // Text input if later needed
        if (
          typeof message?.text ===
          "string"
        ) {

          session.sendRealtimeInput({
            text: message.text
          });

          return;
        }


        // Ping
        if (
          message?.type === "ping"
        ) {

          if (
            clientSocket.readyState === 1
          ) {

            clientSocket.send(
              JSON.stringify({
                type: "pong"
              })
            );
          }
        }

      } catch (error) {

        console.error(
          "Android Live message error:",
          error
        );
      }
    }
  );


  // =====================================================
  // ANDROID DISCONNECTED
  // =====================================================

  clientSocket.on(
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

      } catch (_) {}
    }
  );

});


// =====================================================
// START
// =====================================================

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Server running on port ${PORT}`
    );

  }
);
