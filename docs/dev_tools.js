'use strict';

// eslint-disable-next-line no-unused-vars
class DevTools {
  constructor(options) {
    this.viewerInstance = options.viewerInstance;
    this.attachMonkeyPatchListeners();
  }


  eventHasCtrlOrMeta(event) {
    return this.platform === 'mac' ? (event.metaKey && !event.ctrlKey) : (event.ctrlKey && !event.metaKey);
  }


  attachMonkeyPatchListeners() {
    // don't let devtools trap ctrl-r
    document.addEventListener('keydown', event => {
      if (self.UI && this.eventHasCtrlOrMeta(event) && String.fromCharCode(event.which).toLowerCase() === 'r') {
        event.handled = true;
      }
    });
  }

  init() {
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

    Common.moduleSetting = function(module) {
      const ret = {
        addChangeListener: _ => { },
        removeChangeListener: _ => { },
        get: _ => new Map(),
        set: _ => { },
        getAsArray: _ => []
      };
      if (module === 'releaseNoteVersionSeen') {
        ret.get = _ => Infinity;
      }
      if (module === 'showNativeFunctionsInJSProfile') {
        ret.get = _ => true;
      }
      if (module === 'flamechartMouseWheelAction') {
        ret.get = _ => 'zoom';
      }
      return ret;
    };

    // Common.settings is created in a window onload listener

    function monkeyPatch() {
      if (!Common.settings) {
        console.warn('not monkeypatching');
        return;
      }
      Common.settings.createSetting('timelineCaptureFilmStrip', true).set(true);

      this.monkepatchSetWindowPosition();
      this.monkeyPatchRequestWindowTimes();
      this.monkeypatchTimelineFeatures();
      this.monkeyPatchWindowChanged();
    }
    window.addEventListener('load', monkeyPatch.bind(this));
  }

  monkeypatchTimelineFeatures() {
    // Instead of gray for unknown events, color them by event name.
    UI.inspectorView.showPanel('timeline').then(() => {
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
    });
  }

  monkepatchSetWindowPosition() {
    const viewerInstance = this.viewerInstance;
    const plzRepeat = _ => setTimeout(_ => this.monkepatchSetWindowPosition(), 100);
    if (typeof PerfUI === 'undefined' || typeof PerfUI.OverviewGrid === 'undefined' ) return plzRepeat();

    PerfUI.OverviewGrid.Window.prototype._setWindowPosition = function(start, end) {
      const overviewGridWindow = this;
      SyncView.setWindowPositionPatch.call(overviewGridWindow, start, end, viewerInstance);
    };

    setTimeout(_ => this.tweakUI(), 250);
  }


  monkeyPatchRequestWindowTimes() {
    const viewerInstance = this.viewerInstance;
    const plzRepeat = _ => setTimeout(_ => this.monkeyPatchRequestWindowTimes(), 100);
    if (typeof PerfUI === 'undefined' || typeof PerfUI.FlameChart === 'undefined' ) return plzRepeat();

    // This is now called PerfUI.FlameChart.windowChanged, but otherwise the same
    PerfUI.FlameChart.prototype.requestWindowTimes = function(startTime, endTime, animate) {
      SyncView.requestWindowTimesPatch.call(this, startTime, endTime, animate, viewerInstance);
    };
  }

  // there's an infinite loop for some reason and this nips it in the bud
  monkeyPatchWindowChanged() {
    const plzRepeat = _ => setTimeout(_ => this.monkeyPatchWindowChanged(), 100);
    if (typeof PerfUI === 'undefined' || typeof PerfUI.FlameChart === 'undefined' ) return plzRepeat();

    const realWindowChanged = PerfUI.FlameChart.prototype.windowChanged;
    PerfUI.FlameChart.prototype.windowChanged = function(startTime, endTime, animate) {
      if (isNaN(startTime)) return;
      const flameChart = this;
      realWindowChanged.call(flameChart, startTime, endTime, animate);
    };
  }

  tweakUI() {
    try {
      // remove panel tabs
      const tabbedPaneHeaderEl = document
          .querySelector('.root-view .tabbed-pane')
          .shadowRoot
          .querySelector('.vbox > .tabbed-pane-header');
      tabbedPaneHeaderEl.style.setProperty('--toolbar-bg-color', 'var(--md-sys-color-surface-container-highest)');
      tabbedPaneHeaderEl.style.alignItems = 'center';
      tabbedPaneHeaderEl.style.justifyContent = 'center';
      tabbedPaneHeaderEl.style.fontSize = '120%';
      tabbedPaneHeaderEl.innerHTML = '<span>DevTools Performance Timeline</span>';

      // remove buttons from perf panel toolbar
      document.querySelector('.root-view .tabbed-pane > .view-container .timeline-main-toolbar')
        .shadowRoot.querySelector('.toolbar-shadow')
        .querySelectorAll('button,div').
        forEach(elem => elem.remove());
    } catch (e) {
      console.warn('failed to tweak UI', e);
    }
  }

  monkeypatchLoadResourcePromise() {
    this.viewerInstance._orig_loadResourcePromise = Root.Runtime.loadResourcePromise;
    Root.Runtime.loadResourcePromise = this.viewerInstance.loadResource.bind(this.viewerInstance);
  }

  monkeyPatchingHandleDrop() {
    // todo add detection for correct panel in split view
    // todo sync traces after dropping file
    if (window.Timeline && window.Timeline.TimelinePanel) {
      const timelinePanel = Timeline.TimelinePanel.instance();
      const dropTarget = timelinePanel._dropTarget;
      const handleDrop = dropTarget._handleDrop;
      dropTarget._handleDrop = function(...args) {
        handleDrop.apply(dropTarget, args);
      };
    }
  }

  monkepatchSetMarkers() {
    const panel = Timeline.TimelinePanel.instance();
    const oldSetMarkers = panel._setMarkers;
    panel._setMarkers = function() {
      if (this._performanceModel._timelineModel.networkRequests().length === 0) {
        Common.settings.createSetting('timelineCaptureNetwork', true).set(false);
      }
      if (this._performanceModel.filmStripModel()._frames.length === 0) {
        Common.settings.createSetting('timelineCaptureFilmStrip', true).set(false);
      }
      oldSetMarkers.call(this, this._performanceModel._timelineModel);
    };
  }
}
