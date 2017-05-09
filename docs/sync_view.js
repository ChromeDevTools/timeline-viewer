'use strict';

/* globals SyncView, PerfUI, Timeline */

class SyncView {

  monkepatchSetWindowPosition(viewerInstance) {
    PerfUI.OverviewGrid.Window.prototype._setWindowPosition = function(start, end) {
      const overviewGridWindow = this;
      SyncView.setWindowPositionPatch.call(overviewGridWindow, start, end, viewerInstance);
    };
  }

  splitViewTimelineLoaded() {
    return new Promise(resolve => {
      let isLoaded = false;
      const checkLoading = setInterval(() => {
        const panels = SyncView.panels();
        for (let panel of panels) {
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
    const originalPanel = SyncView.originalPanel();
    const tracingModelMinimumRecordTime = originalPanel._performanceModel.tracingModel().minimumRecordTime();
    const tracingModelMaximumRecordTime = originalPanel._performanceModel.tracingModel().maximumRecordTime();
    const referenceDuration = tracingModelMaximumRecordTime - tracingModelMinimumRecordTime;

    const targetPanels = SyncView.targetPanels();
    for (let targetPanel of targetPanels) {
      const performanceModel = targetPanel._performanceModel;
      const tracingModel = performanceModel.tracingModel();

      // trace times are trace-specific and not 0-based
      const baseTime = tracingModel.minimumRecordTime();
      tracingModel._maximumRecordTime = Math.min(baseTime + referenceDuration, tracingModel._maximumRecordTime);

      performanceModel.setTracingModel(tracingModel);

      targetPanel._setModel(performanceModel);
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

    const targetPanels = SyncView.targetPanels();
    for (let targetPanel of targetPanels) {
      const absoluteMin = targetPanel._overviewPane._overviewCalculator.minimumBoundary();
      const targetTraceLengthMs = targetPanel._overviewPane._overviewCalculator.maximumBoundary() - absoluteMin;

      const windowPercentages = {
        left: selectionMs.start / targetTraceLengthMs,
        right: (selectionMs.start + selectionMs.duration) / targetTraceLengthMs
      };
      // call it on the frame's PerfUI.OverviewGrid.Window
      targetPanel._overviewPane._overviewGrid._window._setWindow(windowPercentages.left, windowPercentages.right);
    }
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

  static panels() {
    const framesNodes = window.parent.document.getElementsByTagName('frame');
    const frames = Array.from(framesNodes);
    return frames.reduce((panel, frame) => {
      return panel.concat(frame.contentWindow['Timeline'].TimelinePanel.instance());
    }, []);
  }

  static originalPanel() {
    return SyncView.panels()[0];
  }

  static targetPanels() {
    const panels = SyncView.panels();
    panels.shift();
    return panels;
  }

}
