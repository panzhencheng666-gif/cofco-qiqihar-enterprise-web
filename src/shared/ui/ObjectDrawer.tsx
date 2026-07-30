import { Descriptions, Drawer, Tag } from "antd";

export interface ObjectSummaryView {
  name: string;
  regionPath: readonly string[];
  capabilities: readonly string[];
}

interface ObjectDrawerProps {
  object?: ObjectSummaryView;
  open: boolean;
  onClose: () => void;
}

export function ObjectDrawer({ object, open, onClose }: ObjectDrawerProps) {
  return (
    <Drawer title="对象全景摘要" width={520} open={open} onClose={onClose}>
      {object && (
        <Descriptions column={1} bordered>
          <Descriptions.Item label="对象名称">{object.name}</Descriptions.Item>
          <Descriptions.Item label="地区">
            {object.regionPath.join(" / ")}
          </Descriptions.Item>
          <Descriptions.Item label="能力">
            {object.capabilities.map((capability) => (
              <Tag key={capability}>{capability}</Tag>
            ))}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Drawer>
  );
}
