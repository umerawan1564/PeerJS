import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import Peer from 'peerjs';
import { Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-chat-messaging',
  templateUrl: './chat-messaging.component.html',
  styleUrls: ['./chat-messaging.component.css']
})
export class ChatMessagingComponent implements OnInit, OnDestroy {
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
  isProvider: boolean = false;

  constructor(private route: ActivatedRoute, private location: Location) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const incomingPeerId = params['peer2'];
      const incomingName = params['name'];
      
      

      if (incomingName === 'provider') {
        this.isProvider = true;

        if (incomingPeerId && incomingPeerId.trim()) {
          this.peerId = incomingPeerId.trim();
        } else {
          this.peerId = 'provider-' + this.generateRandomId();
          console.warn('No peer ID found for provider in URL, using fallback:', this.peerId);
        }

        this.peer = new Peer(this.peerId);

        this.peer.on('open', (id: string) => {
          this.myId = id;
          console.log('Provider Peer initialized with ID:', this.myId);
          this.updateConnectionStatus('Waiting for patient to connect...');
        });

      } else {
        this.isProvider = false;
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
    });
  }

  generateRandomId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  


@Output() close = new EventEmitter<void>();

closeChat() {
  this.close.emit();
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
  }

  shareLink(): void {
    if (!this.myId) return;

    const loc = window.location;
    const baseUrl = `${loc.protocol}//${loc.hostname}${loc.port ? ':' + loc.port : ''}${loc.pathname}`;
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
    this.connections = this.connections.filter(conn => conn.peer !== peerId);
    this.connectedPeers = this.connectedPeers.filter(id => id !== peerId);
    this.updateConnectionStatus(`Disconnected from ${peerId}`);
  }

  ngOnDestroy(): void {
    if (this.peer) {
      this.peer.destroy();
    }
  }
}
