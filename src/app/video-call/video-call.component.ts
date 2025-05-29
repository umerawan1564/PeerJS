import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import Peer from 'peerjs';

@Component({
  selector: 'app-video-call',
  templateUrl: './video-call.component.html',
  styleUrls: ['./video-call.component.css']
})
export class VideoCallComponent implements OnInit, OnDestroy {

  peer!: Peer;
  connections: any[] = [];
  myId: string = '';
  connectionStatus: string = 'Not connected';
  message: string = '';
  connectedPeers: string[] = [];
  peerId: string = '';
  myName: string = 'User';
  peerNames: Map<string, string> = new Map();
  shareableLink: string = '';  
  isSidebarOpen = true;
  localStream!: MediaStream;
  activeCalls: Map<string, any> = new Map(); 

  constructor(private route: ActivatedRoute, private location: Location) {}

  ngOnInit(): void {
    this.peer = new Peer();

    this.peer.on('open', (id: string) => {
      this.myId = id;
      console.log('My peer ID: ', this.myId);
      this.updateConnectionStatus('Waiting for peers...');

      this.route.queryParams.subscribe(params => {
        const incomingPeerId = params['peer'];
        if (incomingPeerId) {
          this.peerId = incomingPeerId;
        }
      });
    });

    this.peer.on('connection', (connection: any) => {
      this.addPeerConnection(connection);

      connection.on('data', (data: any) => {
        this.handleIncomingData(data, connection.peer);
      });

      connection.on('open', () => {
        const nameChangeMessage = {
          type: 'name-change',
          peerId: this.myId,
          name: this.myName
        };
        connection.send(nameChangeMessage);
      });
    });

    this.peer.on('disconnected', () => {
      this.updateConnectionStatus('Disconnected from the network.');
    });
    
    this.peer.on('call', (call: any) => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('Media devices API not supported in this browser.');
    return;
  }

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      this.localStream = stream;

      // ✅ Show local video for the callee
      this.displayVideoStream(this.localStream, 'You');

      call.answer(stream); // Answer the call with our local stream
      this.handleCallStream(call);
    }).catch(err => console.error('Error accessing media devices.', err));
  });


  }

  startCall(): void {
    if (!this.connectedPeers.length) {
      alert('No peers to call.');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Your browser does not support media devices API.');
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      this.localStream = stream;
      this.displayVideoStream(stream, 'You');

      this.connectedPeers.forEach(peerId => {
        const call = this.peer.call(peerId, stream);
        this.handleCallStream(call);
      });
    }).catch(err => console.error('Media access denied:', err));
  }


  handleCallStream(call: any): void {
    call.on('stream', (remoteStream: MediaStream) => {
      if (!this.activeCalls.has(call.peer)) {
        this.displayVideoStream(remoteStream, call.peer);
        this.activeCalls.set(call.peer, call);
      }
    });

    call.on('close', () => {
      this.removeVideoStream(call.peer);
      this.activeCalls.delete(call.peer);
    });
  }

  endCall(): void {
    // Close all active calls and stop their media streams
    this.activeCalls.forEach((call, peerId) => {
      if (call && call.close) {
        call.close();
      }
      // Try to stop all tracks of remote streams
      if (call && call.remoteStream) {
        call.remoteStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      this.removeVideoStream(peerId);
    });
    this.activeCalls.clear();
    
    // Remove your own video element
    this.removeVideoStream('You');

    // Stop all tracks of the local stream to release camera and mic
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
  }


  displayVideoStream(stream: MediaStream, label: string): void {
    const container = document.getElementById('video-window');
    if (!container) return;

    if (document.getElementById(`video-${label}`)) {
      return;
    }

    const videoWrapper = document.createElement('div');
    videoWrapper.classList.add('relative', 'rounded-lg', 'overflow-hidden', 'shadow');

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.classList.add('w-full', 'rounded');

    const nameTag = document.createElement('div');
    nameTag.innerText = label;
    nameTag.classList.add('absolute', 'bottom-1', 'left-1', 'bg-black', 'text-white', 'text-xs', 'px-2', 'py-1', 'rounded');

    videoWrapper.appendChild(video);
    videoWrapper.appendChild(nameTag);
    videoWrapper.id = `video-${label}`;
    container.appendChild(videoWrapper);
  }

  removeVideoStream(label: string): void {
    const videoEl = document.getElementById(`video-${label}`);
    if (videoEl) {
      videoEl.remove();
    }
  }

 shareLink(): void {
  if (!this.myId) return;

  const baseUrl = window.location.origin;
  this.shareableLink = `${baseUrl}?peer=${this.myId}`;
}


  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  sendMessage(): void {
    const text = this.message.trim();
    if (!text) return;

    const chatMessage = {
      type: 'chat',
      peerId: this.myId,
      name: this.myName,
      message: text
    };

    this.connections.forEach(conn => conn.send(chatMessage));
    this.displayMessage(text, 'You');
    this.message = '';
  }

  handleIncomingData(data: any, fromPeer: string): void {
    if (typeof data === 'object' && data !== null) {
      switch (data.type) {
        case 'name-change':
          this.peerNames.set(data.peerId, data.name);
          this.displayMessage(`${data.peerId} changed their name to: ${data.name}`, 'System');
          break;
        case 'chat':
          this.peerNames.set(data.peerId, data.name);
          const senderName = this.peerNames.get(data.peerId) || `Peer ${data.peerId.slice(-4)}`;
          this.displayMessage(data.message, senderName);
          break;
        case 'disconnect':
          this.displayMessage(`${fromPeer} has disconnected.`, 'System');
          this.cleanUpConnection(fromPeer);
          break;
        default:
          console.warn('Unknown message type:', data);
          this.displayMessage(`[Unknown message type] ${JSON.stringify(data)}`, `Peer ${fromPeer.slice(-4)}`);
      }
    } else {
      const fallbackName = this.peerNames.get(fromPeer) || `Peer ${fromPeer.slice(-4)}`;
      this.displayMessage(String(data), fallbackName);
    }
  }

  displayMessage(message: string, sender: string): void {
    const chatWindow = document.getElementById('chat-window') as HTMLElement;
    if (!chatWindow) {
      console.warn('Chat window not found, skipping message rendering.');
      return;
    }

    const messageElement = document.createElement('div');
    messageElement.classList.add('p-2', 'mb-2', 'rounded-lg', 'shadow-sm');

    if (sender === 'You') {
      messageElement.classList.add('bg-blue-100', 'text-blue-800');
      messageElement.innerHTML = `<strong>You:</strong> ${message}`;
    } else if (sender === 'System') {
      messageElement.classList.add('bg-yellow-100', 'text-yellow-800');
      messageElement.innerHTML = `<em>System:</em> ${message}`;
    } else {
      messageElement.classList.add('bg-gray-100', 'text-gray-800');
      messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
    }

    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  connectToPeer(peerId: string): void {
    if (!this.peer || !peerId.trim()) return;

    if (this.connectedPeers.includes(peerId)) {
      alert('Already connected to this peer.');
      this.updateConnectionStatus(`Already connected to ${peerId}`);
      return;
    }

    const connection = this.peer.connect(peerId);

    connection.on('data', (data: any) => {
      this.handleIncomingData(data, connection.peer);
    });

    connection.on('open', () => {
      this.addPeerConnection(connection);

      const nameChangeMessage = {
        type: 'name-change',
        peerId: this.myId,
        name: this.myName
      };
      connection.send(nameChangeMessage);
    });

    connection.on('error', (err: any) => {
      console.error('Connection Error:', err);
      this.updateConnectionStatus('Failed to connect');
      this.disconnectFromPeer(this.peerId);
    });

    this.updateConnectionStatus(`Connecting to ${peerId}...`);
  }

  addPeerConnection(connection: any): void {
    this.connections.push(connection);
    this.connectedPeers.push(connection.peer);
    this.updateConnectionStatus(`Connected to ${connection.peer}`);
  }

  updateConnectionStatus(status: string): void {
    this.connectionStatus = status;
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      statusElement.innerHTML = this.connectionStatus;
    }
  }

  changeName(): void {
    if (this.myName.trim()) {
      this.peerNames.set(this.myId, this.myName);
      this.displayMessage(`You changed your name to: ${this.myName}`, 'You');

      const nameChangeMessage = {
        type: 'name-change',
        peerId: this.myId,
        name: this.myName
      };

      this.connections.forEach(conn => conn.send(nameChangeMessage));
    }
  }

  clearChat(): void {
    const chatWindow = document.getElementById('chat-window') as HTMLElement;
    while (chatWindow.firstChild) {
      chatWindow.removeChild(chatWindow.firstChild);
    }
  }

  disconnectFromPeer(peerId: string): void {
    const connection = this.connections.find(conn => conn.peer === peerId);
    if (connection) {
      const disconnectMessage = {
        type: 'disconnect',
        peerId: this.myId
      };
      connection.send(disconnectMessage);
      connection.close();
      this.cleanUpConnection(peerId);
    }
  }

  cleanUpConnection(peerId: string): void {
    // Remove connection references
    this.connections = this.connections.filter(conn => conn.peer !== peerId);
    this.connectedPeers = this.connectedPeers.filter(id => id !== peerId);

    // If there's an active call, close it and remove video
    if (this.activeCalls.has(peerId)) {
      const call = this.activeCalls.get(peerId);
      call.close();
      this.activeCalls.delete(peerId);
      this.removeVideoStream(peerId);
    }

    this.updateConnectionStatus(`Disconnected from ${peerId}`);
  }

  ngOnDestroy(): void {
    if (this.peer) {
      this.peer.destroy();
    }
  }
}
