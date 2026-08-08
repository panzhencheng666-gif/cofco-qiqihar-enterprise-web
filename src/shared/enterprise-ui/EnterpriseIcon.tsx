import {
  AppstoreOutlined,
  AuditOutlined,
  BankOutlined,
  CheckSquareOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
} from "@ant-design/icons";

export type EnterpriseIconName =
  | "work"
  | "security"
  | "overview"
  | "production"
  | "market"
  | "supply"
  | "reports"
  | "governance"
  | "system"
  | "search"
  | "collapse-navigation"
  | "expand-navigation";

export function EnterpriseIcon({ name }: { name: EnterpriseIconName }) {
  const icons = {
    work: <CheckSquareOutlined />,
    security: <SafetyCertificateOutlined />,
    overview: <AppstoreOutlined />,
    production: <BankOutlined />,
    market: <ShopOutlined />,
    supply: <AuditOutlined />,
    reports: <FileTextOutlined />,
    governance: <DatabaseOutlined />,
    system: <SettingOutlined />,
    search: <SearchOutlined />,
    "collapse-navigation": <MenuFoldOutlined />,
    "expand-navigation": <MenuUnfoldOutlined />,
  } satisfies Record<EnterpriseIconName, React.ReactNode>;

  return <span aria-hidden="true">{icons[name]}</span>;
}
