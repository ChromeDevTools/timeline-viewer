'use strict';

/* globals SyncView, PerfUI */

class SyncView {

  monkepatchSetWindowPosition(viewerInstance) {
    PerfUI.OverviewGrid.Window.prototype._setWindowPosition = function(start, end) {
      const overviewGridWindow = this;
      SyncView.setWindowPositionPatch.call(overviewGridWindow, start, end, viewerInstance);
    };
  }

  splitViewTimlineLoaded() {
    return new Promise(resolve => {
      let isLoaded = false;
      const checkLoading = setInterval(() => {
        const frames = document.getElementsByTagName('frame');
        for (const frame of frames) {
          const Timeline = frame.contentWindow['Timeline'];
          const panel = Timeline.TimelinePanel.instance();
          if (panel._state === Timeline.TimelinePanel.State.Idle) {
            isLoaded = true;
          } else {
            isLoaded = false;
            return;
          }
        }
        if (isLoaded) {
          clearInterval(checkLoading);
          resolve();
        }
      }, 500);
    });
  }

  synchronizeRange() {
    const panel = document.getElementById('split-view-0').contentWindow['Timeline'].TimelinePanel.instance();
    const tracingModelMinimumRecordTime = panel._performanceModel.tracingModel().minimumRecordTime();
    const tracingModelMaximumRecordTime = panel._performanceModel.tracingModel().maximumRecordTime();
    const referenceDuration = tracingModelMaximumRecordTime - tracingModelMinimumRecordTime;

    const frames = document.getElementsByTagName('frame');
    for (let frame of frames) {
      const Timeline = frame.contentWindow['Timeline'];
      const panel = Timeline.TimelinePanel.instance();
      const performanceModel = panel._performanceModel;
      const tracingModel = performanceModel.tracingModel();

      // trace times are trace-specific and not 0-based
      const baseTime = tracingModel.minimumRecordTime();
      tracingModel._maximumRecordTime = Math.min(baseTime + referenceDuration, tracingModel._maximumRecordTime);

      performanceModel.setTracingModel(tracingModel);

      panel._setModel(performanceModel);
    }
  }

  /**
   * monkey patched for PerfUI.OverviewGrid.Window.prototype._setWindowPosition
   * @param {?number} start
   * @param {?number} end
   * @param {?Viewer} viewerInstance
   */
  static setWindowPositionPatch(start, end, viewerInstance) {
    // proceed w/ original code for our origin frame
    const selectionPcts = SyncView.originalSetWindowPosition.call(this, start, end);

    function getSelectionTimes() {
      const originPanel = window.Timeline.TimelinePanel.instance();
      const originTraceStart = originPanel._overviewPane._overviewCalculator.minimumBoundary();
      const originTraceLengthMs = originPanel._overviewPane._overviewCalculator.maximumBoundary() - originTraceStart;

      // calculate the selectionStart offset of origin frame
      const originSelectionStartMs = selectionPcts.start * originTraceLengthMs;
      const originSelectionDurationMs = (selectionPcts.end - selectionPcts.start) * originTraceLengthMs;
      return {
        start: originSelectionStartMs,
        duration: originSelectionDurationMs
      };
    }

    const selectionMs = getSelectionTimes();

    // calculate what target frames should be:
    // TODO should not be hardcoding the 2nd frame, but instead iterating over frames and excluding same-frame..
    const targetPanel = window.parent.document.getElementById('split-view-1').contentWindow['Timeline'].TimelinePanel.instance();
    const absoluteMin = targetPanel._overviewPane._overviewCalculator.minimumBoundary();
    const targetTraceLengthMs = targetPanel._overviewPane._overviewCalculator.maximumBoundary() - absoluteMin;

    const windowPercentages = {
      left: selectionMs.start / targetTraceLengthMs,
      right: (selectionMs.start + selectionMs.duration) / targetTraceLengthMs
    };
    // call it on the frame's PerfUI.OverviewGrid.Window
    targetPanel._overviewPane._overviewGrid._window._setWindow(windowPercentages.left, windowPercentages.right);
  }

  /**
   * No significant changes from the real thing, except adding a return value
   *   https://github.com/ChromeDevTools/devtools-frontend/blob/3becf6724b90a6a4cd41b2cf10f053c7efd166fe/front_end/perf_ui/OverviewGrid.js#L357-L366
   * @param {?number} start
   * @param {?number} end
   * @param {*}
   */
  static originalSetWindowPosition(start, end) {
    const clientWidth = this._parentElement.clientWidth;
    const windowLeft = typeof start === 'number' ? start / clientWidth : this.windowLeft;
    const windowRight = typeof end === 'number' ? end / clientWidth : this.windowRight;
    this._setWindow(windowLeft, windowRight);

    return {
      start: windowLeft,
      end: windowRight
    };
  }

}
