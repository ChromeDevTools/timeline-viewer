import DevToolsElement from 'dev-tools-element';

document.addEventListener('DOMContentLoaded', () => {
  const searchParams = new URL(location.href).searchParams;
  const timelineURL = searchParams.get('loadTimelineFromURL');

  if (timelineURL) {
    const devToolsElement = document.createElement('dev-tools-element');
    devToolsElement.setAttribute('src', timelineURL);

    const devToolsContainer = document.querySelector('.dev-tools-container');
    devToolsContainer.appendChild(devToolsElement);

    const welcomeContainer = document.querySelector('.welcome');
    welcomeContainer.classList.add('hide');
  }
});
