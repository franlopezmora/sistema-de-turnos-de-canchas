import type { ReactNode } from 'react';
import AdminSidebarScaffold from './AdminSidebarScaffold';

type AdminRightSidebarProps = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  subtitle?: ReactNode;
  statusChip?: ReactNode;
  statusChipClassName?: string;
  tabs?: Array<{ id: string; label: string }>;
  activeTabId?: string;
  onTabChange?: (id: string) => void;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  widthClassName?: string;
  contentMuted?: boolean;
  zIndexClassName?: string;
  frameContent?: boolean;
  contentClassName?: string;
  framedContentClassName?: string;
};

export default function AdminRightSidebar({
  open,
  title,
  description,
  subtitle,
  statusChip,
  statusChipClassName,
  tabs,
  activeTabId,
  onTabChange,
  children,
  footer,
  onClose,
  widthClassName = 'w-full max-w-[620px]',
  zIndexClassName,
  frameContent = true,
  contentClassName,
  framedContentClassName,
}: AdminRightSidebarProps) {
  return (
    <AdminSidebarScaffold
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle || description}
      statusChip={statusChip}
      statusChipClassName={statusChipClassName}
      widthClassName={widthClassName}
      tabs={tabs}
      activeTabId={activeTabId}
      onTabChange={onTabChange}
      footer={footer}
      zIndexClassName={zIndexClassName}
      frameContent={frameContent}
      contentClassName={contentClassName}
      framedContentClassName={framedContentClassName}
    >
      {children}
    </AdminSidebarScaffold>
  );
}
