import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { VideoCallComponent } from './video-call/video-call.component';
import { ChatMessagingComponent } from './chat-messaging/chat-messaging.component';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [
    AppComponent,
    VideoCallComponent,
    ChatMessagingComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    RouterModule.forRoot([]) 
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
