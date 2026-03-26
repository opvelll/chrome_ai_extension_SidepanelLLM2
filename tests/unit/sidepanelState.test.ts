import { describe, expect, it } from 'vitest';
import { getSessionListActiveId } from '../../src/sidepanel/lib/api';
import {
  appendDraftAttachment,
  appendSelectionAttachment,
  hasPageTextAttachment,
  hasPageStructureAttachment,
  removeDraftAttachment,
} from '../../src/sidepanel/utils/attachmentState';
import type { ChatSession, ContextAttachment } from '../../src/shared/models';

function createSession(id: string): ChatSession {
  return {
    id,
    title: `Session ${id}`,
    createdAt: '2026-03-13T00:00:00.000Z',
    updatedAt: '2026-03-13T00:00:00.000Z',
  };
}

function createSelectionAttachment(
  overrides: Partial<Extract<ContextAttachment, { kind: 'selectionText' }>> = {},
): Extract<ContextAttachment, { kind: 'selectionText' }> {
  return {
    id: 'selection-1',
    kind: 'selectionText',
    text: 'Selected text',
    source: {
      title: 'Example',
      url: 'https://example.com',
      hostname: 'example.com',
      pathname: '/',
      capturedAt: '2026-03-13T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('getSessionListActiveId', () => {
  it('prefers the newest session when requested', () => {
    const sessions = [createSession('newest'), createSession('older')];

    expect(getSessionListActiveId(sessions, 'older', true)).toBe('newest');
  });

  it('keeps the active session when it still exists', () => {
    const sessions = [createSession('one'), createSession('two')];

    expect(getSessionListActiveId(sessions, 'two')).toBe('two');
  });

  it('falls back to the first session when the active one is missing', () => {
    const sessions = [createSession('one'), createSession('two')];

    expect(getSessionListActiveId(sessions, 'missing')).toBe('one');
  });
});

describe('attachmentState', () => {
  it('deduplicates draft attachments by kind and capture source', () => {
    const initial = [createSelectionAttachment()];
    const duplicate = createSelectionAttachment({ id: 'selection-2' });

    expect(appendDraftAttachment(initial, duplicate)).toEqual(initial);
  });

  it('deduplicates selection attachments by text and url', () => {
    const initial = [createSelectionAttachment()];
    const duplicate = createSelectionAttachment({
      id: 'selection-2',
      source: {
        title: 'Another title',
        url: 'https://example.com',
        hostname: 'example.com',
        pathname: '/other',
        capturedAt: '2026-03-13T00:01:00.000Z',
      },
    });

    expect(appendSelectionAttachment(initial, duplicate)).toEqual(initial);
  });

  it('reports page attachments and removes draft attachments by id', () => {
    const pageAttachment: Extract<ContextAttachment, { kind: 'pageText' }> = {
      id: 'page-1',
      kind: 'pageText',
      text: 'Page text',
      source: {
        title: 'Example',
        url: 'https://example.com',
        hostname: 'example.com',
        pathname: '/',
        capturedAt: '2026-03-13T00:00:00.000Z',
      },
    };
    const selectionAttachment = createSelectionAttachment();
    const attachments: ContextAttachment[] = [selectionAttachment, pageAttachment];

    expect(hasPageTextAttachment(attachments)).toBe(true);
    expect(removeDraftAttachment(attachments, 'selection-1')).toEqual([pageAttachment]);
  });

  it('reports page structure attachments', () => {
    const structureAttachment: Extract<ContextAttachment, { kind: 'pageStructure' }> = {
      id: 'structure-1',
      kind: 'pageStructure',
      text: 'Visible interactive elements:\n1. selector=button',
      source: {
        title: 'Example',
        url: 'https://example.com',
        hostname: 'example.com',
        pathname: '/',
        capturedAt: '2026-03-13T00:00:00.000Z',
      },
    };

    expect(hasPageStructureAttachment([structureAttachment])).toBe(true);
  });
});
