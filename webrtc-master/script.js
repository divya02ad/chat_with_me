// Generate random room name if not already present in the URL hash
if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
const roomHash = location.hash.substring(1);

// Replace with your ScaleDrone Channel ID
const drone = new ScaleDrone('Gf1su6Wubci4csMs'); // Replace 'Gf1su6Wubci4csMs' with your actual ScaleDrone channel ID.
const roomName = 'observable-' + roomHash;

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

let room;
let pc;

// Connect to ScaleDrone
drone.on('open', error => {
  if (error) return console.error(error);

  room = drone.subscribe(roomName);

  room.on('open', error => {
    if (error) return console.error(error);
  });

  room.on('members', members => {
    console.log('MEMBERS', members);
    const isOfferer = members.length === 2;
    startWebRTC(isOfferer);
  });
});

// Send a message via ScaleDrone
function sendMessage(message) {
  drone.publish({ room: roomName, message });
}

function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  // Handle ICE candidates
  pc.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({ candidate: event.candidate });
    }
  };

  // Display remote video stream
  pc.ontrack = event => {
    const stream = event.streams[0];
    if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
      remoteVideo.srcObject = stream;
    }
  };

  // Get local media stream
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localVideo.srcObject = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    })
    .catch(console.error);

  // Handle negotiation for the offerer
  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer().then(localDescCreated).catch(console.error);
    };
  }

  // Handle signaling messages
  room.on('data', (message, client) => {
    if (client.id === drone.clientId) return;

    if (message.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
        if (pc.remoteDescription.type === 'offer') {
          pc.createAnswer().then(localDescCreated).catch(console.error);
        }
      }, console.error);
    } else if (message.candidate) {
      pc.addIceCandidate(new RTCIceCandidate(message.candidate), console.log, console.error);
    } else if (message.chat) {
      displayChatMessage(message.chat, client.id);
    }
  });
}

function localDescCreated(desc) {
  pc.setLocalDescription(desc, () => sendMessage({ sdp: pc.localDescription }), console.error);
}

// Chat functionality
function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (message) {
    sendMessage({ chat: message });
    displayChatMessage(message, 'You');
    input.value = '';
  }
}

function displayChatMessage(message, sender) {
  const chatMessages = document.getElementById('chatMessages');
  const messageElement = document.createElement('div');
  messageElement.textContent = `${sender}: ${message}`;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
