export type EnterpriseIconName =
  | "apps"
  | "home"
  | "work"
  | "overview"
  | "production"
  | "market"
  | "supply"
  | "report"
  | "search"
  | "task"
  | "bell"
  | "help"
  | "collapse"
  | "expand"
  | "list"
  | "entry"
  | "review"
  | "exception"
  | "history"
  | "refresh"
  | "columns"
  | "density"
  | "download"
  | "upload"
  | "plus";

const paths: Record<EnterpriseIconName, readonly string[]> = {
  apps: [
    "M5 5h3v3H5z",
    "M10.5 5h3v3h-3z",
    "M16 5h3v3h-3z",
    "M5 10.5h3v3H5z",
    "M10.5 10.5h3v3h-3z",
    "M16 10.5h3v3h-3z",
    "M5 16h3v3H5z",
    "M10.5 16h3v3h-3z",
    "M16 16h3v3h-3z",
  ],
  home: ["M3 21h18", "M5 21V8l7-5 7 5v13", "M9 21v-6h6v6"],
  work: ["M5 4h14v16H5z", "m8 11 2 2 5-5"],
  overview: ["M4 19V9", "M10 19V5", "M16 19v-7", "M2 19h20"],
  production: [
    "M12 21V9",
    "M12 14c-5 0-7-3-7-7 5 0 7 3 7 7Z",
    "M12 12c5 0 7-3 7-7-5 0-7 3-7 7Z",
  ],
  market: ["M4 19V8h16v11", "M7 8V5h10v3", "M8 12h8"],
  supply: ["M4 7h16", "M4 12h16", "M4 17h16", "m17 4 3 3-3 3"],
  report: ["M6 3h9l3 3v15H6z", "M9 10h6", "M9 14h6", "M9 18h4"],
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z", "m20 20-4-4"],
  task: ["M6 4h12v16H6z", "M9 9h6", "M9 13h6", "M9 17h4"],
  bell: ["M5 17h14l-2-3v-4a5 5 0 0 0-10 0v4Z", "M10 20h4"],
  help: [
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
    "M10 9a2.4 2.4 0 1 1 3.5 2.1c-1 .6-1.5 1.1-1.5 2.2",
    "M12 17h.01",
  ],
  collapse: ["m14 6-6 6 6 6", "M20 4v16"],
  expand: ["m10 6 6 6-6 6", "M4 4v16"],
  list: [
    "M8 6h12",
    "M8 12h12",
    "M8 18h12",
    "M4 6h.01",
    "M4 12h.01",
    "M4 18h.01",
  ],
  entry: ["M5 4h14v16H5z", "M8 8h8", "M8 12h8", "M8 16h5"],
  review: ["m5 12 4 4L19 6", "M4 21h16"],
  exception: ["M12 3 2 15h-4Z", "M12 21h.01"],
  history: ["M4 12a8 8 0 1 0 2-5.3", "M4 4v5h5", "M12 8v5l3 2"],
  refresh: [
    "M20 6v5h-5",
    "M4 18v-5h5",
    "M18 9a7 7 0 0 0-12-2L4 11",
    "M6 15a7 7 0 0 0 12 2l2-4",
  ],
  columns: [
    "M4 6h16",
    "M4 12h16",
    "M4 18h16",
    "M8 4v4",
    "M15 10v4",
    "M11 16v4",
  ],
  density: ["M4 7h16", "M4 12h16", "M4 17h16"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M4 20h16"],
  upload: ["M12 15V3", "m7 8 5-5 5 5", "M4 20h16"],
  plus: ["M12 5v14", "M5 12h14"],
};

export function EnterpriseIcon({
  name,
  className = "",
}: {
  name: EnterpriseIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`enterprise-icon ${className}`.trim()}
      viewBox="0 0 24 24"
    >
      {paths[name].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}
