import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import { Badge, IconButton, TextField } from "@mui/material";
import { Button } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import CloseIcon from "@mui/icons-material/Close";
import server from "../environment";

const server_url = server;

var connections = {};

const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeetComponent() {
  const { url: meetingCode } = useParams();
  var socketRef = useRef();
  let socketIdRef = useRef();

  let localVideoref = useRef();

  let [videoAvailable, setVideoAvailable] = useState(true);
  let [audioAvailable, setAudioAvailable] = useState(true);
  let [video, setVideo] = useState([]);
  let [audio, setAudio] = useState();
  let [screen, setScreen] = useState();
  let [showModal, setModal] = useState(false);
  let [screenAvailable, setScreenAvailable] = useState();
  let [messages, setMessages] = useState([]);
  let [message, setMessage] = useState("");
  let [newMessages, setNewMessages] = useState(0);
  let [askForUsername, setAskForUsername] = useState(true);
  let [username, setUsername] = useState("");

  const videoRef = useRef([]);
  let [videos, setVideos] = useState([]);

  useEffect(() => {
    getPermissions();
  }, []);

  let getDislayMedia = () => {
    if (screen) {
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true })
          .then(getDislayMediaSuccess)
          .then((stream) => {})
          .catch((e) => console.log(e));
      }
    }
  };

  const getPermissions = async () => {
    try {
      const videoPermission = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      if (videoPermission) {
        setVideoAvailable(true);
      } else {
        setVideoAvailable(false);
      }

      const audioPermission = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (audioPermission) {
        setAudioAvailable(true);
      } else {
        setAudioAvailable(false);
      }

      if (navigator.mediaDevices.getDisplayMedia) {
        setScreenAvailable(true);
      } else {
        setScreenAvailable(false);
      }

      if (videoAvailable || audioAvailable) {
        const userMediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoAvailable,
          audio: audioAvailable,
        });
        if (userMediaStream) {
          window.localStream = userMediaStream;
          if (localVideoref.current) {
            localVideoref.current.srcObject = userMediaStream;
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    if (video !== undefined && audio !== undefined) {
      getUserMedia();
    }
  }, [video, audio]);

  let getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  let getUserMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    localVideoref.current.srcObject = stream;

    // Add self video to videos array if not already present
    setVideos((prevVideos) => {
      const selfId = 'self';
      const alreadyHasSelf = prevVideos.some(v => v.socketId === selfId);
      if (!alreadyHasSelf) {
        const selfVideo = {
          socketId: selfId,
          stream: stream,
          autoplay: true,
          playsinline: true,
          isSelf: true,
        };
        videoRef.current = [...prevVideos, selfVideo];
        return [...prevVideos, selfVideo];
      }
      return prevVideos;
    });

    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      connections[id].addStream(window.localStream);
      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription }),
            );
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          setVideo(false);
          setAudio(false);
          try {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          } catch (e) {
            console.log(e);
          }

          let blackSilence = (...args) =>
            new MediaStream([black(...args), silence()]);
          window.localStream = blackSilence();
          localVideoref.current.srcObject = window.localStream;

          for (let id in connections) {
            connections[id].addStream(window.localStream);
            connections[id].createOffer().then((description) => {
              connections[id]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit(
                    "signal",
                    id,
                    JSON.stringify({ sdp: connections[id].localDescription }),
                  );
                })
                .catch((e) => console.log(e));
            });
          }
        }),
    );
  };

  let getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: video, audio: audio })
        .then(getUserMediaSuccess)
        .then((stream) => {})
        .catch((e) => console.log(e));
    } else {
      try {
        let tracks = localVideoref.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      } catch (e) {}
    }
  };

  let getDislayMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      connections[id].addStream(window.localStream);
      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription }),
            );
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          setScreen(false);
          try {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          } catch (e) {
            console.log(e);
          }

          let blackSilence = (...args) =>
            new MediaStream([black(...args), silence()]);
          window.localStream = blackSilence();
          localVideoref.current.srcObject = window.localStream;
          getUserMedia();
        }),
    );
  };

  let gotMessageFromServer = (fromId, message) => {
    var signal = JSON.parse(message);
    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      socketRef.current.emit(
                        "signal",
                        fromId,
                        JSON.stringify({
                          sdp: connections[fromId].localDescription,
                        }),
                      );
                    })
                    .catch((e) => console.log(e));
                })
                .catch((e) => console.log(e));
            }
          })
          .catch((e) => console.log(e));
      }
      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.log(e));
      }
    }
  };

  let connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false });
    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join-call", meetingCode);
      socketIdRef.current = socketRef.current.id;
      socketRef.current.on("chat-message", addMessage);
      socketRef.current.on("user-left", (id) => {
        setVideos((videos) => videos.filter((video) => video.socketId !== id));
      });
      socketRef.current.on("user-joined", (id, clients) => {
        // If this event is for myself (I just joined), create connections to all others
        if (id === socketIdRef.current) {
          clients.forEach((socketListId) => {
            if (socketListId === socketIdRef.current) return; // skip self
            if (!connections[socketListId]) {
              connections[socketListId] = new RTCPeerConnection(peerConfigConnections);
              connections[socketListId].onicecandidate = function (event) {
                if (event.candidate != null) {
                  socketRef.current.emit(
                    "signal",
                    socketListId,
                    JSON.stringify({ ice: event.candidate }),
                  );
                }
              };
              connections[socketListId].onaddstream = (event) => {
                let videoExists = videoRef.current.find(
                  (video) => video.socketId === socketListId,
                );
                if (videoExists) {
                  setVideos((videos) => {
                    const updatedVideos = videos.map((video) =>
                      video.socketId === socketListId
                        ? { ...video, stream: event.stream }
                        : video,
                    );
                    videoRef.current = updatedVideos;
                    return updatedVideos;
                  });
                } else {
                  let newVideo = {
                    socketId: socketListId,
                    stream: event.stream,
                    autoplay: true,
                    playsinline: true,
                  };
                  setVideos((videos) => {
                    const updatedVideos = [...videos, newVideo];
                    videoRef.current = updatedVideos;
                    return updatedVideos;
                  });
                }
              };
              if (window.localStream !== undefined && window.localStream !== null) {
                connections[socketListId].addStream(window.localStream);
              } else {
                let blackSilence = (...args) =>
                  new MediaStream([black(...args), silence()]);
                window.localStream = blackSilence();
                connections[socketListId].addStream(window.localStream);
              }
              // Create offer to each existing user
              connections[socketListId].createOffer().then((description) => {
                connections[socketListId]
                  .setLocalDescription(description)
                  .then(() => {
                    socketRef.current.emit(
                      "signal",
                      socketListId,
                      JSON.stringify({ sdp: connections[socketListId].localDescription }),
                    );
                  })
                  .catch((e) => console.log(e));
              });
            }
          });
        } else if (id !== socketIdRef.current && connections[id]) {
          // If a new user joined (not self), create an offer from self to the new user
          try {
            connections[id].addStream(window.localStream);
          } catch (e) {}
          connections[id].createOffer().then((description) => {
            connections[id]
              .setLocalDescription(description)
              .then(() => {
                socketRef.current.emit(
                  "signal",
                  id,
                  JSON.stringify({ sdp: connections[id].localDescription }),
                );
              })
              .catch((e) => console.log(e));
          });
        }
      });
    });
  };

  let silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  let black = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement("canvas"), {
      width,
      height,
    });
    canvas.getContext("2d").fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  let handleVideo = () => {
    setVideo(!video);
  };
  let handleAudio = () => {
    setAudio(!audio);
  };

  useEffect(() => {
    if (screen !== undefined) {
      getDislayMedia();
    }
  }, [screen]);

  let handleScreen = () => {
    setScreen(!screen);
  };

  let handleEndCall = () => {
    try {
      let tracks = localVideoref.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
    } catch (e) {}
    window.location.href = "/home";
  };

  let handleMessage = (e) => {
    setMessage(e.target.value);
  };

  const addMessage = (data, sender, socketIdSender) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { sender: sender, data: data },
    ]);
    if (socketIdSender !== socketIdRef.current) {
      setNewMessages((prevNewMessages) => prevNewMessages + 1);
    }
  };

  let sendMessage = () => {
    socketRef.current.emit("chat-message", message, username);
    setMessage("");
  };

  let connect = () => {
    setAskForUsername(false);
    getMedia();
  };

  const getGridClass = (count) => {
    if (count === 1) return "grid-cols-1 grid-rows-1";
    if (count === 2) return "grid-cols-2 grid-rows-1";
    if (count <= 4) return "grid-cols-2 grid-rows-2";
    if (count <= 6) return "grid-cols-3 grid-rows-2";
    if (count <= 9) return "grid-cols-3 grid-rows-3";
    return "grid-cols-4 grid-rows-4";
  };

  return (
    <div>
      {askForUsername === true ? (
        /* ── Lobby screen ── */
        <div className={styles.lobbyContainer}>
          <div className={styles.lobbyCard}>
            <h2>Ready to join?</h2>
            <TextField
              id="username-input"
              label="Your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              variant="outlined"
              onKeyDown={(e) => e.key === "Enter" && connect()}
              fullWidth
            />
            <Button variant="contained" onClick={connect} fullWidth>
              Join Meeting
            </Button>
          </div>

          <div className={styles.lobbyPreview}>
            <video ref={localVideoref} autoPlay muted />
          </div>
        </div>
      ) : (
        /* ── Meeting room ── */
        <div className={styles.meetVideoContainer}>
          {/* Chat panel */}
          {showModal && (
            <div className={styles.chatRoom}>
              <div className={styles.chatContainer}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h1>In-call messages</h1>
                  <IconButton onClick={() => setModal(false)}>
                    <CloseIcon />
                  </IconButton>
                </div>

                <div className={styles.chattingDisplay}>
                  {messages.length !== 0 ? (
                    messages.map((item, index) => (
                      <div key={index}>
                        <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                        <p>{item.data}</p>
                      </div>
                    ))
                  ) : (
                    <p>No messages yet</p>
                  )}
                </div>

                <div className={styles.chattingArea}>
                  <TextField
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    label="Message everyone"
                    variant="outlined"
                    size="small"
                    fullWidth
                  />
                  <Button variant="contained" onClick={sendMessage}>
                    Send
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Meeting code badge */}
          <div className={styles.meetingCodeDisplay}>{meetingCode}</div>


          {/* Remote participants grid (excluding self) */}
          <div className={styles.conferenceView}
            style={{
              gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(videos.filter(v => !v.isSelf).length)) || 1}, 1fr)`,
              gridTemplateRows: `repeat(${Math.ceil(Math.sqrt(videos.filter(v => !v.isSelf).length)) || 1}, 1fr)`
            }}
          >
            {videos.filter(video => !video.isSelf).map((video) => (
              <div key={video.socketId}>
                <video
                  className="object-cover"
                  data-socket={video.socketId}
                  ref={ref => {
                    if (ref && video.stream) {
                      ref.srcObject = video.stream;
                    }
                  }}
                  autoPlay
                  playsInline
                  muted={false}
                />
              </div>
            ))}
          </div>

          {/* Local video always as PiP (bottom left) */}
          <video
            className={styles.meetUserVideo}
            ref={localVideoref}
            autoPlay
            muted
            playsInline
          />

          {/* Control bar */}
          <div className={styles.buttonContainers}>
            <IconButton
              onClick={handleVideo}
              style={{ color: "white" }}
              title={video ? "Turn off camera" : "Turn on camera"}
            >
              {video === true ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>

            <IconButton
              onClick={handleAudio}
              style={{ color: "white" }}
              title={audio ? "Mute" : "Unmute"}
            >
              {audio === true ? <MicIcon /> : <MicOffIcon />}
            </IconButton>

            {screenAvailable === true && (
              <IconButton
                onClick={handleScreen}
                style={{ color: "white" }}
                title={screen ? "Stop sharing" : "Share screen"}
              >
                {screen === true ? (
                  <ScreenShareIcon />
                ) : (
                  <StopScreenShareIcon />
                )}
              </IconButton>
            )}

            <Badge badgeContent={newMessages} max={999} color="error">
              <IconButton
                onClick={() => {
                  setModal(!showModal);
                  setNewMessages(0);
                }}
                style={{ color: "white" }}
                title="Chat"
              >
                <ChatIcon />
              </IconButton>
            </Badge>

            <IconButton
              onClick={handleEndCall}
              style={{ color: "red" }}
              title="Leave call"
            >
              <CallEndIcon />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  );
}
