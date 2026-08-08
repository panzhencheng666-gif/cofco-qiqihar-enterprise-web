import type { ThemeConfig } from "antd";

export const enterpriseTheme: ThemeConfig = {
  token: {
    colorPrimary: "#197c76",
    colorInfo: "#2f6f9f",
    colorSuccess: "#4d9d69",
    colorWarning: "#d59a2b",
    colorError: "#ce5c5c",
    colorBgLayout: "#eef3f6",
    colorText: "#183044",
    colorBorder: "#d7e1e8",
    borderRadius: 8,
    fontFamily:
      '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
  },
  components: {
    Layout: { siderBg: "#0c2940", headerBg: "#ffffff" },
    Table: {
      headerBg: "#f6f8fa",
      headerColor: "#536b7c",
      rowHoverBg: "#f0f8f7",
    },
    Button: {
      controlHeight: 36,
      fontWeight: 600,
    },
  },
};
