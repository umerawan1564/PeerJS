import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatMessagingComponent } from './chat-messaging.component';

describe('ChatMessagingComponent', () => {
  let component: ChatMessagingComponent;
  let fixture: ComponentFixture<ChatMessagingComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ChatMessagingComponent]
    });
    fixture = TestBed.createComponent(ChatMessagingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
