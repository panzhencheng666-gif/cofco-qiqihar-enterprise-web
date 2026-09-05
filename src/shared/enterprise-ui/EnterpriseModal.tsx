import { Modal, type ModalProps } from "antd";

/** Keeps the enterprise modal dependency behind the shared UI boundary. */
export function EnterpriseModal(props: ModalProps) {
  return <Modal {...props} />;
}
