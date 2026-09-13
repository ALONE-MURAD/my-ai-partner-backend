
// =====================================================
// LIVE WEBSOCKET PROXY
// =====================================================

const server =
  http.createServer(app);

const liveWss =
  new WebSocketServer({
    noServer: true
  });


// =====================================================
// WEBSOCKET UPGRADE
// =====================================================

server.on(
  "upgrade",
  (request, socket, head) => {

    try {

      const url =
        new URL(
          request.url,
          `http://${request.headers.host}`
        );

      if (
        url.pathname !== "/live"
      ) {

        socket.destroy();

        return;
      }

      liveWss.handleUpgrade(
        request,
        socket,
        head,
        (ws) => {

          liveWss.emit(
            "connection",
            ws,
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
  }
);


// =====================================================
// LIVE CONNECTION
// =====================================================

liveWss.on(
  "connection",
  (clientSocket) => {

    console.log(
      "Android Live client connected"
    );

    if (!GEMINI_API_KEY) {

      clientSocket.close(
        1011,
        "GEMINI_API_KEY missing"
      );

      return;
    }


    const geminiUrl =
      "wss://generativelanguage.googleapis.com/ws/" +
      "google.ai.generativelanguage.v1beta." +
      "GenerativeService.BidiGenerateContent" +
      "?key=" +
      encodeURIComponent(
        GEMINI_API_KEY
      );


    const geminiSocket =
      new WebSocket(
        geminiUrl
      );


    let geminiReady = false;

    const pendingMessages = [];


    // =================================================
    // GEMINI CONNECTED
    // =================================================

    geminiSocket.on(
      "open",
      () => {

        console.log(
          "Gemini Live connected"
        );


        const setup = {

          setup: {

            model:
              `models/${LIVE_MODEL}`,

            responseModalities: [
              "AUDIO"
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

          }

        };


        geminiSocket.send(
          JSON.stringify(setup)
        );

      }
    );


    // =================================================
    // GEMINI → ANDROID
    // =================================================

    geminiSocket.on(
      "message",
      (message) => {

        try {

          const text =
            message.toString("utf8");


          let parsed = null;

          try {

            parsed =
              JSON.parse(text);

          } catch (ignore) {
          }


          if (
            parsed?.setupComplete
          ) {

            geminiReady = true;

            console.log(
              "Gemini Live setup complete"
            );


            while (
              pendingMessages.length > 0 &&
              geminiSocket.readyState ===
                WebSocket.OPEN
            ) {

              const queued =
                pendingMessages.shift();

              geminiSocket.send(
                queued
              );

            }

          }


          if (
            clientSocket.readyState ===
            WebSocket.OPEN
          ) {

            clientSocket.send(
              text
            );

          }

        } catch (error) {

          console.error(
            "Gemini message error:",
            error
          );

        }

      }
    );


    // =================================================
    // ANDROID → GEMINI
    // =================================================

    clientSocket.on(
      "message",
      (message) => {

        try {

          const text =
            message.toString("utf8");


          if (
            geminiSocket.readyState ===
              WebSocket.OPEN &&
            geminiReady
          ) {

            geminiSocket.send(
              text
            );

          } else {

            pendingMessages.push(
              text
            );

          }

        } catch (error) {

          console.error(
            "Android message error:",
            error
          );

        }

      }
    );


    // =================================================
    // GEMINI ERROR
    // =================================================

    geminiSocket.on(
      "error",
      (error) => {

        console.error(
          "Gemini Live error:",
          error.message
        );


        if (
          clientSocket.readyState ===
          WebSocket.OPEN
        ) {

          clientSocket.send(
            JSON.stringify({
              liveError:
                error.message
            })
          );

        }

      }
    );


    // =================================================
    // GEMINI CLOSED
    // =================================================

    geminiSocket.on(
      "close",
      (code, reason) => {

        console.log(
          "Gemini Live closed:",
          code,
          reason?.toString() || ""
        );


        geminiReady = false;

        pendingMessages.length = 0;


        if (
          clientSocket.readyState ===
          WebSocket.OPEN
        ) {

          clientSocket.close(
            1000,
            "Gemini Live closed"
          );

        }

      }
    );


    // =================================================
    // ANDROID CLOSED
    // =================================================

    clientSocket.on(
      "close",
      () => {

        console.log(
          "Android Live client disconnected"
        );


        geminiReady = false;

        pendingMessages.length = 0;


        if (
          geminiSocket.readyState ===
          WebSocket.OPEN
        ) {

          geminiSocket.close();

        }

      }
    );


    // =================================================
    // ANDROID ERROR
    // =================================================

    clientSocket.on(
      "error",
      () => {

        if (
          geminiSocket.readyState ===
          WebSocket.OPEN
        ) {

          geminiSocket.close();

        }

      }
    );

  }
);

// =====================================================
// LIVE WEBSOCKET PROXY
// =====================================================

const server =
  http.createServer(app);

const liveWss =
  new WebSocketServer({
    noServer: true
  });


// =====================================================
// WEBSOCKET UPGRADE
// =====================================================

server.on(
  "upgrade",
  (request, socket, head) => {

    try {

      const url =
        new URL(
          request.url,
          `http://${request.headers.host}`
        );

      if (
        url.pathname !== "/live"
      ) {

        socket.destroy();

        return;
      }

      liveWss.handleUpgrade(
        request,
        socket,
        head,
        (ws) => {

          liveWss.emit(
            "connection",
            ws,
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
  }
);


// =====================================================
// LIVE CONNECTION
// =====================================================

liveWss.on(
  "connection",
  (clientSocket) => {

    console.log(
      "Android Live client connected"
    );

    if (!GEMINI_API_KEY) {

      clientSocket.close(
        1011,
        "GEMINI_API_KEY missing"
      );

      return;
    }


    const geminiUrl =
      "wss://generativelanguage.googleapis.com/ws/" +
      "google.ai.generativelanguage.v1beta." +
      "GenerativeService.BidiGenerateContent" +
      "?key=" +
      encodeURIComponent(
        GEMINI_API_KEY
      );


    const geminiSocket =
      new WebSocket(
        geminiUrl
      );


    let geminiReady = false;

    const pendingMessages = [];


    // =================================================
    // GEMINI CONNECTED
    // =================================================

    geminiSocket.on(
      "open",
      () => {

        console.log(
          "Gemini Live connected"
        );


        const setup = {

          setup: {

            model:
              `models/${LIVE_MODEL}`,

            responseModalities: [
              "AUDIO"
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

          }

        };


        geminiSocket.send(
          JSON.stringify(setup)
        );

      }
    );


    // =================================================
    // GEMINI → ANDROID
    // =================================================

    geminiSocket.on(
      "message",
      (message) => {

        try {

          const text =
            message.toString("utf8");


          let parsed = null;

          try {

            parsed =
              JSON.parse(text);

          } catch (ignore) {
          }


          if (
            parsed?.setupComplete
          ) {

            geminiReady = true;

            console.log(
              "Gemini Live setup complete"
            );


            while (
              pendingMessages.length > 0 &&
              geminiSocket.readyState ===
                WebSocket.OPEN
            ) {

              const queued =
                pendingMessages.shift();

              geminiSocket.send(
                queued
              );

            }

          }


          if (
            clientSocket.readyState ===
            WebSocket.OPEN
          ) {

            clientSocket.send(
              text
            );

          }

        } catch (error) {

          console.error(
            "Gemini message error:",
            error
          );

        }

      }
    );


    // =================================================
    // ANDROID → GEMINI
    // =================================================

    clientSocket.on(
      "message",
      (message) => {

        try {

          const text =
            message.toString("utf8");


          if (
            geminiSocket.readyState ===
              WebSocket.OPEN &&
            geminiReady
          ) {

            geminiSocket.send(
              text
            );

          } else {

            pendingMessages.push(
              text
            );

          }

        } catch (error) {

          console.error(
            "Android message error:",
            error
          );

        }

      }
    );


    // =================================================
    // GEMINI ERROR
    // =================================================

    geminiSocket.on(
      "error",
      (error) => {

        console.error(
          "Gemini Live error:",
          error.message
        );


        if (
          clientSocket.readyState ===
          WebSocket.OPEN
        ) {

          clientSocket.send(
            JSON.stringify({
              liveError:
                error.message
            })
          );

        }

      }
    );


    // =================================================
    // GEMINI CLOSED
    // =================================================

    geminiSocket.on(
      "close",
      (code, reason) => {

        console.log(
          "Gemini Live closed:",
          code,
          reason?.toString() || ""
        );


        geminiReady = false;

        pendingMessages.length = 0;


        if (
          clientSocket.readyState ===
          WebSocket.OPEN
        ) {

          clientSocket.close(
            1000,
            "Gemini Live closed"
          );

        }

      }
    );


    // =================================================
    // ANDROID CLOSED
    // =================================================

    clientSocket.on(
      "close",
      () => {

        console.log(
          "Android Live client disconnected"
        );


        geminiReady = false;

        pendingMessages.length = 0;


        if (
          geminiSocket.readyState ===
          WebSocket.OPEN
        ) {

          geminiSocket.close();

        }

      }
    );


    // =================================================
    // ANDROID ERROR
    // =================================================

    clientSocket.on(
      "error",
      () => {

        if (
          geminiSocket.readyState ===
          WebSocket.OPEN
        ) {

          geminiSocket.close();

        }

      }
    );

  }
);
