import { Button, Tag } from "antd";
import type { ReactNode } from "react";

export function EnterprisePrimaryAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button type="primary" onClick={onClick}>
      {children}
    </Button>
  );
}

export function EnterpriseSecondaryAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return <Button onClick={onClick}>{children}</Button>;
}

export function EnterpriseTextAction({
  children,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <Button type="link" aria-label={ariaLabel} onClick={onClick}>
      {children}
    </Button>
  );
}

export function EnterpriseStatusTag({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "default" | "warning" | "danger" | "success";
}) {
  const colorByTone = {
    default: "blue",
    warning: "gold",
    danger: "red",
    success: "green",
  } as const;
  return <Tag color={colorByTone[tone]}>{children}</Tag>;
}
