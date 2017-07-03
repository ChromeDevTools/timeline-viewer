'use strict';

// eslint-disable-next-line no-unused-vars
class Notify {

  constructor() {
    Notification.requestPermission();
  }

  get granted() {
    return 'granted';
  }

  showInfoMessage(message) {
    if (Notification.permission === this.granted) {
      const notification = new Notification(message);
      setTimeout(notification.close.bind(notification), 3000);
    }
  }
}
