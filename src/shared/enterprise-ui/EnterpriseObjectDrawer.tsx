import { Descriptions, Drawer, Tag } from "antd";

export interface ObjectSummaryView {
  name: string;
  regionPath: readonly string[];
  contextLabel: string;
  contextValues: readonly string[];
  relatedWorkspaces?: readonly {
    label: string;
    period: string;
    status: string;
    quality: string;
  }[];
}

interface ObjectDrawerProps {
  object?: ObjectSummaryView;
  open: boolean;
  onClose: () => void;
  title?: string;
}

export function EnterpriseObjectDrawer({
  object,
  open,
  onClose,
  title = "对象全景摘要",
}: ObjectDrawerProps) {
  return (
    <Drawer title={title} width={520} open={open} onClose={onClose}>
      {object && (
        <Descriptions column={1} bordered>
          <Descriptions.Item label="对象名称">{object.name}</Descriptions.Item>
          <Descriptions.Item label="地区">
            {object.regionPath.join(" / ")}
          </Descriptions.Item>
          <Descriptions.Item label={object.contextLabel}>
            {object.contextValues.map((value) => (
              <Tag key={value}>{value}</Tag>
            ))}
          </Descriptions.Item>
          {object.relatedWorkspaces && object.relatedWorkspaces.length > 0 && (
            <Descriptions.Item label="关联业务">
              <ul className="enterprise-object-related-workspaces">
                {object.relatedWorkspaces.map((item, index) => (
                  <li key={`${item.label}:${item.period}:${index}`}>
                    <strong>{item.label}</strong>
                    <span>{item.period}</span>
                    <small>
                      {item.status} · {item.quality}
                    </small>
                  </li>
                ))}
              </ul>
            </Descriptions.Item>
          )}
        </Descriptions>
      )}
    </Drawer>
  );
}
