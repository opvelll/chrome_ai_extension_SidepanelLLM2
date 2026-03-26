const globalState = window as Window & {
  __sidepanelContentScriptInstalled__?: boolean;
  __sidepanelLastSelection__?: string;
  __sidepanelAreaCaptureCleanup__?: (() => void) | null;
  __sidepanelAutomationElementCounter__?: number;
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

  function getAutomationSelector(element: Element): string {
    const existingId = element.getAttribute('data-sidepanel-automation-id');
    if (existingId) {
      return `[data-sidepanel-automation-id="${existingId}"]`;
    }

    const nextId = `sp-auto-${globalState.__sidepanelAutomationElementCounter__ ?? 0}`;
    globalState.__sidepanelAutomationElementCounter__ = (globalState.__sidepanelAutomationElementCounter__ ?? 0) + 1;
    element.setAttribute('data-sidepanel-automation-id', nextId);
    return `[data-sidepanel-automation-id="${nextId}"]`;
  }

  function isVisibleElement(element: Element): element is HTMLElement {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function describeElementRole(element: HTMLElement): string {
    const explicitRole = element.getAttribute('role');
    if (explicitRole) {
      return explicitRole;
    }

    if (element instanceof HTMLAnchorElement) {
      return 'link';
    }
    if (element instanceof HTMLButtonElement) {
      return 'button';
    }
    if (element instanceof HTMLInputElement) {
      return element.type || 'input';
    }
    if (element instanceof HTMLTextAreaElement) {
      return 'textarea';
    }
    if (element.isContentEditable) {
      return 'contenteditable';
    }

    return element.tagName.toLowerCase();
  }

  function describeElementText(element: HTMLElement): string {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return normalizeText(element.value || element.placeholder || '');
    }

    return normalizeText(element.innerText || element.textContent || '');
  }

  function getAccessibleLabel(element: HTMLElement): string {
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return normalizeText(ariaLabel);
    }

    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ');
      const normalized = normalizeText(text);
      if (normalized) {
        return normalized;
      }
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const label = element.labels?.[0]?.textContent;
      if (label) {
        return normalizeText(label);
      }
    }

    return '';
  }

  function getInteractiveElements(maxElements = 30) {
    const selector = [
      'button',
      'a[href]',
      'input',
      'textarea',
      'select',
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[contenteditable="true"]',
      '[tabindex]',
    ].join(',');

    return Array.from(document.querySelectorAll(selector))
      .filter(isVisibleElement)
      .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true')
      .slice(0, maxElements)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          selector: getAutomationSelector(element),
          tag: element.tagName.toLowerCase(),
          role: describeElementRole(element),
          text: describeElementText(element).slice(0, 120),
          label: getAccessibleLabel(element).slice(0, 120),
          placeholder:
            element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
              ? element.placeholder.slice(0, 120)
              : '',
          href: element instanceof HTMLAnchorElement ? element.href : '',
          disabled: Boolean((element as HTMLInputElement | HTMLButtonElement).disabled),
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      });
  }

  function buildPageSnapshot(maxElements?: number) {
    return {
      title: document.title,
      url: window.location.href,
      readyState: document.readyState,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollY: Math.round(window.scrollY),
        scrollHeight: Math.round(document.documentElement.scrollHeight),
      },
      selectionText: normalizeText(window.getSelection()?.toString() ?? '').slice(0, 400),
      elements: getInteractiveElements(maxElements),
    };
  }

  function getPageStructureText(maxElements = 24): string {
    const snapshot = buildPageSnapshot(maxElements);
    const lines = [
      `Title: ${snapshot.title}`,
      `URL: ${snapshot.url}`,
      `Ready state: ${snapshot.readyState}`,
      `Viewport: ${snapshot.viewport.width}x${snapshot.viewport.height}`,
      `Scroll Y: ${snapshot.viewport.scrollY}`,
      `Visible interactive elements:`,
    ];

    snapshot.elements.forEach((element, index) => {
      lines.push(
        [
          `${index + 1}. selector=${element.selector}`,
          `role=${element.role}`,
          element.label ? `label=${element.label}` : '',
          element.text ? `text=${element.text}` : '',
          element.placeholder ? `placeholder=${element.placeholder}` : '',
          element.href ? `href=${element.href}` : '',
        ].filter(Boolean).join(' | '),
      );
    });

    if (snapshot.selectionText) {
      lines.push(`Current selection: ${snapshot.selectionText}`);
    }

    return lines.join('\n').slice(0, 12000);
  }

  function getTargetElement(selector: string): HTMLElement {
    const element = document.querySelector(selector);
    if (!element || !isVisibleElement(element)) {
      throw new Error(`Element not found or not visible for selector: ${selector}`);
    }
    return element;
  }

  function triggerKeyboardEvent(target: EventTarget | null, type: 'keydown' | 'keyup', key: string) {
    target?.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
  }

  async function waitForCondition(
    predicate: () => boolean,
    timeoutMs: number,
  ): Promise<boolean> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (predicate()) {
        return true;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }

    return predicate();
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
        await chrome.runtime.sendMessage({
          type: 'context.captureArea',
          payload,
        });
      } catch {
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
      return;
    }

    if (request?.type === 'content.getPageStructure') {
      sendResponse({ text: getPageStructureText() });
      return;
    }

    if (request?.type === 'content.automationInspectPage') {
      sendResponse(buildPageSnapshot(request.payload?.maxElements));
      return;
    }

    if (request?.type === 'content.automationClick') {
      try {
        const element = getTargetElement(request.payload.selector);
        element.scrollIntoView({ block: 'center', inline: 'center' });
        element.focus();
        element.click();
        sendResponse({
          ok: true,
          selector: request.payload.selector,
          title: document.title,
          url: window.location.href,
        });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Unable to click the requested element.',
        });
      }
      return;
    }

    if (request?.type === 'content.automationType') {
      try {
        const element = getTargetElement(request.payload.selector);
        element.scrollIntoView({ block: 'center', inline: 'center' });
        element.focus();

        const shouldClear = request.payload.clear ?? true;
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          if (shouldClear) {
            element.value = '';
          }
          element.value += request.payload.text;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          if (request.payload.submit) {
            if (element.form) {
              element.form.requestSubmit();
            } else {
              triggerKeyboardEvent(element, 'keydown', 'Enter');
              triggerKeyboardEvent(element, 'keyup', 'Enter');
            }
          }
        } else if (element.isContentEditable) {
          if (shouldClear) {
            element.textContent = '';
          }
          element.textContent = `${element.textContent ?? ''}${request.payload.text}`;
          element.dispatchEvent(new InputEvent('input', { bubbles: true, data: request.payload.text, inputType: 'insertText' }));
          if (request.payload.submit) {
            triggerKeyboardEvent(element, 'keydown', 'Enter');
            triggerKeyboardEvent(element, 'keyup', 'Enter');
          }
        } else {
          throw new Error('Target element does not accept typed input.');
        }

        sendResponse({
          ok: true,
          selector: request.payload.selector,
          value:
            element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
              ? element.value
              : normalizeText(element.textContent ?? ''),
        });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Unable to type into the requested element.',
        });
      }
      return;
    }

    if (request?.type === 'content.automationScroll') {
      const amount = request.payload.amount ?? 600;
      const direction = request.payload.direction === 'up' ? -1 : 1;
      window.scrollBy({
        top: direction * amount,
        left: 0,
        behavior: 'instant',
      });
      sendResponse({
        ok: true,
        scrollY: Math.round(window.scrollY),
      });
      return;
    }

    if (request?.type === 'content.automationPressKey') {
      const target = (document.activeElement as HTMLElement | null) ?? document.body;
      triggerKeyboardEvent(target, 'keydown', request.payload.key);
      triggerKeyboardEvent(target, 'keyup', request.payload.key);
      sendResponse({
        ok: true,
        key: request.payload.key,
        activeTag: target?.tagName?.toLowerCase() ?? '',
      });
      return;
    }

    if (request?.type === 'content.automationWait') {
      const timeoutMs = request.payload.timeoutMs ?? 1500;
      void waitForCondition(() => {
        if (request.payload.selector) {
          const selectorMatch = document.querySelector(request.payload.selector);
          if (!selectorMatch || !isVisibleElement(selectorMatch)) {
            return false;
          }
        }

        if (request.payload.text) {
          const pageText = normalizeText(document.body?.innerText ?? '');
          if (!pageText.includes(normalizeText(request.payload.text))) {
            return false;
          }
        }

        return true;
      }, timeoutMs).then((matched) => {
        sendResponse({
          ok: matched,
          matched,
          title: document.title,
          url: window.location.href,
        });
      });
      return true;
    }
  });
}
