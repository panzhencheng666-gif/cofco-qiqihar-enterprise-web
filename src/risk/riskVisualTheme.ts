import type { ThemeConfig } from "antd";

export const riskVisualTokens = Object.freeze({
  canvas: "#ffffff",
  surface: "#f4f6f8",
  surfaceStrong: "#e8edf2",
  text: "#161616",
  textMuted: "#525252",
  textSubtle: "#6f6f6f",
  hairline: "#d9e0e6",
  primary: "#0f62fe",
  primaryStrong: "#0043ce",
  success: "#198038",
  warning: "#b28600",
  error: "#da1e28",
});

export const riskAntTheme = {
  token: {
    colorPrimary: riskVisualTokens.primary,
    colorInfo: riskVisualTokens.primary,
    colorSuccess: riskVisualTokens.success,
    colorWarning: riskVisualTokens.warning,
    colorError: riskVisualTokens.error,
    colorText: riskVisualTokens.text,
    colorTextSecondary: riskVisualTokens.textMuted,
    colorBgBase: riskVisualTokens.canvas,
    colorBgContainer: riskVisualTokens.canvas,
    colorBgElevated: riskVisualTokens.canvas,
    colorBorder: riskVisualTokens.hairline,
    colorBorderSecondary: "#e7ebef",
    borderRadius: 2,
    controlHeight: 40,
    fontFamily:
      '"IBM Plex Sans","PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif',
    fontSize: 14,
  },
  components: {
    Table: {
      headerBg: riskVisualTokens.surface,
      headerColor: riskVisualTokens.textMuted,
      rowHoverBg: "#edf5ff",
      borderColor: "#e3e8ed",
      cellPaddingBlockSM: 14,
    },
    Select: {
      selectorBg: riskVisualTokens.surface,
      optionSelectedBg: "#e8f1ff",
    },
    Input: {
      activeBg: riskVisualTokens.surface,
      hoverBg: riskVisualTokens.surface,
      colorBgContainer: riskVisualTokens.surface,
    },
    Button: {
      borderRadius: 0,
      primaryShadow: "none",
    },
  },
} satisfies ThemeConfig;
