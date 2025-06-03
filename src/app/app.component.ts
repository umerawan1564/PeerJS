import { Component, Renderer2, OnInit } from '@angular/core';
import {OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import Peer from 'peerjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  showVideoCall = true;  // Always true
  showMessaging = false;

  
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
  
    isProvider: boolean = false;
  
  

  constructor(private renderer: Renderer2,private route: ActivatedRoute, private location: Location) {}

  ngOnInit() {
     this.route.queryParams.subscribe(params => {
        const incomingPeerId = params['peer'];
        console.log('incomming peer id', incomingPeerId);
        const incomingName = params['name'];
        console.log('incomming name', incomingName);
  
        if (incomingName === 'provider') {
          // Provider uses incomingPeerId as their own Peer ID
          if (incomingName === 'provider') {
            this.peerId = incomingPeerId;
          } else {
            this.peerId = 'provider-' + this.generateRandomId();
            console.warn('No peer ID found for provider in URL, using fallback:', this.peerId);
          }
  
          this.peer = new Peer(this.peerId);
  
          this.peer.on('open', (id: string) => {
            this.myId = id;
            console.log('Provider Peer initialized with ID:', this.myId);
            this.updateConnectionStatus('Waiting for patients to connect...');
            // Provider waits for incoming connections and calls
          });
  
        } else {
          // Patient: create peer with auto-generated ID
          this.peer = new Peer();
  
          this.peer.on('open', (id: string) => {
            this.myId = id;
            console.log('Patient Peer initialized with ID:', this.myId);
            this.updateConnectionStatus('Connecting to provider...');
  
            if (incomingPeerId && incomingPeerId.trim()) {
              this.peerId = incomingPeerId.trim();
              this.connectToPeer(this.peerId);
            }
          });
        }
  
        this.setupPeerEvents();
  
        // Initially show the "No Active Video Call" placeholder
        this.updateNoVideoPlaceholderVisibility();
      });
    this.updateBodyOverflow();
  }

  toggleVideoCall() {
    // Optional: you can leave this empty
  }

  toggleMessaging() {
    this.showMessaging = !this.showMessaging;
    this.updateBodyOverflow();
  }

  private updateBodyOverflow() {
    const body = document.body;
    if (this.showVideoCall || this.showMessaging) {
      this.renderer.addClass(body, 'overflow-hidden');
    } else {
      this.renderer.removeClass(body, 'overflow-hidden');
    }
  }


  
    generateRandomId(): string {
      return Math.random().toString(36).substring(2, 10);
    }
  
    setupPeerEvents(): void {
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
  
        navigator.mediaDevices.getUserMedia({
          video: true,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        }).then(stream => {
          this.localStream = stream;
          this.displayVideoStream(this.localStream, 'You');
          call.answer(stream);
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
  
      navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      }).then(stream => {
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
          this.updateNoVideoPlaceholderVisibility();
        }
      });
  
      call.on('close', () => {
        this.removeVideoStream(call.peer);
        this.activeCalls.delete(call.peer);
        this.updateNoVideoPlaceholderVisibility();
      });
    }
  
    endCall(): void {
      this.activeCalls.forEach((call, peerId) => {
        if (call && call.close) call.close();
        if (call && call.remoteStream) {
          call.remoteStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        }
        this.removeVideoStream(peerId);
      });
      this.activeCalls.clear();
  
      this.removeVideoStream('You');
  
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
      }
  
      this.updateNoVideoPlaceholderVisibility();
    }
  
    displayVideoStream(stream: MediaStream, label: string): void {
      const container = document.getElementById('video-window');
      if (!container) return;
  
      if (document.getElementById(`video-${label}`)) return;
  
      const videoWrapper = document.createElement('div');
      videoWrapper.classList.add('relative', 'rounded-lg', 'overflow-hidden', 'shadow');
  
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.classList.add('w-full', 'rounded');
  
      if (label === 'You') {
        video.muted = true;
      }
  
      const nameTag = document.createElement('div');
      nameTag.innerText = label;
      nameTag.classList.add('absolute', 'bottom-1', 'left-1', 'bg-black', 'text-white', 'text-xs', 'px-2', 'py-1', 'rounded');
  
      videoWrapper.appendChild(video);
      videoWrapper.appendChild(nameTag);
      videoWrapper.id = `video-${label}`;
      container.appendChild(videoWrapper);
  
      this.updateNoVideoPlaceholderVisibility();
    }
  
    removeVideoStream(label: string): void {
      const videoEl = document.getElementById(`video-${label}`);
      if (videoEl) {
        videoEl.remove();
        this.updateNoVideoPlaceholderVisibility();
      }
    }
  
    /**
     * Toggles visibility of the "No Active Video Call" placeholder
     * depending on whether there are active video streams.
     */
    private updateNoVideoPlaceholderVisibility(): void {
      const placeholder = document.getElementById('no-video-placeholder');
      const videoContainer = document.getElementById('video-window');
  
      if (!placeholder || !videoContainer) return;
  
      // Count video elements excluding the placeholder itself
      const videoStreams = videoContainer.querySelectorAll('div[id^="video-"]');
      if (videoStreams.length > 0) {
        // Hide placeholder when videos are present
        placeholder.style.display = 'none';
      } else {
        // Show placeholder when no videos
        placeholder.style.display = 'flex';
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
  
        this.updateConnectionStatus(`Connected to ${peerId}`);
      });
  
      connection.on('close', () => {
        this.cleanUpConnection(peerId);
        this.updateConnectionStatus(`${peerId} disconnected.`);
      });
  
      connection.on('error', (err: any) => {
        console.error('Connection error:', err);
        alert(`Connection error with ${peerId}: ${err}`);
      });
    }
  
    addPeerConnection(connection: any): void {
      if (!this.connections.some(conn => conn.peer === connection.peer)) {
        this.connections.push(connection);
        this.connectedPeers.push(connection.peer);
      }
    }
  
    cleanUpConnection(peerId: string): void {
      this.connections = this.connections.filter(conn => conn.peer !== peerId);
      this.connectedPeers = this.connectedPeers.filter(id => id !== peerId);
      this.peerNames.delete(peerId);
      this.removeVideoStream(peerId);
    }
  
    updateConnectionStatus(status: string): void {
      this.connectionStatus = status;
    }
  
    ngOnDestroy(): void {
      this.endCall();
      this.peer.destroy();
    }
}
