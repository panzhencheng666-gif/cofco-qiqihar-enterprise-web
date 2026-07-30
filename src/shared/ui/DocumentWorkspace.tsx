import { Card, Col, Descriptions, Row, Space, Tag, Typography } from "antd";

export type WorkspaceMode = "edit" | "read" | "review";

export interface WorkspaceFieldView {
  code: string;
  label: string;
  displayValue: string;
  valueStatus: string;
  hasAmount: boolean;
  unit?: string;
}

export interface WorkspaceSectionView {
  id: string;
  title: string;
  fields: readonly WorkspaceFieldView[];
}

export interface DocumentWorkspaceView {
  commodity: string;
  reportingPeriod: string;
  formVersion: string;
  sections: readonly WorkspaceSectionView[];
}

interface DocumentWorkspaceProps {
  document: DocumentWorkspaceView;
  mode: WorkspaceMode;
}

export function DocumentWorkspace({ document, mode }: DocumentWorkspaceProps) {
  const modeLabel = {
    edit: "填报模式",
    read: "只读模式",
    review: "审核模式",
  }[mode];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={16}>
        <Col span={6}>
          <Card size="small">
            <Typography.Text type="secondary">品种</Typography.Text>
            <div>{document.commodity}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Typography.Text type="secondary">报告期</Typography.Text>
            <div>{document.reportingPeriod}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Typography.Text type="secondary">表单版本</Typography.Text>
            <div>{document.formVersion}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Typography.Text type="secondary">当前模式</Typography.Text>
            <div>
              <Tag>{modeLabel}</Tag>
            </div>
          </Card>
        </Col>
      </Row>
      {document.sections.map((section) => (
        <Card key={section.id} title={section.title}>
          <Descriptions bordered column={2}>
            {section.fields.map((field) => (
              <Descriptions.Item key={field.code} label={field.label}>
                <Space size={8}>
                  <span>
                    {field.displayValue}
                    {field.hasAmount && field.unit ? ` ${field.unit}` : ""}
                  </span>
                  <Tag>{field.valueStatus}</Tag>
                </Space>
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Card>
      ))}
    </Space>
  );
}
