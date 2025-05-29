import { Component, Renderer2 } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  showVideoCall = false;
  showMessaging = false;

  constructor(private renderer: Renderer2) {}

  toggleVideoCall() {
    this.showVideoCall = !this.showVideoCall;
    this.showMessaging = false; // Close chat when video call is opened
    this.updateBodyOverflow();
  }

  toggleMessaging() {
    this.showMessaging = !this.showMessaging;
    this.showVideoCall = false; // Close video call when chat is opened
    this.updateBodyOverflow();
  }

  private updateBodyOverflow() {
    const body = document.body;
    if (this.showVideoCall || this.showMessaging) {
      // Disable scrolling by adding 'overflow-hidden' class to body
      this.renderer.addClass(body, 'overflow-hidden');
    } else {
      // Enable scrolling when no components are open
      this.renderer.removeClass(body, 'overflow-hidden');
    }
  }
}
