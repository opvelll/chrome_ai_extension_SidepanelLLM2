const globalState = window as Window & {
  __sidepanelContentScriptInstalled__?: boolean;
  __sidepanelLastSelection__?: string;
  __sidepanelAreaCaptureCleanup__?: (() => void) | null;
};

if (!globalState.__sidepanelContentScriptInstalled__) {
  globalState.__sidepanelContentScriptInstalled__ = true;

  function normalizeText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  function getPageText(): string {
    const article = document.querySelector('main, article, [role="main"]');
    const source = article?.textContent || document.body?.innerText || '';
    return normalizeText(source).slice(0, 12000);
  }

  function installAreaCapture() {
    const overlay = document.createElement('div');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '2147483647';
    overlay.style.pointerEvents = 'none';
    overlay.style.display = 'none';
    overlay.style.background = 'rgba(28, 25, 23, 0.14)';

    const selectionBox = document.createElement('div');
    selectionBox.style.position = 'absolute';
    selectionBox.style.border = '2px solid #0f766e';
    selectionBox.style.background = 'rgba(15, 118, 110, 0.18)';
    selectionBox.style.boxShadow = '0 0 0 1px rgba(255, 255, 255, 0.7)';
    overlay.append(selectionBox);
    document.documentElement.append(overlay);

    let dragState:
      | {
          startX: number;
          startY: number;
          currentX: number;
          currentY: number;
        }
      | null = null;
    let suppressContextMenu = false;

    function renderSelectionBox() {
      if (!dragState) {
        overlay.style.display = 'none';
        return;
      }

      const left = Math.min(dragState.startX, dragState.currentX);
      const top = Math.min(dragState.startY, dragState.currentY);
      const width = Math.abs(dragState.currentX - dragState.startX);
      const height = Math.abs(dragState.currentY - dragState.startY);

      overlay.style.display = 'block';
      selectionBox.style.left = `${left}px`;
      selectionBox.style.top = `${top}px`;
      selectionBox.style.width = `${width}px`;
      selectionBox.style.height = `${height}px`;
    }

    function resetAreaCapture() {
      dragState = null;
      overlay.style.display = 'none';
    }

    function isAreaCaptureGesture(event: MouseEvent): boolean {
      return event.button === 2 && event.altKey;
    }

    async function finalizeAreaCapture() {
      if (!dragState) {
        return;
      }

      const left = Math.min(dragState.startX, dragState.currentX);
      const top = Math.min(dragState.startY, dragState.currentY);
      const width = Math.abs(dragState.currentX - dragState.startX);
      const height = Math.abs(dragState.currentY - dragState.startY);

      resetAreaCapture();

      if (width < 8 || height < 8) {
        console.log('[area-capture][content] skipped small rect', { left, top, width, height });
        return;
      }

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const payload = {
        x: left,
        y: top,
        width,
        height,
        devicePixelRatio: window.devicePixelRatio || 1,
      };

      try {
        console.log('[area-capture][content] sending captureArea', payload);
        const response = await chrome.runtime.sendMessage({
          type: 'context.captureArea',
          payload,
        });
        console.log('[area-capture][content] captureArea response', response);
      } catch {
        console.error('[area-capture][content] captureArea send failed');
        // Ignore transient runtime disconnects while pages are reloading.
      }
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (!isAreaCaptureGesture(event)) {
        return;
      }

      dragState = {
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
      };
      console.log('[area-capture][content] drag start', {
        x: event.clientX,
        y: event.clientY,
        altKey: event.altKey,
        button: event.button,
      });
      suppressContextMenu = true;
      renderSelectionBox();
      event.preventDefault();
      event.stopPropagation();
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragState) {
        return;
      }

      dragState.currentX = event.clientX;
      dragState.currentY = event.clientY;
      renderSelectionBox();
      event.preventDefault();
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (!dragState || event.button !== 2) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      console.log('[area-capture][content] drag end', {
        startX: dragState.startX,
        startY: dragState.startY,
        endX: dragState.currentX,
        endY: dragState.currentY,
      });
      void finalizeAreaCapture();
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (!dragState && !suppressContextMenu) {
        return;
      }

      suppressContextMenu = false;
      event.preventDefault();
      event.stopPropagation();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      suppressContextMenu = false;
      resetAreaCapture();
    };

    const handleWindowBlur = () => {
      suppressContextMenu = false;
      resetAreaCapture();
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('blur', handleWindowBlur);

    globalState.__sidepanelAreaCaptureCleanup__ = () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('blur', handleWindowBlur);
      overlay.remove();
    };
  }

  async function publishSelectionSnapshot() {
    const nextSelection = normalizeText(window.getSelection()?.toString() ?? '');

    if (nextSelection === globalState.__sidepanelLastSelection__) {
      return;
    }

    globalState.__sidepanelLastSelection__ = nextSelection;

    try {
      await chrome.runtime.sendMessage({
        type: 'context.selectionChanged',
        payload: { text: nextSelection },
      });
    } catch {
      // Ignore transient runtime disconnects while pages are reloading.
    }
  }

  document.addEventListener('selectionchange', () => {
    void publishSelectionSnapshot();
  });

  document.addEventListener('mouseup', () => {
    void publishSelectionSnapshot();
  });

  document.addEventListener('keyup', () => {
    void publishSelectionSnapshot();
  });

  void publishSelectionSnapshot();
  installAreaCapture();

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.type === 'content.getSelection') {
      const selection = window.getSelection()?.toString() ?? '';
      sendResponse({ text: normalizeText(selection) });
      return;
    }

    if (request?.type === 'content.getPageText') {
      sendResponse({ text: getPageText() });
    }
  });
}
