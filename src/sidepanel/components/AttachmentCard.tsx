import { X } from 'lucide-react';
import { attachmentSourceDetails } from '../../lib/attachments';
import { attachmentLabel } from '../../lib/i18n';
import type { ContextAttachment, Settings } from '../../shared/models';
import { attachmentBody, attachmentIcon, isAttachmentActivationKey } from '../utils/attachments';

type AttachmentCardProps = {
  attachment: ContextAttachment;
  settings: Settings | null;
  openLabel: string;
  deleteLabel: string;
  onOpen: (attachment: ContextAttachment) => void;
  onDelete: (attachment: ContextAttachment) => void;
  className: string;
  metaClassName: string;
  deleteButtonClassName: string;
  titleClassName?: string;
  bodyClassName?: string;
  showBodyPreview?: boolean;
  previewAlt?: string;
};

export function AttachmentCard({
  attachment,
  settings,
  openLabel,
  deleteLabel,
  onOpen,
  onDelete,
  className,
  metaClassName,
  deleteButtonClassName,
  titleClassName,
  bodyClassName,
  showBodyPreview = false,
  previewAlt,
}: AttachmentCardProps) {
  return (
    <div
      className={className}
      onClick={() => onOpen(attachment)}
      onKeyDown={(event) => {
        if (!isAttachmentActivationKey(event.key)) {
          return;
        }
        event.preventDefault();
        onOpen(attachment);
      }}
      role="button"
      tabIndex={0}
      aria-label={`${openLabel}: ${attachmentLabel(attachment, settings)}`}
      title={openLabel}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5">{attachmentIcon(attachment)}</span>
        <div className="min-w-0 flex-1">
          <div className={titleClassName ?? '[overflow-wrap:anywhere]'}>{attachmentLabel(attachment, settings)}</div>
          <div className={metaClassName}>{attachmentSourceDetails(attachment.source).join(' / ')}</div>
        </div>
        <button
          type="button"
          className={deleteButtonClassName}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(attachment);
          }}
          aria-label={deleteLabel}
          title={deleteLabel}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {showBodyPreview ? (
        attachment.kind === 'screenshot' ? (
          <div className="mt-2 overflow-hidden rounded-[16px] border border-stone-200 bg-stone-100 p-2">
            <img
              className="max-h-24 w-auto max-w-full rounded-[12px] object-contain shadow-sm"
              src={attachment.imageDataUrl}
              alt={previewAlt ?? openLabel}
            />
          </div>
        ) : (
          <div className={bodyClassName}>
            {attachmentBody(attachment)}
          </div>
        )
      ) : null}
    </div>
  );
}
