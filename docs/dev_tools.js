'use strict';

// eslint-disable-next-line no-unused-vars
class DevTools {
  constructor(options) {
    this.viewerInstance = options.viewerInstance;

  }


  async init() {

    this.monkeyPatchFetch();

    const [shell, workerApp] = await Promise.all([
      import('https://chrome-devtools-frontend.appspot.com/serve_rev/@70f00f477937b61ba1876a1fdbf9f2e914f24fe3/entrypoints/shell/shell.js'),
      import ('https://chrome-devtools-frontend.appspot.com/serve_rev/@70f00f477937b61ba1876a1fdbf9f2e914f24fe3/entrypoints/worker_app/worker_app.js'),
    ]);
    const [Root, Common, TraceBounds, legacy] = await Promise.all([
    // These shoulda already been fetched i just need a module reference for them
      import('https://chrome-devtools-frontend.appspot.com/serve_rev/@70f00f477937b61ba1876a1fdbf9f2e914f24fe3/core/root/root.js'),
      import('https://chrome-devtools-frontend.appspot.com/serve_rev/@70f00f477937b61ba1876a1fdbf9f2e914f24fe3/core/common/common.js'),
      import('https://chrome-devtools-frontend.appspot.com/serve_rev/@70f00f477937b61ba1876a1fdbf9f2e914f24fe3/services/trace_bounds/trace_bounds.js'),
      import('https://chrome-devtools-frontend.appspot.com/serve_rev/@70f00f477937b61ba1876a1fdbf9f2e914f24fe3/ui/legacy/legacy.js'),
    ]);
    globalThis.Root = Root;
    globalThis.Common = Common;
    globalThis.TraceBounds = TraceBounds;
    globalThis.legacy = legacy;

    Root.Runtime.experiments._supportEnabled = true;
    Root.Runtime.experiments.isEnabled = name => {
      switch (name) {
        case 'timelineV8RuntimeCallStats': return true;
        case 'timelineShowAllEvents': return true;
        case 'timelineShowAllProcesses': return true;
        default:
          return false;
      }
    };


    // force light theme as default (as landing looks terrible in dark)
    // user can override this in DT settings tho.
    localStorage.setItem('uiTheme', JSON.stringify('default'))

    // Don't show console drawer. This doesn't work but. the `drawerSplitWidget.hideSidebar` later does.
    localStorage.setItem('inspector.drawer-split-view-state', `{"horizontal":{"size":0,"showMode":"OnlyMain"}}`);
    sessionStorage.setItem('inspector.drawer-split-view-state', `{"horizontal":{"size":0,"showMode":"OnlyMain"}}`);


    const monkeyPatch = () => {
      if (!Common.Settings.Settings) {
        console.warn('not monkeypatching');
        return;
      }

      this.monkepatchSetTimelineVisibleWindow();
      this.monkeypatchTimelineFeatures();
    };
    monkeyPatch();
  }

  // todo maybe bring these back. they're kinda interesting.
  monkeypatchTimelineFeatures() {
    // Instead of gray for unknown events, color them by event name.
    // UI.inspectorView.showPanel('timeline').then(() => {
      // // Hue: all but red, Saturation: 15-35%, Lightness: 75%, Alpha: opaque
      // const colorGenerator = new Common.Color.Generator({min: 45, max: 325}, {min: 15, max: 35}, 75, 1);
      // const oldEventColor = Timeline.TimelineUIUtils.eventColor;

      // Timeline.TimelineUIUtils.eventColor = event => {
      //   const categoryName = Timeline.TimelineUIUtils.eventStyle(event).category.name;
      //   if (categoryName === 'other' || categoryName === 'async') {
      //     return colorGenerator.colorForID(event.name);
      //   }
      //   return oldEventColor.call(Timeline.TimelineUIUtils, event);
      // };

      // // Don't force to milliseconds always. Time Dividers can be shown in seconds
      // const formatTime = value => Number.millisToString(value, true);
      // Timeline.TimelineFlameChartNetworkDataProvider.prototype.formatValue = formatTime;
      // Timeline.TimelineFlameChartDataProvider.prototype.formatValue = formatTime;
      // PerfUI.TimelineOverviewCalculator.prototype.formatValue = function(value) {
      //   return formatTime(value - this.zeroTime());
      // };
    // });
  }

  monkepatchSetTimelineVisibleWindow() {
    const plzRepeat = _ => setTimeout(_ => this.monkepatchSetTimelineVisibleWindow(), 100);
    if (!globalThis.TraceBounds?.TraceBounds?.BoundsManager)  {
      return plzRepeat();
    }

    const boundsMgr = TraceBounds.TraceBounds.BoundsManager.instance();
    const orig = boundsMgr.setTimelineVisibleWindow;
    TraceBounds.TraceBounds.BoundsManager.instance().setTimelineVisibleWindow = (...args) => {
      let [requestedWindow, opts] = args;
      // Don't recursively update eachother
      if (!opts?.updatedByTV) {
        orig.apply(boundsMgr, args);
        this.viewerInstance.syncView.updateOther(requestedWindow, opts);
      }
      // Dont get into an infinite loop
      if (!this.viewerInstance.syncView.existingTimer) {
        return orig.apply(boundsMgr, args);
      }
    };

    this.tweakUI();
  }


  tweakUI() {
    const tabbedPaneHeaderEl = document
        .querySelector('.root-view .main-tabbed-pane')
        ?.shadowRoot
        ?.querySelector('.vbox > .tabbed-pane-header');

    const perfPanelToolbarEl = document.querySelector('.root-view .tabbed-pane > .view-container .timeline-main-toolbar')
        ?.shadowRoot?.querySelector('.toolbar-shadow');
    const plzRepeat = _ => setTimeout(_ => this.tweakUI(), 100);
    if (!tabbedPaneHeaderEl || !perfPanelToolbarEl)  {
      return plzRepeat();
    }

    try {
      // remove panel tabs
      tabbedPaneHeaderEl.style.setProperty('--toolbar-bg-color', 'var(--md-sys-color-surface-container-highest)');
      tabbedPaneHeaderEl.innerHTML = '';

      // show lil id of the trace being shown.
      const viewer = this.viewerInstance;
      tabbedPaneHeaderEl.textContent = viewer.timelineId
        ? `${viewer.timelineProvider}: ${viewer.timelineId}`
        : `${viewer.timelineURL.slice(viewer.timelineURL.lastIndexOf('/') + 1)}`;

      tabbedPaneHeaderEl.style.cssText += `
  justify-content: center;
  align-items: center;
  `;
      // remove buttons from perf panel toolbar
      perfPanelToolbarEl.querySelectorAll('button,div').forEach(elem => elem.remove());

      // hide console drawer
      legacy.InspectorView.InspectorView.instance().drawerSplitWidget.hideSidebar()
    } catch (e) {
      console.warn('failed to tweak UI', e);
    }
  }

  monkeyPatchFetch() {
    this.viewerInstance._orig_fetch = window.fetch;
    // DANGER DANGER
    window.fetch = (...args) => this.viewerInstance.fetchPatched(...args);
  }


}
