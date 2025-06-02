import { Component, Renderer2, OnInit } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  showVideoCall = true;  // Always true
  showMessaging = false;

  constructor(private renderer: Renderer2) {}

  ngOnInit() {
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
}
