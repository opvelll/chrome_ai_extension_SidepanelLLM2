import type { ChatMessage } from '../../shared/models';

export type MessageListGroup =
  | {
      type: 'message';
      key: string;
      message: ChatMessage;
    }
  | {
      type: 'log-group';
      key: string;
      messages: ChatMessage[];
    };

export function groupMessagesForDisplay(messages: ChatMessage[]): MessageListGroup[] {
  const groups: MessageListGroup[] = [];
  let pendingLogs: ChatMessage[] = [];

  const flushPendingLogs = () => {
    if (pendingLogs.length === 0) {
      return;
    }

    groups.push({
      type: 'log-group',
      key: pendingLogs.map((message) => message.id).join(':'),
      messages: pendingLogs,
    });
    pendingLogs = [];
  };

  for (const message of messages) {
    if (message.role === 'log' && message.log) {
      pendingLogs.push(message);
      continue;
    }

    flushPendingLogs();
    groups.push({
      type: 'message',
      key: message.id,
      message,
    });
  }

  flushPendingLogs();
  return groups;
}
