'use strict';

// eslint-disable-next-line no-unused-vars
class SocialAnnotationsUI {
  constructor() {
    this.attachListeners();
  }

  get container() {
    return document.getElementById('social-annotations-container');
  }

  get toggleAnnotationsBtn() {
    return document.getElementById('toggle-annotations');
  }

  get addAnnotationsBtn() {
    return document.getElementById('add-annotation');
  }

  get annotationField() {
    return document.getElementById('annotation-text');
  }

  get annotationText() {
    return this.annotationField.value;
  }

  get annotationTemplate() {
    return `
      <div class="annotation" id="annotation-%id%">
        <p class="text">%text%</p>
        <span class="author">%author%</span>
        <span class="date">%date%</span>
      </div>
`;
  }

  attachListeners() {
    this.toggleAnnotationsBtn.addEventListener('click', this.toggleAnnotations.bind(this));
  }

  showToggleAnnotationsBtn() {
    this.toggleAnnotationsBtn.hidden = false;
  }

  toggleAnnotations() {
    this.container.hidden = !this.container.hidden;
  }

  renderAnnotations(annotations) {
    const nodes = document.createDocumentFragment();
    const hr = document.createElement('hr');
    for (const annotation of annotations) {
      nodes.appendChild(this.getAnnotationNode(annotation));
      nodes.appendChild(hr.cloneNode(true));
    }
    this.container.appendChild(nodes);
  }

  getAnnotationNode(annotation) {
    const parser = new DOMParser();
    const tpl = Utils.renderTemplate(this.annotationTemplate, {
      id: annotation.id,
      text: annotation.text,
      author: annotation.author,
      date: (new Date(annotation.date)).toUTCString(),
    });
    return parser.parseFromString(tpl, 'text/xml').firstChild;
  }
}
