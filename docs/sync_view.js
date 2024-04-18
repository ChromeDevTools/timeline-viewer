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



  /**
   * do the sync magic
   * this also ends up getting called on initial load.
   * 1st frame is often set to match 2nd frame's starting window
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


  static panels() {
    const frames = window.parent.document.getElementsByTagName('frame');
    return Array.from(frames)
      .map(frame => frame.contentWindow?.UI?.panels?.timeline);
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
