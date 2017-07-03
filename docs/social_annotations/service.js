'use strict';

// eslint-disable-next-line no-unused-vars
class SocialAnnotationsService {
  constructor() {
    this.realtimeUtils = new utils.RealtimeUtils({clientId: GoogleAuth.clientId});
    this.storage = new GoogleDrive();
    this.socialAnnotationsUI = new SocialAnnotationsUI();
    this.socialAnnotations = null;

    this.socialAnnotationsUI.addAnnotationsBtn.addEventListener('click', _ => {
      this.socialAnnotations.addAnnotation(this.socialAnnotationsUI.annotationText);
    });
  }

  get urlParamName() {
    return 'annotationId';
  }

  get realtimeModelProperty() {
    return SocialAnnotationsModel.realtimeModelProperty;
  }

  get realtimeStorageName() {
    return 'timeline-viewer-annotations';
  }

  authRealtimeUtils() {
    this.realtimeUtils.authorize(response => {
      if (response.error) {
        throw response.error;
      }
      this.socialAnnotationsUI.showToggleAnnotationsBtn();
      this.start();
    }, false);
  }

  start() {
    gapi.drive.realtime.custom.registerType(SocialAnnotationsModel, 'SocialAnnotationsModel');
    SocialAnnotationsModel.prototype[this.realtimeModelProperty] = gapi.drive.realtime.custom.collaborativeField(this.realtimeModelProperty);

    const id = this.realtimeUtils.getParam(this.urlParamName);
    if (id) {
      // Load the document id from the URL
      this.realtimeUtils.load(id.replace('/', ''), this.onLoad.bind(this), this.onInitialize.bind(this));
    } else {
      // Create a new document, add it to the URL
      this.realtimeUtils.createRealtimeFile(this.realtimeStorageName, createResponse => {
        if (createResponse.error) {
          throw createResponse.error;
        }
        this.storage.insertPermission(createResponse.id).then(_ => {
          // @fixme it's just to up and runing it
          const params = new URL(location.href).searchParams;
          const timelineUrl = params.get('loadTimelineFromURL');
          window.history.pushState(null, null, `?loadTimelineFromURL=${timelineUrl}&${this.urlParamName}=${createResponse.id}`);
          this.realtimeUtils.load(createResponse.id, this.onLoad.bind(this), this.onInitialize.bind(this));
        });
      });
    }
  }

  onInitialize(model) {
    const socialAnnotationsModel = model.create(SocialAnnotationsModel);
    model.getRoot().set('socialAnnotationsModel', socialAnnotationsModel);
    socialAnnotationsModel[this.realtimeModelProperty] = model.createList();
  }

  onLoad(doc) {
    const model = doc.getModel();
    this.socialAnnotations = model.getRoot().get('socialAnnotationsModel');
    const annotations = this.socialAnnotations.getAnnotations();
    if (annotations.length) {
      this.socialAnnotationsUI.renderAnnotations(annotations);
    }

    this.socialAnnotations[this.realtimeModelProperty].addEventListener(gapi.drive.realtime.EventType.VALUES_ADDED, event => {
      this.socialAnnotationsUI.renderAnnotations(event.values);
    });
  }
}
