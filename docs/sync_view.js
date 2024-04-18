'use strict';

// eslint-disable-next-line no-unused-vars
class SyncView {
  splitViewTimelineLoaded() {
    return new Promise(resolve => {
      let isLoaded = false;
      const checkLoading = setInterval(() => {
        const panels = SyncView.panels();
        for (const panel of panels) {
          if (panel?.state === 'Idle' && panel.element.ownerDocument.defaultView.TraceBounds) {
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


  static synchronizeRange(originalPanel, viewerInstance) {
    // tODO, sync it up at the start.
    return;
    viewerInstance._originalPanel = originalPanel;
    originalPanel.performanceModel.timelineModelInternal.maximumRecordTimeInternal
    const tracingModelMinimumRecordTime = originalPanel.performanceModel.timelineModelInternal.minimumRecordTimeInternal;
    const tracingModelMaximumRecordTime = originalPanel.performanceModel.timelineModelInternal.maximumRecordTimeInternal;
    const referenceDuration = tracingModelMaximumRecordTime - tracingModelMinimumRecordTime;

    const targetPanels = viewerInstance.targetPanels();
    for (const targetPanel of targetPanels) {

      const currentMin = targetPanel.performanceModel.timelineModelInternal.minimumRecordTimeInternal;
      const currentMax = targetPanel.performanceModel.timelineModelInternal.maximumRecordTimeInternal;

      // trace times are trace-specific and not 0-based
      const left = currentMin;
      // Keep left edge the same and just change the right to match duration.
      const right = Math.min(left + referenceDuration, currentMax);

      const targetTraceBounds = targetPanel.element.ownerDocument.defaultView.TraceBounds;
      targetTraceBounds.TraceBounds.BoundsManager.instance().setTimelineVisibleWindow(left, right,
          {
            shouldAnimate: true,
          },
      );

      // targetPanel.performanceModel.timelineModelInternal.maximumRecordTimeInternal =

      // performanceModel.setTracingModel(tracingModel);
      // targetPanel._setModel(performanceModel);

      const state = targetTraceBounds.TraceBounds.BoundsManager.instance().state();
      console.log({state});
    }

    // const selectionPcts = {
    //   start: originalPanel._overviewPane._overviewGrid._window.windowLeft,
    //   end: originalPanel._overviewPane._overviewGrid._window.windowRight
    // };
    // const durationMs = viewerInstance.syncView._getSelectionDuration(selectionPcts);
    // viewerInstance._setTargetPanelsDuration(durationMs);
  }



  /**
   * @param {object} requestedWindow
   * @param {object} opts
   */
  updateOther(requestedWindow, opts) {
    const subPanel = this.subPanel();
    const requestedDuration = requestedWindow.range;

    // Throttle this to 500ms
    if (this.existingTimer) {
      return
    } else {
      this.existingTimer = setTimeout(() => {
        this.existingTimer = clearTimeout(this.existingTimer);
      }, 100);
    }

    const otherPanels = globalThis.parent.viewerInstance.syncView.constructor.panels().filter(p => p !== subPanel);
    for (const otherPanel of otherPanels) {
      const otherTraceBounds = otherPanel.element.ownerDocument.defaultView.TraceBounds;
      const otherBoundsMgr = otherTraceBounds.TraceBounds.BoundsManager.instance();
      const existingWindow = otherBoundsMgr.state()?.micro?.timelineTraceWindow;
      if (!existingWindow) {
        console.warn('no state yet'); continue;
      }

      const newWindow = {
        min: existingWindow.min,
        max: existingWindow.min + requestedDuration,
        range: requestedDuration
      };

      // Here to the end of loop -- Copied from TraceBounds.ts
      if (newWindow.min === existingWindow.min && newWindow.max === existingWindow.max) {
        // New bounds are identical to the old ones so no action required.
        return;
      }

      // if (newWindow.range < 1_000) {
      //   // Minimum timeline visible window range is 1 millisecond.
      //   return;
      // }

      // Ensure that the setTimelineVisibleWindow can never go outside the bounds of the minimap bounds.
      newWindow.min = Math.max(otherBoundsMgr.state().micro.minimapTraceBounds.min, newWindow.min);
      newWindow.max = Math.min(otherBoundsMgr.state().micro.minimapTraceBounds.max, newWindow.max);

      opts = opts || {};
      opts.updatedByTV = true;
      otherBoundsMgr.setTimelineVisibleWindow(newWindow, opts)
    }
  }

  _setTargetPanelsDuration(durationMs) {
    // calculate what target frames should be:
    const targetPanels = this.targetPanels();
    for (const targetPanel of targetPanels) {
      const absoluteMin = targetPanel._overviewPane._overviewCalculator.minimumBoundary();
      const targetTraceLengthMs = targetPanel._overviewPane._overviewCalculator.maximumBoundary() - absoluteMin;
      const currentLeftOffsetPct = targetPanel._overviewPane._overviewGrid._window.windowLeft;

      const windowPercentages = {
        left: currentLeftOffsetPct,
        right: currentLeftOffsetPct + (durationMs / targetTraceLengthMs)
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

  static requestWindowTimesPatch(startTime, endTime, animate, viewerInstance) {
    const durationMs = endTime - startTime;
    // sync our targetPanels
    viewerInstance.syncView._setTargetPanelsDuration(durationMs);
    // original requestWindowTimes behavior
    this._flameChartDelegate.requestWindowTimes(startTime, endTime, animate);
  }

  static timelines() {
    const frames = window.parent.document.getElementsByTagName('frame');
    throw new Error('sdfsdf');
    return Array.from(frames)
      .map(frame => frame.contentWindow?.UI?.panels?.timeline);
  }

  static panels() {
    const frames = window.parent.document.getElementsByTagName('frame');
    return Array.from(frames)
      .map(frame => frame.contentWindow?.UI?.panels?.timeline);
    // const timelines = SyncView.timelines();
    // return timelines.map(Timeline => Timeline.TimelinePanel.instance());
  }

  subPanel() {
    if (!this._subPanel) {
      this._subPanel = globalThis.UI?.panels?.timeline;
    }

    return this._subPanel;
  }

  targetPanels() {
    return SyncView.panels().filter(panel => panel !== this.subPanel());
  }
}

class StateChangedEvent extends Event {
  constructor(state, updateType, options = {shouldAnimate: false}) {
    super('traceboundsstatechanged', {composed: true, bubbles: true});
    this.state = state;
    this.updateType = updateType;
    this.options = options;
  }
}
