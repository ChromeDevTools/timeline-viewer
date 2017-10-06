'use strict';

// eslint-disable-next-line no-unused-vars
class SocialAnnotationsModel {
  static get realtimeModelProperty() {
    return 'annotations';
  }

  addAnnotation(text) {
    if (!text.length) return;
    this.annotations.push({
      id: Utils.generateID(),
      author: 'Anonymous',
      date: Date.now(),
      text: text
    });
  }

  getAnnotations() {
    return this.annotations.asArray();
  }
}
