// DOM Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const transcriptEl = document.getElementById('transcript');
const userSpeakingDot = document.querySelector('#userSpeaking .dot');
const aiSpeakingDot = document.querySelector('#aiSpeaking .dot');

// Global state
let peerConnection = null;
let dataChannel = null;
let audioElement = null;
let userMediaStream = null;

// Update status with timestamp
function updateStatus(message) {
  const time = new Date().toLocaleTimeString();
  statusEl.textContent = `[${time}] ${message}`;
  console.log(`[${time}] ${message}`);
}

// Add message to transcript
function addToTranscript(speaker, message) {
  const messageEl = document.createElement('div');
  messageEl.classList.add(speaker === 'user' ? 'transcript-user' : 'transcript-ai');
  messageEl.textContent = `${speaker === 'user' ? 'You' : 'AI'}: ${message}`;
  transcriptEl.appendChild(messageEl);
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

// here we initialize the WebRTC connection
async function initializeSession() {
  try {
    updateStatus('Initializing session...');
    
    //right heree we get ephemeral token from server
    const response = await fetch('/session');
    if (!response.ok) {
      throw new Error('Failed to get session token');
    }
    
    const data = await response.json();
    const ephemeralToken = data.client_secret.value;
    
    if (!ephemeralToken) {
      throw new Error('Invalid token received');
    }
    
    updateStatus('Got ephemeral token, setting up WebRTC...');
    
    // Create peer connection
    peerConnection = new RTCPeerConnection();
    
    // Set up audio playback
    audioElement = document.createElement('audio');
    audioElement.autoplay = true;
    document.body.appendChild(audioElement);
    
    // Handle remote audio stream
    peerConnection.ontrack = (event) => {
      updateStatus('Received audio track from OpenAI');
      audioElement.srcObject = event.streams[0];
    };
    
    // Get user microphone
    try {
      userMediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      
      updateStatus('Microphone access granted');
      
      // Add local audio track
      userMediaStream.getAudioTracks().forEach(track => {
        peerConnection.addTrack(track, userMediaStream);
      });
    } catch (mediaError) {
      updateStatus(`Microphone access error: ${mediaError.message}`);
      throw mediaError;
    }
    
    // Create data channel for events
    dataChannel = peerConnection.createDataChannel('oai-events');
    dataChannel.onopen = () => updateStatus('Data channel opened');
    dataChannel.onclose = () => updateStatus('Data channel closed');
    
    // Handle incoming events from OpenAI
    dataChannel.onmessage = handleServerEvent;
    
    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    // Send SDP to OpenAI
    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";
    
    updateStatus('Connecting to OpenAI...');
    
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${ephemeralToken}`,
        "Content-Type": "application/sdp"
      },
    });
    
    if (!sdpResponse.ok) {
      throw new Error(`Failed to connect: ${sdpResponse.status}`);
    }
    
    // Set remote description
    const sdpAnswer = await sdpResponse.text();
    const answer = {
      type: "answer",
      sdp: sdpAnswer,
    };
    
    await peerConnection.setRemoteDescription(answer);
    
    updateStatus('Connected! You can speak now.');
    startBtn.disabled = true;
    stopBtn.disabled = false;
    
  } catch (error) {
    updateStatus(`Error: ${error.message}`);
    closeSession();
  }
}

// Handle events from the server
function handleServerEvent(event) {
  try {
    const data = JSON.parse(event.data);
    console.log('Server event:', data);
    
    switch (data.type) {
      case 'input_audio_buffer.speech_started':
        userSpeakingDot.classList.add('active');
        updateStatus('You are speaking...');
        break;
        
      case 'input_audio_buffer.speech_stopped':
        userSpeakingDot.classList.remove('active');
        updateStatus('You stopped speaking');
        break;
        
      case 'response.created':
        updateStatus('AI is generating a response...');
        break;
        
      case 'response.audio.started':
        aiSpeakingDot.classList.add('active');
        updateStatus('AI is speaking...');
        break;
        
      case 'response.audio.done':
        aiSpeakingDot.classList.remove('active');
        updateStatus('AI finished speaking');
        break;
        
      case 'response.audio_transcript.delta':
        // Add AI response to transcript if we have text
        if (data.delta?.transcript) {
          addToTranscript('ai', data.delta.transcript);
        }
        break;
        
      case 'input_audio_buffer.transcript.delta':
        // Add user transcript if we have text
        if (data.delta?.transcript) {
          addToTranscript('user', data.delta.transcript);
        }
        break;
        
      case 'error':
        updateStatus(`Error: ${data.message}`);
        break;
    }
  } catch (error) {
    console.error('Error parsing server event:', error);
  }
}

// Close the session
function closeSession() {
  updateStatus('Closing session...');
  
  // Stop media tracks
  if (userMediaStream) {
    userMediaStream.getTracks().forEach(track => track.stop());
    userMediaStream = null;
  }
  
  // Close data channel
  if (dataChannel) {
    dataChannel.close();
    dataChannel = null;
  }
  
  // Close peer connection
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  // Remove audio element
  if (audioElement) {
    audioElement.srcObject = null;
    audioElement.remove();
    audioElement = null;
  }
  
  // Reset indicators
  userSpeakingDot.classList.remove('active');
  aiSpeakingDot.classList.remove('active');
  
  // Reset buttons
  startBtn.disabled = false;
  stopBtn.disabled = true;
  
  updateStatus('Session closed');
}

// Event listeners
startBtn.addEventListener('click', initializeSession);
stopBtn.addEventListener('click', closeSession);

// Initial status
updateStatus('Ready to start. Click "Start Conversation" to begin.');