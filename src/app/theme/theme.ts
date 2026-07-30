import type { ThemeConfig } from "antd";

export const enterpriseTheme: ThemeConfig = {
  token: {
    colorPrimary: "#0f766e",
    colorInfo: "#1677ff",
    colorSuccess: "#2f855a",
    colorWarning: "#b7791f",
    colorError: "#c53030",
    colorBgLayout: "#f3f6f8",
    colorText: "#172b3a",
    borderRadius: 8,
    fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  components: {
    Layout: { siderBg: "#102a43", headerBg: "#ffffff" },
    Table: { headerBg: "#f4f7f9", headerColor: "#334e68" },
  },
};
